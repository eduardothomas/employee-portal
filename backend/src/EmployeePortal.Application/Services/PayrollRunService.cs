using EmployeePortal.Application.Abstractions;
using EmployeePortal.Application.Common;
using EmployeePortal.Contracts;
using EmployeePortal.Domain.Audit;
using EmployeePortal.Domain.Common;
using EmployeePortal.Domain.Notifications;
using EmployeePortal.Domain.Payroll;
using Microsoft.EntityFrameworkCore;

namespace EmployeePortal.Application.Services;

/// <summary>
/// HR payroll processing: create a draft run (payslips hidden from employees), review it, then publish.
/// </summary>
public sealed class PayrollRunService(IAppDbContext db, ICurrentUser user, IClock clock, AuditTrail audit, Notifier notifier)
{
    public async Task<IReadOnlyList<PayrollRunDto>> ListAsync(CancellationToken ct)
    {
        var runs = await db.PayrollRuns.Include(r => r.Payslips).ThenInclude(p => p.Lines)
            .OrderByDescending(r => r.PayDate).Take(60).ToListAsync(ct);
        return runs.Select(ToDto).ToList();
    }

    public async Task<PayrollRunDetailDto> GetAsync(Guid id, CancellationToken ct)
    {
        var run = await LoadAsync(id, ct);
        var names = await db.Employees.Where(e => run.Payslips.Select(p => p.EmployeeId).Contains(e.Id))
            .Select(e => new { e.Id, Name = e.FirstName + " " + e.LastName, e.Department })
            .ToDictionaryAsync(e => e.Id, ct);

        var rows = run.Payslips
            .Select(p => new PayrollRunRowDto(p.Id, p.EmployeeId, names.GetValueOrDefault(p.EmployeeId)?.Name ?? "",
                names.GetValueOrDefault(p.EmployeeId)?.Department ?? "", p.Gross, p.TotalDeductions, p.Net))
            .OrderBy(r => r.EmployeeName).ToList();
        return new PayrollRunDetailDto(ToDto(run), rows);
    }

    public async Task<PayrollRunDetailDto> CreateAsync(CreatePayrollRunRequest r, CancellationToken ct)
    {
        var kind = Mapping.ParseEnum<PayslipKind>(r.Kind, "kind");
        DateOnly start, end;

        if (kind == PayslipKind.Regular)
        {
            var isPayDay = r.PayDate.Day == 15 || r.PayDate.Day == DateTime.DaysInMonth(r.PayDate.Year, r.PayDate.Month);
            if (!isPayDay) throw ValidationException.For("payDate", "Las planillas regulares se pagan el 15 y el último día del mes.");
            (start, end) = PayCalendar.PeriodFor(r.PayDate);
        }
        else
        {
            if (r.PayDate.Day != 15 || r.PayDate.Month is not (4 or 8 or 12))
                throw ValidationException.For("payDate", "El décimo se paga el 15 de abril, agosto y diciembre.");
            var period = DecimoCalendar.CurrentPeriod(r.PayDate);
            (start, end) = (period.Start, period.End);
        }

        if (await db.PayrollRuns.AnyAsync(x => x.Kind == kind && x.PayDate == r.PayDate, ct))
            throw ValidationException.For("payDate", "Ya existe una planilla para esa fecha.");

        var employees = await db.Employees.Include(e => e.RecurringDeductions)
            .Where(e => e.IsActive && e.HireDate <= end).ToListAsync(ct);

        var run = new PayrollRun { Kind = kind, PeriodStart = start, PeriodEnd = end, PayDate = r.PayDate, CreatedById = user.Id, CreatedAt = clock.UtcNow };

        // Earnings already paid in the décimo period, used to compute each installment.
        var earningsByEmployee = new Dictionary<Guid, decimal>();
        if (kind == PayslipKind.Decimo)
        {
            var regular = await db.Payslips.Include(p => p.Lines)
                .Where(p => p.Kind == PayslipKind.Regular && p.PayDate >= start && p.PayDate <= end).ToListAsync(ct);
            earningsByEmployee = regular.GroupBy(p => p.EmployeeId).ToDictionary(g => g.Key, g => g.Sum(p => p.Gross));
        }

        foreach (var e in employees)
        {
            IReadOnlyList<PayrollLine> lines;
            if (kind == PayslipKind.Regular)
            {
                var adj = r.Adjustments?.GetValueOrDefault(e.Id);
                lines = PanamaPayroll.CalculateRegular(e.MonthlySalary, adj?.Bonus ?? 0, adj?.Overtime ?? 0,
                    e.RecurringDeductions.Where(d => d.IsActive).Select(d => new ExtraDeduction(d.Code, d.Description, d.AmountPerPeriod)));
            }
            else
            {
                var earnings = earningsByEmployee.TryGetValue(e.Id, out var paid) && paid > 0
                    ? paid
                    : DecimoCalendar.EstimateGross(e.MonthlySalary, new DecimoCalendar.DecimoPeriod(start, end, r.PayDate), e.HireDate) * 12m;
                lines = PanamaPayroll.CalculateDecimo(earnings);
            }

            run.Payslips.Add(new Payslip
            {
                EmployeeId = e.Id,
                PayrollRunId = run.Id,
                Kind = kind,
                PeriodStart = start,
                PeriodEnd = end,
                PayDate = r.PayDate,
                IsPublished = false,
                Lines = lines.Select((l, i) => new PayslipLine { Type = l.Type, Code = l.Code, Description = l.Description, Amount = l.Amount, SortOrder = i }).ToList()
            });
        }

        db.PayrollRuns.Add(run);
        audit.Record(AuditActions.PayrollRunCreated, nameof(PayrollRun), run.Id, null,
            new { kind = kind.ToString(), r.PayDate, employees = run.Payslips.Count });
        await db.SaveChangesAsync(ct);
        return await GetAsync(run.Id, ct);
    }

    public async Task<PayrollRunDetailDto> PublishAsync(Guid id, CancellationToken ct)
    {
        var run = await LoadAsync(id, ct);
        if (run.Status == PayrollRunStatus.Published) throw new DomainException("La planilla ya fue publicada.");

        run.Status = PayrollRunStatus.Published;
        run.PublishedAt = clock.UtcNow;
        foreach (var slip in run.Payslips)
        {
            slip.IsPublished = true;
            var label = run.Kind == PayslipKind.Decimo ? "décimo tercer mes" : $"{run.PayDate.Day} de {Mapping.MonthName(run.PayDate.Month).ToLower()}";
            notifier.Notify(slip.EmployeeId, NotificationType.Payslip, "Comprobante disponible",
                $"Tu comprobante del {label} está disponible. Neto: ${slip.Net:N2}.", $"/payroll/payslips/{slip.Id}");
        }

        audit.Record(AuditActions.PayrollRunPublished, nameof(PayrollRun), run.Id, null,
            new { run.PayDate, employees = run.Payslips.Count, totalNet = run.Payslips.Sum(p => p.Net) });
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteDraftAsync(Guid id, CancellationToken ct)
    {
        var run = await LoadAsync(id, ct);
        if (run.Status != PayrollRunStatus.Draft) throw new DomainException("Solo se pueden eliminar planillas en borrador.");
        db.Payslips.RemoveRange(run.Payslips);
        db.PayrollRuns.Remove(run);
        audit.Record("payroll.run_deleted", nameof(PayrollRun), run.Id, null, new { run.PayDate });
        await db.SaveChangesAsync(ct);
    }

    private async Task<PayrollRun> LoadAsync(Guid id, CancellationToken ct) =>
        await db.PayrollRuns.Include(r => r.Payslips).ThenInclude(p => p.Lines).FirstOrDefaultAsync(r => r.Id == id, ct)
        ?? throw new NotFoundException("Planilla no encontrada.");

    private static PayrollRunDto ToDto(PayrollRun r) =>
        new(r.Id, r.Kind.ToApi(), r.PeriodStart, r.PeriodEnd, r.PayDate, r.Status.ToApi(), r.CreatedAt, r.PublishedAt,
            r.Payslips.Count, r.Payslips.Sum(p => p.Gross), r.Payslips.Sum(p => p.TotalDeductions), r.Payslips.Sum(p => p.Net));
}

using EmployeePortal.Application.Abstractions;
using EmployeePortal.Application.Common;
using EmployeePortal.Contracts;
using EmployeePortal.Domain.Audit;
using EmployeePortal.Domain.Employees;
using EmployeePortal.Domain.Payroll;
using Microsoft.EntityFrameworkCore;

namespace EmployeePortal.Application.Services;

/// <summary>Employee-facing payroll queries (always scoped to the current user).</summary>
public sealed class PayrollService(IAppDbContext db, ICurrentUser user, IClock clock, IPdfRenderer pdf, AuditTrail audit)
{
    private IQueryable<Payslip> MyPayslips =>
        db.Payslips.Include(p => p.Lines).Where(p => p.EmployeeId == user.Id && p.IsPublished);

    public async Task<PayrollSummaryResponse> GetSummaryAsync(CancellationToken ct)
    {
        var employee = await db.Employees.Include(e => e.RecurringDeductions).FirstAsync(e => e.Id == user.Id, ct);
        var slips = await MyPayslips.Where(p => p.Kind == PayslipKind.Regular).ToListAsync(ct);
        var latest = slips.OrderByDescending(p => p.PayDate).FirstOrDefault();

        var history = slips
            .GroupBy(p => (p.PayDate.Year, p.PayDate.Month))
            .OrderByDescending(g => g.Key.Year).ThenByDescending(g => g.Key.Month)
            .Take(12)
            .Select(g => new MonthlyNetDto(g.Key.Year, g.Key.Month, g.Sum(p => p.Gross), g.Sum(p => p.TotalDeductions), g.Sum(p => p.Net)))
            .ToList();

        return new PayrollSummaryResponse(
            employee.MonthlySalary,
            PayCalendar.NextPayDate(clock.Today),
            EstimateNextNet(employee),
            latest?.ToSummary(),
            history);
    }

    public static decimal EstimateNextNet(Employee employee)
    {
        var lines = PanamaPayroll.CalculateRegular(employee.MonthlySalary, extraDeductions:
            employee.RecurringDeductions.Where(d => d.IsActive).Select(d => new ExtraDeduction(d.Code, d.Description, d.AmountPerPeriod)));
        return lines.Where(l => l.Type == PayslipLineType.Earning).Sum(l => l.Amount)
               - lines.Where(l => l.Type == PayslipLineType.Deduction).Sum(l => l.Amount);
    }

    public async Task<IReadOnlyList<PayslipSummaryDto>> GetPayslipsAsync(int? year, CancellationToken ct)
    {
        var query = MyPayslips;
        if (year is { } y) query = query.Where(p => p.PayDate >= new DateOnly(y, 1, 1) && p.PayDate <= new DateOnly(y, 12, 31));
        var slips = await query.ToListAsync(ct);
        return slips.OrderByDescending(p => p.PayDate).Select(p => p.ToSummary()).ToList();
    }

    public async Task<PayslipDetailDto> GetPayslipAsync(Guid id, CancellationToken ct)
    {
        var slip = await MyPayslips.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NotFoundException("Comprobante no encontrado.");
        var employee = await db.GetEmployeeAsync(user.Id, ct);
        audit.Record(AuditActions.PayslipViewed, nameof(Payslip), slip.Id, user.Id);
        await db.SaveChangesAsync(ct);
        return slip.ToDetail(employee);
    }

    public async Task<(byte[] Content, string FileName)> GetPayslipPdfAsync(Guid id, CancellationToken ct)
    {
        var slip = await MyPayslips.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw new NotFoundException("Comprobante no encontrado.");
        var employee = await db.GetEmployeeAsync(user.Id, ct);
        audit.Record(AuditActions.PayslipDownloaded, nameof(Payslip), slip.Id, user.Id);
        await db.SaveChangesAsync(ct);
        return (pdf.RenderPayslip(slip.ToDetail(employee)), $"comprobante-{slip.PayDate:yyyy-MM-dd}.pdf");
    }

    public async Task<MonthDetailDto> GetMonthAsync(int year, int month, CancellationToken ct)
    {
        if (month is < 1 or > 12) throw ValidationException.For("month", "Mes inválido.");
        var from = new DateOnly(year, month, 1);
        var to = from.AddMonths(1).AddDays(-1);
        var slips = await MyPayslips.Where(p => p.Kind == PayslipKind.Regular && p.PayDate >= from && p.PayDate <= to).ToListAsync(ct);
        if (slips.Count == 0) throw new NotFoundException("No hay pagos para ese mes.");

        static List<PayslipLineDto> Aggregate(IEnumerable<PayslipLine> lines) => lines
            .GroupBy(l => (l.Code, l.Description))
            .Select(g => new { g.Key, Amount = g.Sum(l => l.Amount), Order = g.Min(l => l.SortOrder) })
            .OrderBy(x => x.Order)
            .Select(x => new PayslipLineDto(x.Key.Code, x.Key.Description, x.Amount))
            .ToList();

        var all = slips.SelectMany(s => s.Lines).ToList();
        var earnings = Aggregate(all.Where(l => l.Type == PayslipLineType.Earning));
        var deductions = Aggregate(all.Where(l => l.Type == PayslipLineType.Deduction));
        var gross = earnings.Sum(l => l.Amount);
        var totalDed = deductions.Sum(l => l.Amount);

        return new MonthDetailDto(year, month, earnings, deductions, gross, totalDed, gross - totalDed,
            slips.OrderBy(s => s.PayDate).Select(s => s.ToSummary()).ToList());
    }

    public async Task<DeductionsResponse> GetDeductionsAsync(int? year, int? month, CancellationToken ct)
    {
        var slips = await MyPayslips.Where(p => p.Kind == PayslipKind.Regular).ToListAsync(ct);
        var latest = slips.OrderByDescending(p => p.PayDate).FirstOrDefault();
        var y = year ?? latest?.PayDate.Year ?? clock.Today.Year;
        var m = month ?? latest?.PayDate.Month ?? clock.Today.Month;

        static List<PayslipLineDto> Sum(IEnumerable<Payslip> s) => s
            .SelectMany(p => p.Lines.Where(l => l.Type == PayslipLineType.Deduction))
            .GroupBy(l => l.Code)
            .Select(g => new { Code = g.Key, g.First().Description, Amount = g.Sum(l => l.Amount), Order = g.Min(l => l.SortOrder) })
            .OrderBy(x => x.Order)
            .Select(x => new PayslipLineDto(x.Code, x.Description, x.Amount))
            .ToList();

        var monthItems = Sum(slips.Where(p => p.PayDate.Year == y && p.PayDate.Month == m));
        var ytd = Sum(slips.Where(p => p.PayDate.Year == y && p.PayDate.Month <= m));

        var history = slips
            .GroupBy(p => (p.PayDate.Year, p.PayDate.Month))
            .OrderByDescending(g => g.Key.Year).ThenByDescending(g => g.Key.Month)
            .Take(12)
            .Select(g =>
            {
                var items = Sum(g);
                return new DeductionMonthDto(g.Key.Year, g.Key.Month, items.Sum(i => i.Amount),
                    items.ToDictionary(i => i.Code, i => i.Amount));
            })
            .ToList();

        return new DeductionsResponse(y, m, monthItems, monthItems.Sum(i => i.Amount), ytd, history);
    }

    public async Task<DecimoResponse> GetDecimoAsync(CancellationToken ct)
    {
        var employee = await db.GetEmployeeAsync(user.Id, ct);
        var period = DecimoCalendar.CurrentPeriod(clock.Today);
        var gross = DecimoCalendar.EstimateGross(employee.MonthlySalary, period, employee.HireDate);
        var net = gross - PanamaPayroll.Round(gross * PanamaPayroll.DecimoCssRate);

        var history = await MyPayslips.Where(p => p.Kind == PayslipKind.Decimo).ToListAsync(ct);
        return new DecimoResponse(period.PayDate, period.Start, period.End, gross, net,
            history.OrderByDescending(p => p.PayDate).Select(p => p.ToSummary()).ToList());
    }
}

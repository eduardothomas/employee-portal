using EmployeePortal.Application.Abstractions;
using EmployeePortal.Domain.Audit;
using EmployeePortal.Domain.Common;
using EmployeePortal.Domain.Documents;
using EmployeePortal.Domain.Employees;
using EmployeePortal.Domain.Notifications;
using EmployeePortal.Domain.Payroll;
using EmployeePortal.Domain.Time;
using EmployeePortal.Infrastructure.Pdf;
using Microsoft.EntityFrameworkCore;

namespace EmployeePortal.Infrastructure.Persistence;

/// <summary>
/// Demo data relative to "today" so the dashboard always looks alive.
/// All demo users share the password <see cref="DemoPassword"/>.
/// </summary>
public sealed class DataSeeder(AppDbContext db, IPasswordService passwords, IClock clock, PdfRenderer pdf)
{
    public const string DemoPassword = "Portal2026!";

    public async Task SeedAsync(CancellationToken ct = default)
    {
        if (await db.Employees.AnyAsync(ct)) return;

        var today = clock.Today;
        var hash = passwords.Hash(DemoPassword);

        Employee E(string code, string first, string last, string title, string dept, decimal salary, Role role,
            Employee? manager, DateOnly hired, string phone, decimal accrued) => new()
        {
            EmployeeCode = code, FirstName = first, LastName = last, JobTitle = title, Department = dept,
            MonthlySalary = salary, Role = role, ManagerId = manager?.Id, HireDate = hired, Phone = phone,
            WorkEmail = $"{Slug(first)}.{Slug(last)}@employeeportal.dev",
            NationalId = $"8-{Random.Shared.Next(700, 999)}-{Random.Shared.Next(1000, 9999)}",
            PasswordHash = hash, VacationAccruedDays = accrued, BankName = "Banco General",
            BankAccountType = "Ahorros", BankAccountNumber = $"04-01-99-{Random.Shared.Next(100000, 999999)}",
            Address = "Ciudad de Panamá", BirthDate = new DateOnly(1990, Random.Shared.Next(1, 12), Random.Shared.Next(1, 28))
        };

        var ricardo = E("EMP-0010", "Ricardo", "Arias", "Director General", "Dirección", 9000, Role.Manager, null, new(2018, 1, 8), "+507 6000-0010", 24);
        var ana = E("EMP-0003", "Ana", "Castillo", "Gerente de Recursos Humanos", "Recursos Humanos", 4800, Role.HrAdmin, ricardo, new(2019, 6, 3), "+507 6000-0003", 18);
        var laura = E("EMP-0002", "Laura", "Méndez", "Engineering Manager", "Tecnología", 5200, Role.Manager, ricardo, new(2020, 2, 17), "+507 6000-0002", 15);
        var eduardo = E("EMP-0001", "Eduardo", "Thomas", "Software Engineer", "Tecnología", 3500, Role.Employee, laura, new(2023, 3, 1), "+507 6123-4567", 30);
        var diego = E("EMP-0004", "Diego", "Pérez", "Frontend Developer", "Tecnología", 2800, Role.Employee, laura, new(2024, 1, 15), "+507 6000-0004", 16);
        var sofia = E("EMP-0005", "Sofía", "Herrera", "QA Analyst", "Tecnología", 2200, Role.Employee, laura, new(2024, 7, 1), "+507 6000-0005", 11);
        var maria = E("EMP-0006", "María", "González", "Analista de Planilla", "Recursos Humanos", 2400, Role.HrAdmin, ana, new(2022, 9, 12), "+507 6000-0006", 20);
        var javier = E("EMP-0007", "Javier", "Ruiz", "Contador", "Finanzas", 3000, Role.Employee, ricardo, new(2021, 4, 5), "+507 6000-0007", 22);

        eduardo.PersonalEmail = "eduardo.thomas@example.com";
        eduardo.Address = "Costa del Este, Ciudad de Panamá";
        eduardo.EmergencyContactName = "Carmen Thomas";
        eduardo.EmergencyContactPhone = "+507 6987-6543";
        eduardo.EmergencyContactRelationship = "Madre";
        eduardo.NationalId = "8-912-1234";
        eduardo.RecurringDeductions =
        [
            new() { Code = "SEGURO", Description = "Seguro médico", AmountPerPeriod = 42.50m },
            new() { Code = "PRESTAMO", Description = "Préstamo personal", AmountPerPeriod = 125m }
        ];
        diego.RecurringDeductions = [new() { Code = "SEGURO", Description = "Seguro médico", AmountPerPeriod = 42.50m }];
        javier.RecurringDeductions = [new() { Code = "SEGURO", Description = "Seguro médico", AmountPerPeriod = 42.50m }];

        var all = new[] { ricardo, ana, laura, eduardo, diego, sofia, maria, javier };
        db.Employees.AddRange(all);

        // ── Leave types (configurable policies) ──
        var types = new[]
        {
            new LeaveType { Code = "personal", Name = "Personal", Icon = "👤", SortOrder = 1, MaxDaysPerYear = 3 },
            new LeaveType { Code = "medico", Name = "Cita médica", Icon = "🩺", SortOrder = 2, RequiresAttachment = true },
            new LeaveType { Code = "calamidad", Name = "Calamidad doméstica", Icon = "🕯️", SortOrder = 3 },
            new LeaveType { Code = "estudios", Name = "Estudios", Icon = "🎓", SortOrder = 4, IsPaid = false },
            new LeaveType { Code = "maternidad", Name = "Maternidad / Paternidad", Icon = "👶", SortOrder = 5 },
            new LeaveType { Code = "otros", Name = "Otros", Icon = "📝", SortOrder = 9 },
        };
        db.LeaveTypes.AddRange(types);

        // ── Payroll history: last 16 quincenas + last 3 décimos ──
        var payDates = new List<DateOnly>();
        for (var d = PayCalendar.NextPayDate(today); payDates.Count < 17; d = PreviousPayDate(d))
            if (d < today) payDates.Add(d);
        payDates.Reverse();

        foreach (var payDate in payDates)
        {
            var (start, end) = PayCalendar.PeriodFor(payDate);
            var run = new PayrollRun
            {
                Kind = PayslipKind.Regular, PeriodStart = start, PeriodEnd = end, PayDate = payDate,
                Status = PayrollRunStatus.Published, CreatedById = maria.Id,
                CreatedAt = payDate.AddDays(-3).ToDateTime(new TimeOnly(15, 0), DateTimeKind.Utc),
                PublishedAt = payDate.AddDays(-1).ToDateTime(new TimeOnly(15, 0), DateTimeKind.Utc)
            };
            foreach (var e in all.Where(e => e.HireDate <= end))
            {
                var isLatest = payDate == payDates[^1];
                var overtime = e == eduardo && payDate.Day > 15 ? (isLatest ? 150m : 60m * (payDate.Month % 3)) : 0m;
                var bonus = e == eduardo && isLatest ? 200m : 0m;
                var lines = PanamaPayroll.CalculateRegular(e.MonthlySalary, bonus, overtime,
                    e.RecurringDeductions.Select(r => new ExtraDeduction(r.Code, r.Description, r.AmountPerPeriod)));
                run.Payslips.Add(ToPayslip(e, run, lines));
            }
            db.PayrollRuns.Add(run);
        }

        var decimoDates = new List<DateOnly>();
        for (var y = today.Year - 1; y <= today.Year; y++)
            foreach (var m in new[] { 4, 8, 12 })
                if (new DateOnly(y, m, 15) < today) decimoDates.Add(new DateOnly(y, m, 15));
        foreach (var payDate in decimoDates.TakeLast(3))
        {
            var period = DecimoCalendar.CurrentPeriod(payDate);
            var run = new PayrollRun
            {
                Kind = PayslipKind.Decimo, PeriodStart = period.Start, PeriodEnd = period.End, PayDate = payDate,
                Status = PayrollRunStatus.Published, CreatedById = maria.Id, PublishedAt = payDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc)
            };
            foreach (var e in all.Where(e => e.HireDate <= period.End))
                run.Payslips.Add(ToPayslip(e, run, PanamaPayroll.CalculateDecimo(e.MonthlySalary * 4m)));
            db.PayrollRuns.Add(run);
        }

        // ── Vacations ──
        var y0 = today.Year;
        var pastStart = NextWorkingDay(today.AddDays(-120));
        var pastEnd = AddWorkingDays(pastStart, 8);
        db.VacationRequests.Add(Approved(new VacationRequest
        {
            EmployeeId = eduardo.Id, Number = $"VAC-{pastStart.Year}-00118", StartDate = pastStart, EndDate = pastEnd,
            Days = WorkCalendar.WorkingDays(pastStart, pastEnd), Comment = "Viaje familiar",
            CreatedAt = ToUtc(pastStart.AddDays(-30))
        }, laura));

        var decStart = new DateOnly(y0, 12, 15);
        if (decStart > today)
        {
            var decEnd = new DateOnly(y0, 12, 29);
            db.VacationRequests.Add(new VacationRequest
            {
                EmployeeId = eduardo.Id, Number = $"VAC-{y0}-00142", StartDate = decStart, EndDate = decEnd,
                Days = WorkCalendar.WorkingDays(decStart, decEnd), Comment = "Vacaciones de fin de año", CreatedAt = clock.UtcNow.AddDays(-2)
            });
        }

        var diegoStart = NextWorkingDay(today.AddDays(21));
        var diegoEnd = AddWorkingDays(diegoStart, 5);
        db.VacationRequests.Add(new VacationRequest
        {
            EmployeeId = diego.Id, Number = $"VAC-{diegoStart.Year}-00143", StartDate = diegoStart, EndDate = diegoEnd,
            Days = WorkCalendar.WorkingDays(diegoStart, diegoEnd), Comment = "Boda de mi hermano", CreatedAt = clock.UtcNow.AddDays(-1)
        });

        var javierStart = NextWorkingDay(today.AddDays(-2));
        var javierEnd = AddWorkingDays(javierStart, 5);
        db.VacationRequests.Add(Approved(new VacationRequest
        {
            EmployeeId = javier.Id, Number = $"VAC-{javierStart.Year}-00139", StartDate = javierStart, EndDate = javierEnd,
            Days = WorkCalendar.WorkingDays(javierStart, javierEnd), CreatedAt = clock.UtcNow.AddDays(-20)
        }, ricardo));

        // ── Leave requests ──
        LeaveRequest Leave(Employee e, LeaveType t, string number, DateOnly date, decimal? hours, string reason) => new()
        {
            EmployeeId = e.Id, LeaveTypeId = t.Id, Number = number, StartDate = date, EndDate = date, Hours = hours,
            Reason = reason, CreatedAt = ToUtc(date.AddDays(-5))
        };
        db.LeaveRequests.AddRange(
            Approved(Leave(eduardo, types[1], $"PER-{y0}-00201", NextWorkingDay(today.AddDays(-35)), 3, "Control anual"), laura),
            Approved(Leave(eduardo, types[0], $"PER-{y0}-00187", NextWorkingDay(today.AddDays(-50)), null, "Trámite personal"), laura),
            Leave(eduardo, types[0], $"PER-{y0}-00215", NextWorkingDay(today.AddDays(3)), 2, "Cita personal en el banco"),
            Leave(sofia, types[1], $"PER-{y0}-00216", NextWorkingDay(today.AddDays(5)), 4, "Cita con especialista"));

        // ── Profile change request ──
        db.ChangeRequests.Add(new ChangeRequest
        {
            EmployeeId = diego.Id, Field = "jobTitle", CurrentValue = diego.JobTitle, RequestedValue = "Senior Frontend Developer",
            Reason = "Promoción aprobada en la evaluación de desempeño.", CreatedAt = clock.UtcNow.AddDays(-3)
        });

        // ── Documents ──
        Document Doc(Employee? e, DocumentCategory c, string title, string file, byte[] content, int daysAgo)
        {
            var d = new Document
            {
                EmployeeId = e?.Id, Category = c, Title = title, FileName = file, SizeBytes = content.Length,
                UploadedAt = clock.UtcNow.AddDays(-daysAgo), UploadedById = ana.Id
            };
            d.File = new DocumentFile { DocumentId = d.Id, Content = content };
            return d;
        }

        db.Documents.AddRange(
            Doc(eduardo, DocumentCategory.Employment, "Contrato de trabajo", "contrato-eduardo-thomas.pdf", pdf.RenderLetter("Contrato de trabajo",
            [
                $"Entre {PdfRenderer.CompanyName} (EL EMPLEADOR) y Eduardo Thomas, con cédula {eduardo.NationalId} (EL TRABAJADOR), se celebra el presente contrato de trabajo por tiempo indefinido.",
                $"EL TRABAJADOR desempeñará el cargo de {eduardo.JobTitle} en el departamento de {eduardo.Department}, a partir del {eduardo.HireDate:dd/MM/yyyy}.",
                "El salario será pagado en dos quincenas, los días 15 y último de cada mes, mediante transferencia bancaria.",
                "Las partes se sujetan a lo dispuesto en el Código de Trabajo de la República de Panamá."
            ]), 900),
            Doc(eduardo, DocumentCategory.Employment, "Carta de trabajo", "carta-de-trabajo.pdf", pdf.RenderLetter("Carta de trabajo",
            [
                "A quien pueda interesar:",
                $"Por medio de la presente certificamos que Eduardo Thomas labora en {PdfRenderer.CompanyName} desde el {eduardo.HireDate:dd/MM/yyyy}, ocupando el cargo de {eduardo.JobTitle}, con un salario mensual de B/. {eduardo.MonthlySalary:N2}.",
                "Se expide la presente a solicitud del interesado.",
                "Ana Castillo — Gerente de Recursos Humanos"
            ]), 12),
            Doc(eduardo, DocumentCategory.Employment, "Certificado laboral", "certificado-laboral.pdf", pdf.RenderLetter("Certificado laboral",
            [
                $"Certificamos que Eduardo Thomas es colaborador activo de {PdfRenderer.CompanyName} en el departamento de Tecnología.",
                "Ana Castillo — Gerente de Recursos Humanos"
            ]), 60),
            Doc(null, DocumentCategory.Other, "Reglamento interno", "reglamento-interno.pdf", pdf.RenderLetter("Reglamento interno de trabajo",
            [
                "1. Horario: lunes a viernes de 8:00 a.m. a 5:00 p.m., con una hora de almuerzo.",
                "2. Vacaciones: 30 días por cada 11 meses de trabajo continuo, solicitados con al menos 15 días de anticipación a través del Employee Portal.",
                "3. Permisos: deben solicitarse por el portal. Los permisos médicos requieren constancia.",
                "4. Confidencialidad: la información de clientes y colaboradores es estrictamente confidencial."
            ]), 200));

        // ── Notifications for the demo employee ──
        var lastPay = payDates[^1];
        db.Notifications.AddRange(
            new Notification { EmployeeId = eduardo.Id, Type = NotificationType.Payslip, Title = "Comprobante disponible",
                Body = $"Tu comprobante del {lastPay.Day} de {Application.Common.Mapping.MonthName(lastPay.Month).ToLower()} está disponible.",
                Link = "/payroll", CreatedAt = ToUtc(lastPay) },
            new Notification { EmployeeId = eduardo.Id, Type = NotificationType.Document, Title = "Nuevo documento",
                Body = "RRHH publicó «Carta de trabajo».", Link = "/me/documents", CreatedAt = clock.UtcNow.AddDays(-12) },
            new Notification { EmployeeId = eduardo.Id, Type = NotificationType.Leave, Title = "Permiso aprobado",
                Body = "Tu permiso Cita médica fue aprobado.", Link = "/time/leave", CreatedAt = clock.UtcNow.AddDays(-36), ReadAt = clock.UtcNow.AddDays(-35) },
            new Notification { EmployeeId = eduardo.Id, Type = NotificationType.Announcement, Title = "Feriados de noviembre",
                Body = "Recuerda que el 3, 5, 10 y 28 de noviembre son días feriados.", CreatedAt = clock.UtcNow.AddHours(-20) },
            new Notification { EmployeeId = laura.Id, Type = NotificationType.General, Title = "Nueva solicitud de vacaciones",
                Body = "Diego Pérez solicitó vacaciones.", Link = "/approvals", CreatedAt = clock.UtcNow.AddDays(-1) });

        db.AuditLogs.Add(new AuditLog { ActorName = "system", Action = "system.seeded", EntityType = "Database", At = clock.UtcNow });
        await db.SaveChangesAsync(ct);
    }

    private static Payslip ToPayslip(Employee e, PayrollRun run, IReadOnlyList<PayrollLine> lines) => new()
    {
        EmployeeId = e.Id, PayrollRunId = run.Id, Kind = run.Kind, PeriodStart = run.PeriodStart,
        PeriodEnd = run.PeriodEnd, PayDate = run.PayDate, IsPublished = true,
        Lines = lines.Select((l, i) => new PayslipLine { Type = l.Type, Code = l.Code, Description = l.Description, Amount = l.Amount, SortOrder = i }).ToList()
    };

    private T Approved<T>(T request, Employee reviewer) where T : ReviewableRequest
    {
        request.Status = RequestStatus.Approved;
        request.ReviewedById = reviewer.Id;
        request.ReviewedAt = request.CreatedAt.AddDays(1);
        return request;
    }

    private static DateOnly PreviousPayDate(DateOnly d) =>
        d.Day > 15 ? new DateOnly(d.Year, d.Month, 15) : PayCalendar.NextPayDate(new DateOnly(d.Year, d.Month, 1).AddDays(-1));

    private static DateOnly NextWorkingDay(DateOnly d)
    {
        while (!WorkCalendar.IsWorkingDay(d)) d = d.AddDays(1);
        return d;
    }

    /// <summary>End date such that the range [start, end] contains <paramref name="days"/> working days.</summary>
    private static DateOnly AddWorkingDays(DateOnly start, int days)
    {
        var d = start;
        var count = 1;
        while (count < days)
        {
            d = d.AddDays(1);
            if (WorkCalendar.IsWorkingDay(d)) count++;
        }
        return d;
    }

    private static DateTime ToUtc(DateOnly d) => d.ToDateTime(new TimeOnly(14, 0), DateTimeKind.Utc);

    private static string Slug(string s) => s.ToLowerInvariant()
        .Replace("á", "a").Replace("é", "e").Replace("í", "i").Replace("ó", "o").Replace("ú", "u").Replace("ñ", "n");
}

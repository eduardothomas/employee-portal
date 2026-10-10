using EmployeePortal.Application.Abstractions;
using EmployeePortal.Application.Common;
using EmployeePortal.Contracts;
using EmployeePortal.Domain.Audit;
using EmployeePortal.Domain.Common;
using EmployeePortal.Domain.Employees;
using EmployeePortal.Domain.Payroll;
using EmployeePortal.Domain.Time;
using Microsoft.EntityFrameworkCore;

namespace EmployeePortal.Application.Services;

/// <summary>HR/Admin management: employees, policies (leave types), audit and metrics.</summary>
public sealed class AdminService(IAppDbContext db, ICurrentUser user, IClock clock, IPasswordService passwords, AuditTrail audit)
{
    // ── Employees ────────────────────────────────────────────────────

    public async Task<PagedResult<EmployeeListItemDto>> ListEmployeesAsync(
        string? search, string? department, bool? active, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        var query = db.Employees.Include(e => e.Manager).AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(e => (e.FirstName + " " + e.LastName).ToLower().Contains(s)
                                     || e.EmployeeCode.ToLower().Contains(s)
                                     || e.WorkEmail.ToLower().Contains(s)
                                     || e.JobTitle.ToLower().Contains(s));
        }
        if (!string.IsNullOrWhiteSpace(department)) query = query.Where(e => e.Department == department);
        if (active is { } a) query = query.Where(e => e.IsActive == a);

        var total = await query.CountAsync(ct);
        var items = await query.OrderBy(e => e.FirstName).ThenBy(e => e.LastName)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        return new PagedResult<EmployeeListItemDto>(items.Select(e => new EmployeeListItemDto(
            e.Id, e.EmployeeCode, e.FullName, e.WorkEmail, e.JobTitle, e.Department, e.Role.ToApi(),
            e.Manager?.FullName, e.IsActive, e.HireDate, e.MonthlySalary)).ToList(), total, page, pageSize);
    }

    public async Task<IReadOnlyList<string>> DepartmentsAsync(CancellationToken ct) =>
        await db.Employees.Select(e => e.Department).Distinct().OrderBy(d => d).ToListAsync(ct);

    public async Task<EmployeeDetailDto> GetEmployeeAsync(Guid id, CancellationToken ct)
    {
        var e = await db.Employees.Include(x => x.Manager).Include(x => x.RecurringDeductions)
            .FirstOrDefaultAsync(x => x.Id == id, ct) ?? throw new NotFoundException("Empleado no encontrado.");
        var balance = await TimeOffService.GetBalanceAsync(db, id, ct);

        return new EmployeeDetailDto(e.Id, e.EmployeeCode, e.FirstName, e.LastName, e.PreferredName, e.NationalId, e.BirthDate,
            e.WorkEmail, e.PersonalEmail, e.Phone, e.Address, e.EmergencyContactName, e.EmergencyContactPhone,
            e.EmergencyContactRelationship, e.JobTitle, e.Department, e.HireDate, e.EmploymentType.ToApi(), e.ManagerId,
            e.Manager?.FullName, e.MonthlySalary, e.IsActive, e.BankName, e.BankAccountType, e.BankAccountNumber,
            e.Role.ToApi(), e.VacationAccruedDays, balance,
            e.RecurringDeductions.OrderBy(d => d.Code).Select(d => d.ToDto()).ToList());
    }

    public async Task<EmployeeDetailDto> CreateEmployeeAsync(SaveEmployeeRequest r, CancellationToken ct)
    {
        await ValidateAsync(r, null, ct);
        AuthService.ValidatePasswordStrength(r.InitialPassword);

        var e = new Employee { PasswordHash = passwords.Hash(r.InitialPassword!) };
        Apply(e, r);
        db.Employees.Add(e);
        audit.Record(AuditActions.EmployeeCreated, nameof(Employee), e.Id, e.Id, new { e.EmployeeCode, e.JobTitle, e.MonthlySalary });
        await db.SaveChangesAsync(ct);
        return await GetEmployeeAsync(e.Id, ct);
    }

    public async Task<EmployeeDetailDto> UpdateEmployeeAsync(Guid id, SaveEmployeeRequest r, CancellationToken ct)
    {
        var e = await db.GetEmployeeAsync(id, ct);
        await ValidateAsync(r, id, ct);

        var before = Snapshot(e);
        Apply(e, r);
        var after = Snapshot(e);

        var changed = before.Where(kv => after[kv.Key] != kv.Value)
            .ToDictionary(kv => kv.Key, kv => new { from = kv.Value, to = after[kv.Key] });

        if (changed.Remove("monthlySalary", out var salary))
            audit.Record(AuditActions.SalaryChanged, nameof(Employee), e.Id, e.Id, salary);
        if (changed.Count > 0)
            audit.Record(AuditActions.EmployeeUpdated, nameof(Employee), e.Id, e.Id, changed);

        if (!string.IsNullOrWhiteSpace(r.InitialPassword))
        {
            AuthService.ValidatePasswordStrength(r.InitialPassword);
            e.PasswordHash = passwords.Hash(r.InitialPassword);
            audit.Record(AuditActions.PasswordChanged, nameof(Employee), e.Id, e.Id, "reset by HR");
        }

        await db.SaveChangesAsync(ct);
        return await GetEmployeeAsync(id, ct);
    }

    private async Task ValidateAsync(SaveEmployeeRequest r, Guid? id, CancellationToken ct)
    {
        var v = new Validator()
            .Require(r.EmployeeCode, "employeeCode")
            .Require(r.FirstName, "firstName")
            .Require(r.LastName, "lastName")
            .Require(r.NationalId, "nationalId")
            .Require(r.WorkEmail, "workEmail").Email(r.WorkEmail, "workEmail")
            .Email(r.PersonalEmail, "personalEmail")
            .Require(r.JobTitle, "jobTitle")
            .Require(r.Department, "department")
            .When(r.MonthlySalary < 0, "monthlySalary", "El salario no puede ser negativo.")
            .When(r.VacationAccruedDays < 0, "vacationAccruedDays", "Valor inválido.")
            .When(id is not null && r.ManagerId == id, "managerId", "Un empleado no puede ser su propio supervisor.");

        var code = r.EmployeeCode?.Trim() ?? "";
        var email = r.WorkEmail?.Trim().ToLower() ?? "";
        if (await db.Employees.AnyAsync(e => e.Id != id && e.EmployeeCode == code, ct)) v.Add("employeeCode", "Código ya existe.");
        if (await db.Employees.AnyAsync(e => e.Id != id && e.WorkEmail.ToLower() == email, ct)) v.Add("workEmail", "Email ya registrado.");
        if (r.ManagerId is { } m && !await db.Employees.AnyAsync(e => e.Id == m, ct)) v.Add("managerId", "Supervisor no existe.");
        v.ThrowIfInvalid();
    }

    private static void Apply(Employee e, SaveEmployeeRequest r)
    {
        static string? N(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
        e.EmployeeCode = r.EmployeeCode.Trim();
        e.FirstName = r.FirstName.Trim();
        e.LastName = r.LastName.Trim();
        e.PreferredName = N(r.PreferredName);
        e.NationalId = r.NationalId.Trim();
        e.BirthDate = r.BirthDate;
        e.WorkEmail = r.WorkEmail.Trim().ToLowerInvariant();
        e.PersonalEmail = N(r.PersonalEmail);
        e.Phone = N(r.Phone);
        e.Address = N(r.Address);
        e.JobTitle = r.JobTitle.Trim();
        e.Department = r.Department.Trim();
        e.HireDate = r.HireDate;
        e.EmploymentType = Mapping.ParseEnum<EmploymentType>(r.EmploymentType, "employmentType");
        e.ManagerId = r.ManagerId;
        e.MonthlySalary = PanamaPayroll.Round(r.MonthlySalary);
        e.IsActive = r.IsActive;
        e.BankName = N(r.BankName);
        e.BankAccountType = N(r.BankAccountType);
        e.BankAccountNumber = N(r.BankAccountNumber);
        e.Role = Mapping.ParseEnum<Role>(r.Role, "role");
        e.VacationAccruedDays = r.VacationAccruedDays;
    }

    private static Dictionary<string, string?> Snapshot(Employee e) => new()
    {
        ["employeeCode"] = e.EmployeeCode, ["firstName"] = e.FirstName, ["lastName"] = e.LastName,
        ["preferredName"] = e.PreferredName, ["nationalId"] = e.NationalId, ["birthDate"] = e.BirthDate?.ToString("yyyy-MM-dd"),
        ["workEmail"] = e.WorkEmail, ["personalEmail"] = e.PersonalEmail, ["phone"] = e.Phone, ["address"] = e.Address,
        ["jobTitle"] = e.JobTitle, ["department"] = e.Department, ["hireDate"] = e.HireDate.ToString("yyyy-MM-dd"),
        ["employmentType"] = e.EmploymentType.ToString(), ["managerId"] = e.ManagerId?.ToString(),
        ["monthlySalary"] = e.MonthlySalary.ToString("0.00"), ["isActive"] = e.IsActive.ToString(),
        ["bankName"] = e.BankName, ["bankAccountType"] = e.BankAccountType,
        ["bankAccountNumber"] = e.MaskedBankAccount, ["role"] = e.Role.ToString(),
        ["vacationAccruedDays"] = e.VacationAccruedDays.ToString("0.0"),
    };

    // ── Recurring deductions ────────────────────────────────────────

    public async Task<RecurringDeductionDto> AddDeductionAsync(Guid employeeId, SaveRecurringDeductionRequest r, CancellationToken ct)
    {
        await db.GetEmployeeAsync(employeeId, ct);
        ValidateDeduction(r);
        var d = new RecurringDeduction { EmployeeId = employeeId, Code = r.Code.Trim().ToUpperInvariant(), Description = r.Description.Trim(), AmountPerPeriod = r.AmountPerPeriod, IsActive = r.IsActive };
        db.RecurringDeductions.Add(d);
        audit.Record("deduction.created", nameof(RecurringDeduction), d.Id, employeeId, r);
        await db.SaveChangesAsync(ct);
        return d.ToDto();
    }

    public async Task<RecurringDeductionDto> UpdateDeductionAsync(Guid employeeId, Guid id, SaveRecurringDeductionRequest r, CancellationToken ct)
    {
        var d = await db.RecurringDeductions.FirstOrDefaultAsync(x => x.Id == id && x.EmployeeId == employeeId, ct) ?? throw new NotFoundException();
        ValidateDeduction(r);
        audit.Record("deduction.updated", nameof(RecurringDeduction), d.Id, employeeId, new { before = d.ToDto(), after = r });
        d.Code = r.Code.Trim().ToUpperInvariant();
        d.Description = r.Description.Trim();
        d.AmountPerPeriod = r.AmountPerPeriod;
        d.IsActive = r.IsActive;
        await db.SaveChangesAsync(ct);
        return d.ToDto();
    }

    private static void ValidateDeduction(SaveRecurringDeductionRequest r) =>
        new Validator().Require(r.Code, "code").MaxLength(r.Code, 20, "code").Require(r.Description, "description")
            .When(r.AmountPerPeriod <= 0, "amountPerPeriod", "El monto debe ser mayor a cero.").ThrowIfInvalid();

    // ── Vacation accrual ────────────────────────────────────────────

    /// <summary>Monthly accrual job: adds 30/11 days to every active employee.</summary>
    public async Task<int> AccrueMonthlyVacationAsync(CancellationToken ct)
    {
        var employees = await db.Employees.Where(e => e.IsActive).ToListAsync(ct);
        var increment = Math.Round(WorkCalendar.VacationDaysPerMonth, 2);
        foreach (var e in employees) e.VacationAccruedDays += increment;
        audit.Record("vacation.monthly_accrual", "Vacation", null, null, new { employees = employees.Count, increment });
        await db.SaveChangesAsync(ct);
        return employees.Count;
    }

    // ── Leave types (policies) ──────────────────────────────────────

    public async Task<LeaveTypeDto> SaveLeaveTypeAsync(Guid? id, SaveLeaveTypeRequest r, CancellationToken ct)
    {
        new Validator().Require(r.Code, "code").MaxLength(r.Code, 30, "code").Require(r.Name, "name").MaxLength(r.Name, 80, "name")
            .When(r.MaxDaysPerYear is < 0, "maxDaysPerYear", "Valor inválido.").ThrowIfInvalid();

        var code = r.Code.Trim().ToLowerInvariant();
        if (await db.LeaveTypes.AnyAsync(t => t.Code == code && t.Id != id, ct))
            throw ValidationException.For("code", "Ya existe un tipo con ese código.");

        LeaveType type;
        if (id is { } existing)
            type = await db.LeaveTypes.FirstOrDefaultAsync(t => t.Id == existing, ct) ?? throw new NotFoundException();
        else
            db.LeaveTypes.Add(type = new LeaveType());

        type.Code = code;
        type.Name = r.Name.Trim();
        type.Icon = string.IsNullOrWhiteSpace(r.Icon) ? "📝" : r.Icon.Trim();
        type.IsPaid = r.IsPaid;
        type.RequiresAttachment = r.RequiresAttachment;
        type.MaxDaysPerYear = r.MaxDaysPerYear;
        type.IsActive = r.IsActive;
        type.SortOrder = r.SortOrder;

        audit.Record(AuditActions.LeaveTypeSaved, nameof(LeaveType), type.Id, null, r);
        await db.SaveChangesAsync(ct);
        return type.ToDto();
    }

    // ── Audit ───────────────────────────────────────────────────────

    public async Task<PagedResult<AuditLogDto>> GetAuditAsync(string? action, Guid? employeeId, DateOnly? from, DateOnly? to, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        var query = db.AuditLogs.AsQueryable();
        if (!string.IsNullOrWhiteSpace(action)) query = query.Where(a => a.Action.StartsWith(action));
        if (employeeId is { } id) query = query.Where(a => a.SubjectEmployeeId == id || a.ActorId == id);
        if (from is { } f) { var fd = f.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc); query = query.Where(a => a.At >= fd); }
        if (to is { } t) { var td = t.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc); query = query.Where(a => a.At < td); }

        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(a => a.Id).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        var names = await db.NamesAsync(items.Select(a => a.SubjectEmployeeId), ct);
        return new PagedResult<AuditLogDto>(items.Select(a => a.ToDto(names)).ToList(), total, page, pageSize);
    }

    // ── Dashboard ───────────────────────────────────────────────────

    public async Task<AdminDashboardDto> GetDashboardAsync(CancellationToken ct)
    {
        var today = clock.Today;
        var active = await db.Employees.Where(e => e.IsActive).Select(e => new { e.Department, e.MonthlySalary }).ToListAsync(ct);

        var awayVac = await db.VacationRequests.Where(v => v.Status == RequestStatus.Approved && v.StartDate <= today && v.EndDate >= today)
            .Select(v => v.EmployeeId).ToListAsync(ct);
        var awayLeave = await db.LeaveRequests.Where(l => l.Status == RequestStatus.Approved && l.StartDate <= today && l.EndDate >= today)
            .Select(l => l.EmployeeId).ToListAsync(ct);

        var lastRun = await db.PayrollRuns.Include(r => r.Payslips).ThenInclude(p => p.Lines)
            .Where(r => r.Status == PayrollRunStatus.Published && r.Kind == PayslipKind.Regular)
            .OrderByDescending(r => r.PayDate).FirstOrDefaultAsync(ct);

        var upcoming = await db.VacationRequests.Where(v => v.Status == RequestStatus.Approved && v.EndDate >= today)
            .OrderBy(v => v.StartDate).Take(6).ToListAsync(ct);
        var upcomingNames = await db.NamesAsync(upcoming, ct);

        var recentAudit = await db.AuditLogs.OrderByDescending(a => a.Id).Take(8).ToListAsync(ct);
        var auditNames = await db.NamesAsync(recentAudit.Select(a => a.SubjectEmployeeId), ct);

        return new AdminDashboardDto(
            active.Count,
            await db.VacationRequests.CountAsync(v => v.Status == RequestStatus.Pending, ct),
            await db.LeaveRequests.CountAsync(l => l.Status == RequestStatus.Pending, ct),
            await db.ChangeRequests.CountAsync(c => c.Status == RequestStatus.Pending, ct),
            awayVac.Concat(awayLeave).Distinct().Count(),
            PayCalendar.NextPayDate(today),
            lastRun?.Payslips.Sum(p => p.Net) ?? 0m,
            active.Sum(e => e.MonthlySalary),
            active.GroupBy(e => e.Department).Select(g => new CountByLabelDto(g.Key, g.Count())).OrderByDescending(x => x.Count).ToList(),
            upcoming.Select(v => v.ToDto(upcomingNames)).ToList(),
            recentAudit.Select(a => a.ToDto(auditNames)).ToList());
    }
}

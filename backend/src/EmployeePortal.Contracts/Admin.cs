namespace EmployeePortal.Contracts;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public sealed record TeamMemberDto(
    Guid Id,
    string EmployeeCode,
    string FullName,
    string JobTitle,
    string Department,
    string? PhotoUrl,
    decimal VacationAvailable,
    string? AwayToday,
    int PendingRequests);

public sealed record ApprovalsResponse(
    IReadOnlyList<VacationRequestDto> Vacations,
    IReadOnlyList<LeaveRequestDto> Leaves);

public sealed record EmployeeListItemDto(
    Guid Id,
    string EmployeeCode,
    string FullName,
    string WorkEmail,
    string JobTitle,
    string Department,
    string Role,
    string? ManagerName,
    bool IsActive,
    DateOnly HireDate,
    decimal MonthlySalary);

public sealed record RecurringDeductionDto(Guid Id, string Code, string Description, decimal AmountPerPeriod, bool IsActive);

public sealed record SaveRecurringDeductionRequest(string Code, string Description, decimal AmountPerPeriod, bool IsActive);

public sealed record EmployeeDetailDto(
    Guid Id,
    string EmployeeCode,
    string FirstName,
    string LastName,
    string? PreferredName,
    string NationalId,
    DateOnly? BirthDate,
    string WorkEmail,
    string? PersonalEmail,
    string? Phone,
    string? Address,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    string? EmergencyContactRelationship,
    string JobTitle,
    string Department,
    DateOnly HireDate,
    string EmploymentType,
    Guid? ManagerId,
    string? ManagerName,
    decimal MonthlySalary,
    bool IsActive,
    string? BankName,
    string? BankAccountType,
    string? BankAccountNumber,
    string Role,
    decimal VacationAccruedDays,
    VacationBalanceDto VacationBalance,
    IReadOnlyList<RecurringDeductionDto> RecurringDeductions);

public sealed record SaveEmployeeRequest(
    string EmployeeCode,
    string FirstName,
    string LastName,
    string? PreferredName,
    string NationalId,
    DateOnly? BirthDate,
    string WorkEmail,
    string? PersonalEmail,
    string? Phone,
    string? Address,
    string JobTitle,
    string Department,
    DateOnly HireDate,
    string EmploymentType,
    Guid? ManagerId,
    decimal MonthlySalary,
    bool IsActive,
    string? BankName,
    string? BankAccountType,
    string? BankAccountNumber,
    string Role,
    decimal VacationAccruedDays,
    string? InitialPassword);

public sealed record PayrollAdjustment(decimal Bonus, decimal Overtime);

public sealed record CreatePayrollRunRequest(string Kind, DateOnly PayDate, IReadOnlyDictionary<Guid, PayrollAdjustment>? Adjustments);

public sealed record PayrollRunDto(
    Guid Id,
    string Kind,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    DateOnly PayDate,
    string Status,
    DateTime CreatedAt,
    DateTime? PublishedAt,
    int EmployeeCount,
    decimal TotalGross,
    decimal TotalDeductions,
    decimal TotalNet);

public sealed record PayrollRunRowDto(Guid PayslipId, Guid EmployeeId, string EmployeeName, string Department, decimal Gross, decimal Deductions, decimal Net);

public sealed record PayrollRunDetailDto(PayrollRunDto Run, IReadOnlyList<PayrollRunRowDto> Payslips);

public sealed record AnnouncementRequest(string Title, string Body, string? Department);

public sealed record AuditLogDto(
    long Id,
    DateTime At,
    string ActorName,
    string Action,
    string EntityType,
    string? EntityId,
    string? SubjectEmployeeName,
    string? Details,
    string? IpAddress);

public sealed record CountByLabelDto(string Label, int Count);

public sealed record AdminDashboardDto(
    int ActiveEmployees,
    int PendingVacations,
    int PendingLeaves,
    int PendingChangeRequests,
    int AwayToday,
    DateOnly NextPayDate,
    decimal LastPayrollNet,
    decimal MonthlyPayrollCost,
    IReadOnlyList<CountByLabelDto> HeadcountByDepartment,
    IReadOnlyList<VacationRequestDto> UpcomingVacations,
    IReadOnlyList<AuditLogDto> RecentAudit);

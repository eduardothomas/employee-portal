namespace EmployeePortal.Contracts;

public sealed record VacationBalanceDto(decimal Accrued, decimal Used, decimal Pending, decimal Available);

public sealed record HolidayDto(DateOnly Date, string Name);

public sealed record VacationRequestDto(
    Guid Id,
    string Number,
    Guid EmployeeId,
    string EmployeeName,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal Days,
    string? Comment,
    string Status,
    DateTime CreatedAt,
    DateTime? ReviewedAt,
    string? ReviewerName,
    string? ReviewComment);

public sealed record VacationsResponse(
    VacationBalanceDto Balance,
    VacationRequestDto? Upcoming,
    IReadOnlyList<VacationRequestDto> Requests,
    IReadOnlyList<HolidayDto> Holidays);

public sealed record CreateVacationRequest(DateOnly StartDate, DateOnly EndDate, string? Comment);

public sealed record VacationPreviewResponse(
    DateOnly StartDate,
    DateOnly EndDate,
    int Days,
    decimal Available,
    decimal RemainingAfter,
    IReadOnlyList<HolidayDto> HolidaysInRange,
    bool IsValid,
    string? Error);

public sealed record LeaveTypeDto(
    Guid Id,
    string Code,
    string Name,
    string Icon,
    bool IsPaid,
    bool RequiresAttachment,
    int? MaxDaysPerYear,
    bool IsActive,
    int SortOrder);

public sealed record SaveLeaveTypeRequest(
    string Code,
    string Name,
    string Icon,
    bool IsPaid,
    bool RequiresAttachment,
    int? MaxDaysPerYear,
    bool IsActive,
    int SortOrder);

public sealed record LeaveRequestDto(
    Guid Id,
    string Number,
    Guid EmployeeId,
    string EmployeeName,
    Guid LeaveTypeId,
    string LeaveTypeName,
    string LeaveTypeIcon,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal? Hours,
    string Reason,
    string Status,
    DateTime CreatedAt,
    DateTime? ReviewedAt,
    string? ReviewerName,
    string? ReviewComment);

public sealed record CreateLeaveRequest(Guid LeaveTypeId, DateOnly StartDate, DateOnly EndDate, decimal? Hours, string Reason);

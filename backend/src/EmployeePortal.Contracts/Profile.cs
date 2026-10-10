namespace EmployeePortal.Contracts;

public sealed record PersonalInfoDto(
    string FirstName,
    string LastName,
    string? PreferredName,
    string NationalIdMasked,
    DateOnly? BirthDate,
    string? PersonalEmail,
    string? Phone,
    string? Address,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    string? EmergencyContactRelationship,
    string? PhotoUrl);

public sealed record EmploymentInfoDto(
    string EmployeeCode,
    string JobTitle,
    string Department,
    DateOnly HireDate,
    string EmploymentType,
    string? ManagerName,
    decimal MonthlySalary,
    string WorkEmail);

public sealed record BankInfoDto(string? BankName, string? AccountType, string? MaskedAccount);

public sealed record MeResponse(
    Guid Id,
    string DisplayName,
    string FullName,
    string Role,
    string? PhotoUrl,
    PersonalInfoDto Personal,
    EmploymentInfoDto Employment,
    BankInfoDto Bank,
    bool BiometricEnabled,
    int UnreadNotifications);

/// <summary>Only the fields an employee is allowed to edit. Null = leave unchanged.</summary>
public sealed record UpdateProfileRequest(
    string? PreferredName,
    string? PersonalEmail,
    string? Phone,
    string? Address,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    string? EmergencyContactRelationship,
    string? PhotoUrl);

public sealed record UpdateSecurityRequest(bool BiometricEnabled);

public sealed record CreateChangeRequest(string Field, string RequestedValue, string? Reason);

public sealed record ChangeRequestDto(
    Guid Id,
    Guid EmployeeId,
    string EmployeeName,
    string Field,
    string? CurrentValue,
    string RequestedValue,
    string? Reason,
    string Status,
    DateTime CreatedAt,
    DateTime? ReviewedAt,
    string? ReviewerName,
    string? ReviewComment);

public sealed record ReviewRequest(string? Comment);

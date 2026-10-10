namespace EmployeePortal.Contracts;

/// <summary>
/// A downloadable document. <see cref="Source"/> is "document" for uploaded files and
/// "payslip" for payslip PDFs generated on demand.
/// </summary>
public sealed record DocumentDto(
    Guid Id,
    string Category,
    string Title,
    string FileName,
    string ContentType,
    long SizeBytes,
    DateTime UploadedAt,
    string Source,
    string DownloadUrl,
    Guid? EmployeeId,
    string? EmployeeName);

public sealed record NotificationDto(
    Guid Id,
    string Type,
    string Title,
    string Body,
    string? Link,
    DateTime CreatedAt,
    DateTime? ReadAt);

public sealed record RegisterDeviceRequest(string Platform, string PushToken, string? Name);

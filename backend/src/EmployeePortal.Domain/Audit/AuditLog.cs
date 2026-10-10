namespace EmployeePortal.Domain.Audit;

/// <summary>
/// Append-only trail. Answers: who changed the salary, who approved a vacation, who downloaded a document.
/// </summary>
public class AuditLog
{
    public long Id { get; set; }
    public DateTime At { get; set; } = DateTime.UtcNow;
    public Guid? ActorId { get; set; }
    public string ActorName { get; set; } = "";
    public string Action { get; set; } = "";
    public string EntityType { get; set; } = "";
    public string? EntityId { get; set; }
    public Guid? SubjectEmployeeId { get; set; }
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
}

public static class AuditActions
{
    public const string LoginSucceeded = "auth.login";
    public const string LoginFailed = "auth.login_failed";
    public const string MfaFailed = "auth.mfa_failed";
    public const string PasswordChanged = "auth.password_changed";
    public const string ProfileUpdated = "profile.updated";
    public const string ChangeRequested = "profile.change_requested";
    public const string ChangeApproved = "profile.change_approved";
    public const string ChangeRejected = "profile.change_rejected";
    public const string EmployeeCreated = "employee.created";
    public const string EmployeeUpdated = "employee.updated";
    public const string SalaryChanged = "employee.salary_changed";
    public const string VacationRequested = "vacation.requested";
    public const string VacationApproved = "vacation.approved";
    public const string VacationRejected = "vacation.rejected";
    public const string VacationCancelled = "vacation.cancelled";
    public const string LeaveRequested = "leave.requested";
    public const string LeaveApproved = "leave.approved";
    public const string LeaveRejected = "leave.rejected";
    public const string LeaveCancelled = "leave.cancelled";
    public const string LeaveTypeSaved = "leave_type.saved";
    public const string DocumentUploaded = "document.uploaded";
    public const string DocumentDownloaded = "document.downloaded";
    public const string DocumentDeleted = "document.deleted";
    public const string PayslipViewed = "payslip.viewed";
    public const string PayslipDownloaded = "payslip.downloaded";
    public const string PayrollRunCreated = "payroll.run_created";
    public const string PayrollRunPublished = "payroll.run_published";
    public const string AnnouncementSent = "announcement.sent";
}

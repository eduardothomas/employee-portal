using EmployeePortal.Domain.Audit;
using EmployeePortal.Domain.Documents;
using EmployeePortal.Domain.Employees;
using EmployeePortal.Domain.Notifications;
using EmployeePortal.Domain.Payroll;
using EmployeePortal.Domain.Security;
using EmployeePortal.Domain.Time;
using Microsoft.EntityFrameworkCore;

namespace EmployeePortal.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<Employee> Employees { get; }
    DbSet<RecurringDeduction> RecurringDeductions { get; }
    DbSet<ChangeRequest> ChangeRequests { get; }
    DbSet<PayrollRun> PayrollRuns { get; }
    DbSet<Payslip> Payslips { get; }
    DbSet<PayslipLine> PayslipLines { get; }
    DbSet<VacationRequest> VacationRequests { get; }
    DbSet<LeaveType> LeaveTypes { get; }
    DbSet<LeaveRequest> LeaveRequests { get; }
    DbSet<Document> Documents { get; }
    DbSet<DocumentFile> DocumentFiles { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<Device> Devices { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<MfaChallenge> MfaChallenges { get; }
    DbSet<RefreshToken> RefreshTokens { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
}

public interface ICurrentUser
{
    bool IsAuthenticated { get; }
    Guid Id { get; }
    string Name { get; }
    Role Role { get; }
    string? IpAddress { get; }
}

public interface IClock
{
    DateTime UtcNow { get; }

    /// <summary>Today's date in the company's time zone (America/Panama).</summary>
    DateOnly Today { get; }
}

public interface IPasswordService
{
    string Hash(string password);
    bool Verify(string hash, string password);
}

public interface ITokenService
{
    (string Token, DateTime ExpiresAt) CreateAccessToken(Employee employee);
    string CreateRefreshToken();
    string HashToken(string value);
}

/// <summary>Delivers MFA codes (SMS/email in production, log in development).</summary>
public interface IMfaCodeSender
{
    Task SendAsync(Employee employee, string code, CancellationToken ct);
}

public interface IPdfRenderer
{
    byte[] RenderPayslip(Contracts.PayslipDetailDto payslip);
}

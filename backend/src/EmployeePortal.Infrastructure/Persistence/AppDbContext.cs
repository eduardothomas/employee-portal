using EmployeePortal.Application.Abstractions;
using EmployeePortal.Domain.Audit;
using EmployeePortal.Domain.Documents;
using EmployeePortal.Domain.Employees;
using EmployeePortal.Domain.Notifications;
using EmployeePortal.Domain.Payroll;
using EmployeePortal.Domain.Security;
using EmployeePortal.Domain.Time;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace EmployeePortal.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IAppDbContext
{
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<RecurringDeduction> RecurringDeductions => Set<RecurringDeduction>();
    public DbSet<ChangeRequest> ChangeRequests => Set<ChangeRequest>();
    public DbSet<PayrollRun> PayrollRuns => Set<PayrollRun>();
    public DbSet<Payslip> Payslips => Set<Payslip>();
    public DbSet<PayslipLine> PayslipLines => Set<PayslipLine>();
    public DbSet<VacationRequest> VacationRequests => Set<VacationRequest>();
    public DbSet<LeaveType> LeaveTypes => Set<LeaveType>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<DocumentFile> DocumentFiles => Set<DocumentFile>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<MfaChallenge> MfaChallenges => Set<MfaChallenge>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void ConfigureConventions(ModelConfigurationBuilder builder)
    {
        builder.Properties<decimal>().HavePrecision(12, 2);
        builder.Properties<string>().HaveMaxLength(300);
        // Every DateTime is stored and returned as UTC (SQLite drops the Kind otherwise).
        builder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Employee>(e =>
        {
            e.HasIndex(x => x.EmployeeCode).IsUnique();
            e.HasIndex(x => x.WorkEmail).IsUnique();
            e.HasIndex(x => x.ManagerId);
            e.Property(x => x.EmployeeCode).HasMaxLength(20);
            e.Property(x => x.PasswordHash).HasMaxLength(500);
            e.Property(x => x.PhotoUrl).HasMaxLength(300_000);
            e.Property(x => x.Role).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.EmploymentType).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.VacationAccruedDays).HasPrecision(6, 2);
            e.HasOne(x => x.Manager).WithMany().HasForeignKey(x => x.ManagerId).OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.RecurringDeductions).WithOne().HasForeignKey(x => x.EmployeeId).OnDelete(DeleteBehavior.Cascade);
            e.Ignore(x => x.DisplayName);
            e.Ignore(x => x.FullName);
            e.Ignore(x => x.MaskedBankAccount);
        });

        b.Entity<ChangeRequest>(e =>
        {
            e.HasIndex(x => new { x.EmployeeId, x.Status });
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Reason).HasMaxLength(1000);
            e.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeId);
        });

        b.Entity<PayrollRun>(e =>
        {
            e.HasIndex(x => new { x.Kind, x.PayDate }).IsUnique();
            e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.HasMany(x => x.Payslips).WithOne().HasForeignKey(x => x.PayrollRunId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Payslip>(e =>
        {
            e.HasIndex(x => new { x.EmployeeId, x.PayDate });
            e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(20);
            e.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeId);
            e.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.PayslipId).OnDelete(DeleteBehavior.Cascade);
            e.Ignore(x => x.Gross);
            e.Ignore(x => x.TotalDeductions);
            e.Ignore(x => x.Net);
            e.Ignore(x => x.Number);
        });

        b.Entity<PayslipLine>(e =>
        {
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Code).HasMaxLength(20);
        });

        b.Entity<VacationRequest>(e =>
        {
            e.HasIndex(x => x.Number).IsUnique();
            e.HasIndex(x => new { x.EmployeeId, x.Status });
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Days).HasPrecision(6, 2);
            e.Property(x => x.Comment).HasMaxLength(1000);
            e.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeId);
        });

        b.Entity<LeaveType>(e => e.HasIndex(x => x.Code).IsUnique());

        b.Entity<LeaveRequest>(e =>
        {
            e.HasIndex(x => x.Number).IsUnique();
            e.HasIndex(x => new { x.EmployeeId, x.Status });
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Hours).HasPrecision(4, 1);
            e.Property(x => x.Reason).HasMaxLength(1000);
            e.HasOne(x => x.LeaveType).WithMany().HasForeignKey(x => x.LeaveTypeId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeId);
        });

        b.Entity<Document>(e =>
        {
            e.HasIndex(x => x.EmployeeId);
            e.Property(x => x.Category).HasConversion<string>().HasMaxLength(20);
            e.HasOne(x => x.File).WithOne().HasForeignKey<DocumentFile>(f => f.DocumentId).OnDelete(DeleteBehavior.Cascade);
        });
        b.Entity<DocumentFile>(e => e.HasKey(x => x.DocumentId));

        b.Entity<Notification>(e =>
        {
            e.HasIndex(x => new { x.EmployeeId, x.CreatedAt });
            e.Property(x => x.Type).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Body).HasMaxLength(2000);
        });

        b.Entity<Device>(e =>
        {
            e.HasIndex(x => x.PushToken).IsUnique();
            e.Property(x => x.PushToken).HasMaxLength(2000);
        });

        b.Entity<AuditLog>(e =>
        {
            e.HasIndex(x => x.At);
            e.HasIndex(x => x.SubjectEmployeeId);
            e.HasIndex(x => x.Action);
            e.Property(x => x.Details).HasMaxLength(4000);
        });

        b.Entity<MfaChallenge>(e => e.HasIndex(x => x.EmployeeId));
        b.Entity<RefreshToken>(e => e.HasIndex(x => x.TokenHash).IsUnique());
    }
}

internal sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
    v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
    v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

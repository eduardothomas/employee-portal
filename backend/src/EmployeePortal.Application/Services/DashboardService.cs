using EmployeePortal.Application.Abstractions;
using EmployeePortal.Application.Common;
using EmployeePortal.Contracts;
using EmployeePortal.Domain.Common;
using EmployeePortal.Domain.Employees;
using EmployeePortal.Domain.Notifications;
using EmployeePortal.Domain.Payroll;
using Microsoft.EntityFrameworkCore;

namespace EmployeePortal.Application.Services;

/// <summary>Home screen aggregate — one round trip for everything the employee sees first.</summary>
public sealed class DashboardService(IAppDbContext db, ICurrentUser user, IClock clock, ApprovalService approvals)
{
    public async Task<DashboardResponse> GetAsync(CancellationToken ct)
    {
        var employee = await db.Employees.Include(e => e.RecurringDeductions).FirstAsync(e => e.Id == user.Id, ct);
        var vacation = await TimeOffService.GetBalanceAsync(db, user.Id, ct);

        var pending = await db.VacationRequests.CountAsync(v => v.EmployeeId == user.Id && v.Status == RequestStatus.Pending, ct)
                    + await db.LeaveRequests.CountAsync(l => l.EmployeeId == user.Id && l.Status == RequestStatus.Pending, ct);
        var unread = await db.Notifications.CountAsync(n => n.EmployeeId == user.Id && n.ReadAt == null, ct);

        var recent = await db.Notifications.Where(n => n.EmployeeId == user.Id)
            .OrderByDescending(n => n.CreatedAt).Take(5).ToListAsync(ct);

        var activity = recent.Select(n => new ActivityItemDto(n.Type.ToApi(), Icon(n.Type), n.Title, n.Body, n.CreatedAt, n.Link)).ToList();

        return new DashboardResponse(
            employee.DisplayName,
            new NextPayDto(PayCalendar.NextPayDate(clock.Today), PayrollService.EstimateNextNet(employee)),
            vacation,
            pending,
            unread,
            employee.Role != Role.Employee,
            await approvals.CountPendingAsync(ct),
            activity);
    }

    public static string Icon(NotificationType type) => type switch
    {
        NotificationType.Payslip => "💰",
        NotificationType.Vacation => "🏖️",
        NotificationType.Leave => "📝",
        NotificationType.Document => "📄",
        NotificationType.Profile => "👤",
        NotificationType.Announcement => "📣",
        _ => "🔔"
    };
}

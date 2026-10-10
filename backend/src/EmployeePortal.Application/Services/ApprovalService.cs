using EmployeePortal.Application.Abstractions;
using EmployeePortal.Application.Common;
using EmployeePortal.Contracts;
using EmployeePortal.Domain.Audit;
using EmployeePortal.Domain.Common;
using EmployeePortal.Domain.Employees;
using EmployeePortal.Domain.Notifications;
using EmployeePortal.Domain.Time;
using Microsoft.EntityFrameworkCore;

namespace EmployeePortal.Application.Services;

/// <summary>
/// Manager and HR decisions. Managers see their direct reports; HR/Admin sees everybody.
/// </summary>
public sealed class ApprovalService(IAppDbContext db, ICurrentUser user, IClock clock, AuditTrail audit, Notifier notifier)
{
    private IQueryable<Guid> ScopeEmployeeIds =>
        user.Role == Role.HrAdmin
            ? db.Employees.Select(e => e.Id)
            : db.Employees.Where(e => e.ManagerId == user.Id).Select(e => e.Id);

    public async Task<IReadOnlyList<TeamMemberDto>> GetTeamAsync(CancellationToken ct)
    {
        var team = await db.Employees.Where(e => e.ManagerId == user.Id && e.IsActive).OrderBy(e => e.FirstName).ToListAsync(ct);
        var ids = team.Select(t => t.Id).ToList();
        var today = clock.Today;

        var vacations = await db.VacationRequests.Where(v => ids.Contains(v.EmployeeId)
            && (v.Status == RequestStatus.Approved || v.Status == RequestStatus.Pending)).ToListAsync(ct);
        var leaves = await db.LeaveRequests.Include(l => l.LeaveType).Where(l => ids.Contains(l.EmployeeId)
            && (l.Status == RequestStatus.Approved || l.Status == RequestStatus.Pending)).ToListAsync(ct);

        return team.Select(e =>
        {
            var used = vacations.Where(v => v.EmployeeId == e.Id && v.Status == RequestStatus.Approved).Sum(v => v.Days);
            var pendingDays = vacations.Where(v => v.EmployeeId == e.Id && v.Status == RequestStatus.Pending).Sum(v => v.Days);
            string? away =
                vacations.Any(v => v.EmployeeId == e.Id && v.Status == RequestStatus.Approved && v.StartDate <= today && v.EndDate >= today) ? "Vacaciones"
                : leaves.FirstOrDefault(l => l.EmployeeId == e.Id && l.Status == RequestStatus.Approved && l.StartDate <= today && l.EndDate >= today)?.LeaveType?.Name;
            var pending = vacations.Count(v => v.EmployeeId == e.Id && v.Status == RequestStatus.Pending)
                          + leaves.Count(l => l.EmployeeId == e.Id && l.Status == RequestStatus.Pending);
            return new TeamMemberDto(e.Id, e.EmployeeCode, e.FullName, e.JobTitle, e.Department, e.PhotoUrl,
                e.VacationAccruedDays - used - pendingDays, away, pending);
        }).ToList();
    }

    public async Task<ApprovalsResponse> GetPendingAsync(CancellationToken ct)
    {
        var scope = ScopeEmployeeIds;
        var vacations = await db.VacationRequests
            .Where(v => v.Status == RequestStatus.Pending && v.EmployeeId != user.Id && scope.Contains(v.EmployeeId))
            .OrderBy(v => v.StartDate).ToListAsync(ct);
        var leaves = await db.LeaveRequests.Include(l => l.LeaveType)
            .Where(l => l.Status == RequestStatus.Pending && l.EmployeeId != user.Id && scope.Contains(l.EmployeeId))
            .OrderBy(l => l.StartDate).ToListAsync(ct);

        var names = await db.NamesAsync(vacations.Select(v => (Guid?)v.EmployeeId).Concat(leaves.Select(l => (Guid?)l.EmployeeId)), ct);
        return new ApprovalsResponse(vacations.Select(v => v.ToDto(names)).ToList(), leaves.Select(l => l.ToDto(names)).ToList());
    }

    public async Task<int> CountPendingAsync(CancellationToken ct)
    {
        if (user.Role == Role.Employee) return 0;
        var scope = ScopeEmployeeIds;
        return await db.VacationRequests.CountAsync(v => v.Status == RequestStatus.Pending && v.EmployeeId != user.Id && scope.Contains(v.EmployeeId), ct)
             + await db.LeaveRequests.CountAsync(l => l.Status == RequestStatus.Pending && l.EmployeeId != user.Id && scope.Contains(l.EmployeeId), ct);
    }

    public async Task<IReadOnlyList<VacationRequestDto>> GetVacationsAsync(string? status, CancellationToken ct)
    {
        var scope = ScopeEmployeeIds;
        var query = db.VacationRequests.Where(v => scope.Contains(v.EmployeeId));
        if (!string.IsNullOrEmpty(status))
        {
            var parsed = Mapping.ParseEnum<RequestStatus>(status, "status");
            query = query.Where(v => v.Status == parsed);
        }
        var list = await query.OrderByDescending(v => v.StartDate).Take(500).ToListAsync(ct);
        var names = await db.NamesAsync(list, ct);
        return list.Select(v => v.ToDto(names)).ToList();
    }

    public async Task<IReadOnlyList<LeaveRequestDto>> GetLeavesAsync(string? status, CancellationToken ct)
    {
        var scope = ScopeEmployeeIds;
        var query = db.LeaveRequests.Include(l => l.LeaveType).Where(l => scope.Contains(l.EmployeeId));
        if (!string.IsNullOrEmpty(status))
        {
            var parsed = Mapping.ParseEnum<RequestStatus>(status, "status");
            query = query.Where(l => l.Status == parsed);
        }
        var list = await query.OrderByDescending(l => l.StartDate).Take(500).ToListAsync(ct);
        var names = await db.NamesAsync(list, ct);
        return list.Select(l => l.ToDto(names)).ToList();
    }

    public async Task DecideVacationAsync(Guid id, bool approve, ReviewRequest review, CancellationToken ct)
    {
        var request = await db.VacationRequests.FirstOrDefaultAsync(v => v.Id == id, ct) ?? throw new NotFoundException();
        await EnsureCanReviewAsync(request.EmployeeId, ct);

        if (approve)
        {
            var balance = await TimeOffService.GetBalanceAsync(db, request.EmployeeId, ct);
            // Pending already includes this request, so available must not be negative.
            if (balance.Available < 0) throw new DomainException("El empleado no tiene días suficientes.");
            request.Approve(user.Id, review.Comment, clock.UtcNow);
        }
        else request.Reject(user.Id, review.Comment, clock.UtcNow);

        audit.Record(approve ? AuditActions.VacationApproved : AuditActions.VacationRejected, nameof(VacationRequest),
            request.Id, request.EmployeeId, new { request.Number, review.Comment });
        notifier.Notify(request.EmployeeId, NotificationType.Vacation,
            approve ? "Vacaciones aprobadas" : "Vacaciones rechazadas",
            $"Tu solicitud {request.Number} ({request.StartDate:dd/MM} – {request.EndDate:dd/MM}) fue {(approve ? "aprobada" : "rechazada")}."
            + (string.IsNullOrWhiteSpace(review.Comment) ? "" : $" Comentario: {review.Comment}"),
            "/time/vacations");
        await db.SaveChangesAsync(ct);
    }

    public async Task DecideLeaveAsync(Guid id, bool approve, ReviewRequest review, CancellationToken ct)
    {
        var request = await db.LeaveRequests.Include(l => l.LeaveType).FirstOrDefaultAsync(l => l.Id == id, ct) ?? throw new NotFoundException();
        await EnsureCanReviewAsync(request.EmployeeId, ct);

        if (approve) request.Approve(user.Id, review.Comment, clock.UtcNow);
        else request.Reject(user.Id, review.Comment, clock.UtcNow);

        audit.Record(approve ? AuditActions.LeaveApproved : AuditActions.LeaveRejected, nameof(LeaveRequest),
            request.Id, request.EmployeeId, new { request.Number, review.Comment });
        notifier.Notify(request.EmployeeId, NotificationType.Leave,
            approve ? "Permiso aprobado" : "Permiso rechazado",
            $"Tu permiso {request.LeaveType?.Name} del {request.StartDate:dd/MM} fue {(approve ? "aprobado" : "rechazado")}.",
            "/time/leave");
        await db.SaveChangesAsync(ct);
    }

    // ── Profile change requests (HR only) ────────────────────────────

    public async Task<IReadOnlyList<ChangeRequestDto>> GetChangeRequestsAsync(string? status, CancellationToken ct)
    {
        var query = db.ChangeRequests.AsQueryable();
        if (!string.IsNullOrEmpty(status))
        {
            var parsed = Mapping.ParseEnum<RequestStatus>(status, "status");
            query = query.Where(c => c.Status == parsed);
        }
        var list = await query.OrderByDescending(c => c.CreatedAt).Take(500).ToListAsync(ct);
        var names = await db.NamesAsync(list, ct);
        return list.Select(c => c.ToDto(names)).ToList();
    }

    /// <summary>
    /// Approving marks the request as accepted; HR then applies the actual value in the employee record
    /// (so salary/bank changes always go through the audited admin update path).
    /// </summary>
    public async Task DecideChangeRequestAsync(Guid id, bool approve, ReviewRequest review, CancellationToken ct)
    {
        var request = await db.ChangeRequests.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw new NotFoundException();
        if (approve) request.Approve(user.Id, review.Comment, clock.UtcNow);
        else request.Reject(user.Id, review.Comment, clock.UtcNow);

        var label = ProfileService.RestrictedFields.GetValueOrDefault(request.Field, request.Field);
        audit.Record(approve ? AuditActions.ChangeApproved : AuditActions.ChangeRejected, nameof(ChangeRequest),
            request.Id, request.EmployeeId, new { request.Field, request.RequestedValue, review.Comment });
        notifier.Notify(request.EmployeeId, NotificationType.Profile,
            approve ? "Solicitud de cambio aprobada" : "Solicitud de cambio rechazada",
            $"Tu solicitud para modificar «{label}» fue {(approve ? "aprobada" : "rechazada")}."
            + (string.IsNullOrWhiteSpace(review.Comment) ? "" : $" {review.Comment}"),
            "/me");
        await db.SaveChangesAsync(ct);
    }

    private async Task EnsureCanReviewAsync(Guid employeeId, CancellationToken ct)
    {
        if (employeeId == user.Id) throw new ForbiddenException("No puedes aprobar tus propias solicitudes.");
        if (user.Role == Role.HrAdmin) return;
        var isReport = await db.Employees.AnyAsync(e => e.Id == employeeId && e.ManagerId == user.Id, ct);
        if (!isReport) throw new ForbiddenException("Solo puedes gestionar solicitudes de tu equipo.");
    }
}

using EmployeePortal.Application.Abstractions;
using EmployeePortal.Application.Common;
using EmployeePortal.Contracts;
using EmployeePortal.Domain.Audit;
using EmployeePortal.Domain.Common;
using EmployeePortal.Domain.Notifications;
using EmployeePortal.Domain.Time;
using Microsoft.EntityFrameworkCore;

namespace EmployeePortal.Application.Services;

/// <summary>Vacations and leave (permisos) for the current employee.</summary>
public sealed class TimeOffService(IAppDbContext db, ICurrentUser user, IClock clock, AuditTrail audit, Notifier notifier)
{
    public static async Task<VacationBalanceDto> GetBalanceAsync(IAppDbContext db, Guid employeeId, CancellationToken ct)
    {
        var accrued = await db.Employees.Where(e => e.Id == employeeId).Select(e => e.VacationAccruedDays).FirstAsync(ct);
        var requests = await db.VacationRequests
            .Where(v => v.EmployeeId == employeeId && (v.Status == RequestStatus.Approved || v.Status == RequestStatus.Pending))
            .Select(v => new { v.Status, v.Days })
            .ToListAsync(ct);
        var used = requests.Where(r => r.Status == RequestStatus.Approved).Sum(r => r.Days);
        var pending = requests.Where(r => r.Status == RequestStatus.Pending).Sum(r => r.Days);
        return new VacationBalanceDto(accrued, used, pending, accrued - used - pending);
    }

    public async Task<VacationsResponse> GetVacationsAsync(CancellationToken ct)
    {
        var balance = await GetBalanceAsync(db, user.Id, ct);
        var requests = await db.VacationRequests.Where(v => v.EmployeeId == user.Id).OrderByDescending(v => v.StartDate).ToListAsync(ct);
        var names = await db.NamesAsync(requests, ct);
        var today = clock.Today;

        var upcoming = requests
            .Where(v => v.EndDate >= today && v.Status is RequestStatus.Approved or RequestStatus.Pending)
            .OrderBy(v => v.StartDate)
            .FirstOrDefault();

        var holidays = WorkCalendar.PanamaHolidays(today.Year).Concat(WorkCalendar.PanamaHolidays(today.Year + 1))
            .Select(h => new HolidayDto(h.Date, h.Name)).ToList();

        return new VacationsResponse(balance, upcoming?.ToDto(names), requests.Select(r => r.ToDto(names)).ToList(), holidays);
    }

    public async Task<VacationPreviewResponse> PreviewAsync(DateOnly start, DateOnly end, CancellationToken ct)
    {
        var balance = await GetBalanceAsync(db, user.Id, ct);
        var error = await ValidateVacationAsync(start, end, balance.Available, ct);
        var days = WorkCalendar.WorkingDays(start, end);
        var holidays = Enumerable.Range(start.Year, Math.Max(1, end.Year - start.Year + 1))
            .SelectMany(WorkCalendar.PanamaHolidays)
            .Where(h => h.Date >= start && h.Date <= end)
            .Select(h => new HolidayDto(h.Date, h.Name))
            .ToList();
        return new VacationPreviewResponse(start, end, days, balance.Available, balance.Available - days, holidays, error is null, error);
    }

    public async Task<VacationRequestDto> RequestVacationAsync(CreateVacationRequest r, CancellationToken ct)
    {
        var balance = await GetBalanceAsync(db, user.Id, ct);
        var error = await ValidateVacationAsync(r.StartDate, r.EndDate, balance.Available, ct);
        if (error is not null) throw ValidationException.For("startDate", error);
        new Validator().MaxLength(r.Comment, 1000, "comment").ThrowIfInvalid();

        var year = r.StartDate.Year;
        var numbers = await db.VacationRequests.Where(v => v.Number.StartsWith($"VAC-{year}-")).Select(v => v.Number).ToListAsync(ct);
        var request = new VacationRequest
        {
            EmployeeId = user.Id,
            Number = QueryHelpers.NextNumber(numbers, "VAC", year),
            StartDate = r.StartDate,
            EndDate = r.EndDate,
            Days = WorkCalendar.WorkingDays(r.StartDate, r.EndDate),
            Comment = string.IsNullOrWhiteSpace(r.Comment) ? null : r.Comment.Trim(),
            CreatedAt = clock.UtcNow
        };
        db.VacationRequests.Add(request);
        audit.Record(AuditActions.VacationRequested, nameof(VacationRequest), request.Id, user.Id,
            new { request.Number, request.StartDate, request.EndDate, request.Days });
        await NotifyManagerAsync($"Nueva solicitud de vacaciones", $"{user.Name} solicitó {request.Days} días ({request.StartDate:dd/MM} – {request.EndDate:dd/MM}).", ct);
        await db.SaveChangesAsync(ct);
        return request.ToDto(new Dictionary<Guid, string> { [user.Id] = user.Name });
    }

    public async Task CancelVacationAsync(Guid id, CancellationToken ct)
    {
        var request = await db.VacationRequests.FirstOrDefaultAsync(v => v.Id == id && v.EmployeeId == user.Id, ct)
            ?? throw new NotFoundException();
        request.Cancel(clock.UtcNow);
        audit.Record(AuditActions.VacationCancelled, nameof(VacationRequest), request.Id, user.Id);
        await db.SaveChangesAsync(ct);
    }

    private async Task<string?> ValidateVacationAsync(DateOnly start, DateOnly end, decimal available, CancellationToken ct)
    {
        if (end < start) return "La fecha final debe ser posterior a la inicial.";
        if (start < clock.Today) return "No puedes solicitar vacaciones en fechas pasadas.";
        if (end.DayNumber - start.DayNumber > 60) return "El rango máximo por solicitud es de 60 días.";
        var days = WorkCalendar.WorkingDays(start, end);
        if (days == 0) return "El rango seleccionado no incluye días laborables.";
        if (days > available) return $"Solo tienes {available:0.#} días disponibles.";

        var overlaps = await db.VacationRequests.AnyAsync(v => v.EmployeeId == user.Id
            && (v.Status == RequestStatus.Pending || v.Status == RequestStatus.Approved)
            && v.StartDate <= end && v.EndDate >= start, ct);
        return overlaps ? "Ya tienes vacaciones solicitadas en esas fechas." : null;
    }

    // ── Leave (permisos) ─────────────────────────────────────────────

    public async Task<IReadOnlyList<LeaveTypeDto>> GetLeaveTypesAsync(bool includeInactive, CancellationToken ct)
    {
        var query = db.LeaveTypes.AsQueryable();
        if (!includeInactive) query = query.Where(t => t.IsActive);
        var list = await query.OrderBy(t => t.SortOrder).ThenBy(t => t.Name).ToListAsync(ct);
        return list.Select(t => t.ToDto()).ToList();
    }

    public async Task<IReadOnlyList<LeaveRequestDto>> GetMyLeaveRequestsAsync(CancellationToken ct)
    {
        var list = await db.LeaveRequests.Include(l => l.LeaveType).Where(l => l.EmployeeId == user.Id)
            .OrderByDescending(l => l.StartDate).ToListAsync(ct);
        var names = await db.NamesAsync(list, ct);
        return list.Select(l => l.ToDto(names)).ToList();
    }

    public async Task<LeaveRequestDto> RequestLeaveAsync(CreateLeaveRequest r, CancellationToken ct)
    {
        var type = await db.LeaveTypes.FirstOrDefaultAsync(t => t.Id == r.LeaveTypeId && t.IsActive, ct);
        var v = new Validator()
            .When(type is null, "leaveTypeId", "Selecciona un tipo de permiso válido.")
            .When(r.EndDate < r.StartDate, "endDate", "La fecha final debe ser posterior a la inicial.")
            .When(r.Hours is not null && r.StartDate != r.EndDate, "hours", "Los permisos por horas deben ser de un solo día.")
            .When(r.Hours is <= 0 or > 8, "hours", "Las horas deben estar entre 0.5 y 8.")
            .Require(r.Reason, "reason", "Describe brevemente el motivo.")
            .MaxLength(r.Reason, 1000, "reason");

        if (type?.MaxDaysPerYear is { } max)
        {
            var year = r.StartDate.Year;
            var taken = await db.LeaveRequests.Where(l => l.EmployeeId == user.Id && l.LeaveTypeId == type.Id
                    && l.Status != RequestStatus.Rejected && l.Status != RequestStatus.Cancelled
                    && l.StartDate >= new DateOnly(year, 1, 1) && l.StartDate <= new DateOnly(year, 12, 31))
                .Select(l => new { l.StartDate, l.EndDate }).ToListAsync(ct);
            var used = taken.Sum(t => WorkCalendar.WorkingDays(t.StartDate, t.EndDate));
            var requested = WorkCalendar.WorkingDays(r.StartDate, r.EndDate);
            v.When(used + requested > max, "endDate", $"Este tipo de permiso permite {max} días por año (ya usaste {used}).");
        }
        v.ThrowIfInvalid();

        var numbers = await db.LeaveRequests.Where(l => l.Number.StartsWith($"PER-{r.StartDate.Year}-")).Select(l => l.Number).ToListAsync(ct);
        var request = new LeaveRequest
        {
            EmployeeId = user.Id,
            Number = QueryHelpers.NextNumber(numbers, "PER", r.StartDate.Year),
            LeaveTypeId = type!.Id,
            LeaveType = type,
            StartDate = r.StartDate,
            EndDate = r.EndDate,
            Hours = r.Hours,
            Reason = r.Reason.Trim(),
            CreatedAt = clock.UtcNow
        };
        db.LeaveRequests.Add(request);
        audit.Record(AuditActions.LeaveRequested, nameof(LeaveRequest), request.Id, user.Id, new { request.Number, type.Code });
        await NotifyManagerAsync("Nueva solicitud de permiso", $"{user.Name} solicitó un permiso ({type.Name}) para el {request.StartDate:dd/MM}.", ct);
        await db.SaveChangesAsync(ct);
        return request.ToDto(new Dictionary<Guid, string> { [user.Id] = user.Name });
    }

    public async Task CancelLeaveAsync(Guid id, CancellationToken ct)
    {
        var request = await db.LeaveRequests.FirstOrDefaultAsync(l => l.Id == id && l.EmployeeId == user.Id, ct)
            ?? throw new NotFoundException();
        request.Cancel(clock.UtcNow);
        audit.Record(AuditActions.LeaveCancelled, nameof(LeaveRequest), request.Id, user.Id);
        await db.SaveChangesAsync(ct);
    }

    private async Task NotifyManagerAsync(string title, string body, CancellationToken ct)
    {
        var managerId = await db.Employees.Where(e => e.Id == user.Id).Select(e => e.ManagerId).FirstAsync(ct);
        if (managerId is { } id) notifier.Notify(id, NotificationType.General, title, body, "/approvals");
    }
}

using EmployeePortal.Application.Abstractions;
using EmployeePortal.Application.Common;
using EmployeePortal.Contracts;
using EmployeePortal.Domain.Audit;
using EmployeePortal.Domain.Notifications;
using Microsoft.EntityFrameworkCore;

namespace EmployeePortal.Application.Services;

public sealed class NotificationService(IAppDbContext db, ICurrentUser user, IClock clock, AuditTrail audit, Notifier notifier)
{
    public async Task<IReadOnlyList<NotificationDto>> GetMineAsync(CancellationToken ct)
    {
        var list = await db.Notifications.Where(n => n.EmployeeId == user.Id)
            .OrderByDescending(n => n.CreatedAt).Take(100).ToListAsync(ct);
        return list.Select(n => n.ToDto()).ToList();
    }

    public async Task MarkReadAsync(Guid id, CancellationToken ct)
    {
        var n = await db.Notifications.FirstOrDefaultAsync(x => x.Id == id && x.EmployeeId == user.Id, ct) ?? throw new NotFoundException();
        n.ReadAt ??= clock.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task MarkAllReadAsync(CancellationToken ct)
    {
        var unread = await db.Notifications.Where(n => n.EmployeeId == user.Id && n.ReadAt == null).ToListAsync(ct);
        foreach (var n in unread) n.ReadAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Registers a device for push notifications (idempotent per token).</summary>
    public async Task RegisterDeviceAsync(RegisterDeviceRequest r, CancellationToken ct)
    {
        new Validator().Require(r.PushToken, "pushToken").MaxLength(r.PushToken, 2000, "pushToken").ThrowIfInvalid();
        var device = await db.Devices.FirstOrDefaultAsync(d => d.PushToken == r.PushToken, ct);
        if (device is null)
        {
            db.Devices.Add(new Device { EmployeeId = user.Id, Platform = r.Platform, PushToken = r.PushToken, Name = r.Name });
        }
        else
        {
            device.EmployeeId = user.Id;
            device.LastSeenAt = clock.UtcNow;
        }
        await db.SaveChangesAsync(ct);
    }

    public async Task<int> SendAnnouncementAsync(AnnouncementRequest r, CancellationToken ct)
    {
        new Validator().Require(r.Title, "title").MaxLength(r.Title, 120, "title")
            .Require(r.Body, "body").MaxLength(r.Body, 2000, "body").ThrowIfInvalid();

        var query = db.Employees.Where(e => e.IsActive);
        if (!string.IsNullOrWhiteSpace(r.Department)) query = query.Where(e => e.Department == r.Department);
        var ids = await query.Select(e => e.Id).ToListAsync(ct);

        foreach (var id in ids) notifier.Notify(id, NotificationType.Announcement, r.Title.Trim(), r.Body.Trim());
        audit.Record(AuditActions.AnnouncementSent, "Announcement", null, null, new { r.Title, r.Department, recipients = ids.Count });
        await db.SaveChangesAsync(ct);
        return ids.Count;
    }
}

using EmployeePortal.Application.Abstractions;
using EmployeePortal.Domain.Audit;
using EmployeePortal.Domain.Common;
using EmployeePortal.Domain.Employees;
using EmployeePortal.Domain.Notifications;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace EmployeePortal.Application.Common;

/// <summary>Records audit entries in the same unit of work as the change being audited.</summary>
public sealed class AuditTrail(IAppDbContext db, ICurrentUser user, IClock clock)
{
    public void Record(string action, string entityType, object? entityId = null, Guid? subjectEmployeeId = null, object? details = null)
    {
        db.AuditLogs.Add(new AuditLog
        {
            At = clock.UtcNow,
            ActorId = user.IsAuthenticated ? user.Id : null,
            ActorName = user.IsAuthenticated ? user.Name : "system",
            Action = action,
            EntityType = entityType,
            EntityId = entityId?.ToString(),
            SubjectEmployeeId = subjectEmployeeId,
            Details = details is null ? null : details as string ?? JsonSerializer.Serialize(details),
            IpAddress = user.IpAddress
        });
    }

    /// <summary>For flows where nobody is authenticated yet (login).</summary>
    public void RecordFor(Employee? actor, string action, string? details = null)
    {
        db.AuditLogs.Add(new AuditLog
        {
            At = clock.UtcNow,
            ActorId = actor?.Id,
            ActorName = actor?.FullName ?? "anonymous",
            Action = action,
            EntityType = nameof(Employee),
            EntityId = actor?.Id.ToString(),
            SubjectEmployeeId = actor?.Id,
            Details = details,
            IpAddress = user.IpAddress
        });
    }
}

public sealed class Notifier(IAppDbContext db, IClock clock)
{
    public void Notify(Guid employeeId, NotificationType type, string title, string body, string? link = null) =>
        db.Notifications.Add(new Notification
        {
            EmployeeId = employeeId,
            Type = type,
            Title = title,
            Body = body,
            Link = link,
            CreatedAt = clock.UtcNow
        });
}

public static class QueryHelpers
{
    public static async Task<Dictionary<Guid, string>> NamesAsync(this IAppDbContext db, IEnumerable<Guid?> ids, CancellationToken ct)
    {
        var set = ids.Where(i => i.HasValue).Select(i => i!.Value).Distinct().ToList();
        if (set.Count == 0) return [];
        return await db.Employees.Where(e => set.Contains(e.Id))
            .Select(e => new { e.Id, e.FirstName, e.LastName })
            .ToDictionaryAsync(e => e.Id, e => e.FirstName + " " + e.LastName, ct);
    }

    public static Task<Dictionary<Guid, string>> NamesAsync<T>(this IAppDbContext db, IEnumerable<T> requests, CancellationToken ct)
        where T : ReviewableRequest =>
        db.NamesAsync(requests.SelectMany(r => new Guid?[] { r.EmployeeId, r.ReviewedById }), ct);

    /// <summary>Generates sequential, human-friendly numbers such as VAC-2026-00142.</summary>
    public static string NextNumber(IEnumerable<string> existingNumbers, string prefix, int year)
    {
        var head = $"{prefix}-{year}-";
        var max = existingNumbers
            .Where(n => n.StartsWith(head, StringComparison.Ordinal))
            .Select(n => int.TryParse(n[head.Length..], out var v) ? v : 0)
            .DefaultIfEmpty(100)
            .Max();
        return $"{head}{max + 1:D5}";
    }

    public static async Task<Employee> GetEmployeeAsync(this IAppDbContext db, Guid id, CancellationToken ct) =>
        await db.Employees.FirstOrDefaultAsync(e => e.Id == id, ct) ?? throw new NotFoundException("Empleado no encontrado.");
}

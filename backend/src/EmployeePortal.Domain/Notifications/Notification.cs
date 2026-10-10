using EmployeePortal.Domain.Common;

namespace EmployeePortal.Domain.Notifications;

public enum NotificationType
{
    General = 0,
    Payslip = 1,
    Vacation = 2,
    Leave = 3,
    Document = 4,
    Profile = 5,
    Announcement = 6
}

public class Notification : Entity
{
    public Guid EmployeeId { get; set; }
    public NotificationType Type { get; set; }
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string? Link { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; set; }
}

/// <summary>Registered device / browser for push notifications.</summary>
public class Device : Entity
{
    public Guid EmployeeId { get; set; }
    public string Platform { get; set; } = "web";
    public string PushToken { get; set; } = "";
    public string? Name { get; set; }
    public DateTime RegisteredAt { get; set; } = DateTime.UtcNow;
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
}

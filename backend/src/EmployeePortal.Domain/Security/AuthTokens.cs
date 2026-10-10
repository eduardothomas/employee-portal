using EmployeePortal.Domain.Common;

namespace EmployeePortal.Domain.Security;

/// <summary>One-time code sent after a correct password (second factor).</summary>
public class MfaChallenge : Entity
{
    public Guid EmployeeId { get; set; }
    public string CodeHash { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public int FailedAttempts { get; set; }
    public DateTime? CompletedAt { get; set; }

    public const int MaxAttempts = 5;

    public bool IsUsable(DateTime now) => CompletedAt is null && now < ExpiresAt && FailedAttempts < MaxAttempts;
}

public class RefreshToken : Entity
{
    public Guid EmployeeId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? DeviceName { get; set; }

    public bool IsActive(DateTime now) => RevokedAt is null && now < ExpiresAt;
}

namespace EmployeePortal.Domain.Common;

public abstract class Entity
{
    public Guid Id { get; set; } = Guid.NewGuid();
}

public enum RequestStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Cancelled = 3
}

public sealed class DomainException(string message) : Exception(message);

/// <summary>
/// Base for anything an employee asks for and someone else decides on
/// (vacations, leave, profile change requests).
/// </summary>
public abstract class ReviewableRequest : Entity
{
    public Guid EmployeeId { get; set; }
    public RequestStatus Status { get; set; } = RequestStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Guid? ReviewedById { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewComment { get; set; }

    public void Approve(Guid reviewerId, string? comment, DateTime now) => Decide(RequestStatus.Approved, reviewerId, comment, now);

    public void Reject(Guid reviewerId, string? comment, DateTime now) => Decide(RequestStatus.Rejected, reviewerId, comment, now);

    public void Cancel(DateTime now)
    {
        if (Status != RequestStatus.Pending)
            throw new DomainException("Solo se pueden cancelar solicitudes pendientes.");
        Status = RequestStatus.Cancelled;
        ReviewedAt = now;
    }

    private void Decide(RequestStatus status, Guid reviewerId, string? comment, DateTime now)
    {
        if (Status != RequestStatus.Pending)
            throw new DomainException("La solicitud ya fue procesada.");
        if (reviewerId == EmployeeId)
            throw new DomainException("No puedes aprobar tus propias solicitudes.");
        Status = status;
        ReviewedById = reviewerId;
        ReviewedAt = now;
        ReviewComment = comment;
    }
}

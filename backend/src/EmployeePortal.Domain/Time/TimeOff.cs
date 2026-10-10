using EmployeePortal.Domain.Common;

namespace EmployeePortal.Domain.Time;

public class VacationRequest : ReviewableRequest
{
    public string Number { get; set; } = "";
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal Days { get; set; }
    public string? Comment { get; set; }
}

/// <summary>Leave type configured by HR (personal, médico, calamidad...). Never hardcoded in clients.</summary>
public class LeaveType : Entity
{
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string Icon { get; set; } = "📝";
    public bool IsPaid { get; set; } = true;
    public bool RequiresAttachment { get; set; }
    public int? MaxDaysPerYear { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}

public class LeaveRequest : ReviewableRequest
{
    public string Number { get; set; } = "";
    public Guid LeaveTypeId { get; set; }
    public LeaveType? LeaveType { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    /// <summary>Partial-day leave: hours requested on a single day. Null = full days.</summary>
    public decimal? Hours { get; set; }
    public string Reason { get; set; } = "";
}

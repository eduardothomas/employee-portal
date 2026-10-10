namespace EmployeePortal.Contracts;

public sealed record ActivityItemDto(string Type, string Icon, string Title, string Subtitle, DateTime Date, string? Link);

public sealed record NextPayDto(DateOnly Date, decimal EstimatedNet);

public sealed record DashboardResponse(
    string DisplayName,
    NextPayDto NextPay,
    VacationBalanceDto Vacation,
    int PendingRequests,
    int UnreadNotifications,
    bool IsManager,
    int PendingApprovals,
    IReadOnlyList<ActivityItemDto> RecentActivity);

namespace EmployeePortal.Contracts;

public sealed record LoginRequest(string Login, string Password);

/// <summary>Step 1 result. <see cref="DevCode"/> is only populated in Development.</summary>
public sealed record LoginResponse(Guid ChallengeId, string MaskedDestination, DateTime ExpiresAt, string? DevCode);

public sealed record VerifyMfaRequest(Guid ChallengeId, string Code, string? DeviceName);

public sealed record RefreshRequest(string RefreshToken);

public sealed record ForgotPasswordRequest(string Login);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed record UserSummary(
    Guid Id,
    string EmployeeCode,
    string DisplayName,
    string FullName,
    string JobTitle,
    string Role,
    string? PhotoUrl);

public sealed record AuthTokensResponse(
    string AccessToken,
    DateTime AccessTokenExpiresAt,
    string RefreshToken,
    UserSummary User);

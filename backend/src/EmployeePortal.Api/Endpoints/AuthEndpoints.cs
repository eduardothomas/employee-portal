using EmployeePortal.Application.Services;
using EmployeePortal.Contracts;

namespace EmployeePortal.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var auth = app.MapGroup("/auth").WithTags("Authentication").RequireRateLimiting("auth");

        auth.MapPost("/login", (LoginRequest r, AuthService s, CancellationToken ct) => s.LoginAsync(r, ct));
        auth.MapPost("/mfa/verify", (VerifyMfaRequest r, AuthService s, CancellationToken ct) => s.VerifyMfaAsync(r, ct));
        auth.MapPost("/refresh", (RefreshRequest r, AuthService s, CancellationToken ct) => s.RefreshAsync(r, ct));
        auth.MapPost("/logout", async (RefreshRequest r, AuthService s, CancellationToken ct) =>
        {
            await s.LogoutAsync(r, ct);
            return Results.NoContent();
        });
        auth.MapPost("/forgot-password", async (ForgotPasswordRequest r, AuthService s, CancellationToken ct) =>
        {
            await s.ForgotPasswordAsync(r, ct);
            return Results.Accepted();
        });
        auth.MapPost("/change-password", async (ChangePasswordRequest r, AuthService s, CancellationToken ct) =>
        {
            await s.ChangePasswordAsync(r, ct);
            return Results.NoContent();
        }).RequireAuthorization();
    }
}

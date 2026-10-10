using EmployeePortal.Application.Abstractions;
using EmployeePortal.Application.Common;
using EmployeePortal.Contracts;
using EmployeePortal.Domain.Audit;
using EmployeePortal.Domain.Employees;
using EmployeePortal.Domain.Security;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace EmployeePortal.Application.Services;

public sealed record AuthOptions
{
    public bool ExposeMfaCodeInResponse { get; init; }
    public TimeSpan MfaCodeLifetime { get; init; } = TimeSpan.FromMinutes(5);
    public TimeSpan RefreshTokenLifetime { get; init; } = TimeSpan.FromDays(30);
}

public sealed class AuthService(
    IAppDbContext db,
    IPasswordService passwords,
    ITokenService tokens,
    IMfaCodeSender mfaSender,
    IClock clock,
    ICurrentUser currentUser,
    AuditTrail audit,
    AuthOptions options)
{
    /// <summary>Step 1: email/employee ID + password. Issues an MFA challenge.</summary>
    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct)
    {
        var login = request.Login?.Trim().ToLowerInvariant() ?? "";
        var employee = await db.Employees.FirstOrDefaultAsync(
            e => e.WorkEmail.ToLower() == login || e.EmployeeCode.ToLower() == login, ct);

        if (employee is null || !employee.IsActive || !passwords.Verify(employee.PasswordHash, request.Password ?? ""))
        {
            audit.RecordFor(employee, AuditActions.LoginFailed, $"login={login}");
            await db.SaveChangesAsync(ct);
            throw new UnauthorizedException("Usuario o contraseña incorrectos.");
        }

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var challenge = new MfaChallenge
        {
            EmployeeId = employee.Id,
            CodeHash = tokens.HashToken($"{employee.Id}:{code}"),
            ExpiresAt = clock.UtcNow.Add(options.MfaCodeLifetime)
        };
        db.MfaChallenges.Add(challenge);
        await db.SaveChangesAsync(ct);
        await mfaSender.SendAsync(employee, code, ct);

        return new LoginResponse(challenge.Id, MaskPhone(employee.Phone), challenge.ExpiresAt,
            options.ExposeMfaCodeInResponse ? code : null);
    }

    /// <summary>Step 2: verify the 6-digit code and issue tokens.</summary>
    public async Task<AuthTokensResponse> VerifyMfaAsync(VerifyMfaRequest request, CancellationToken ct)
    {
        var challenge = await db.MfaChallenges.FirstOrDefaultAsync(c => c.Id == request.ChallengeId, ct);
        if (challenge is null || !challenge.IsUsable(clock.UtcNow))
            throw new UnauthorizedException("El código expiró. Inicia sesión nuevamente.");

        var employee = await db.GetEmployeeAsync(challenge.EmployeeId, ct);
        var expected = tokens.HashToken($"{employee.Id}:{request.Code?.Trim()}");
        if (!CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(expected),
                System.Text.Encoding.UTF8.GetBytes(challenge.CodeHash)))
        {
            challenge.FailedAttempts++;
            audit.RecordFor(employee, AuditActions.MfaFailed);
            await db.SaveChangesAsync(ct);
            throw new UnauthorizedException("Código incorrecto.");
        }

        challenge.CompletedAt = clock.UtcNow;
        audit.RecordFor(employee, AuditActions.LoginSucceeded, request.DeviceName);
        return await IssueTokensAsync(employee, request.DeviceName, ct);
    }

    /// <summary>Rotates the refresh token. Reuse of a revoked token revokes every session (theft detection).</summary>
    public async Task<AuthTokensResponse> RefreshAsync(RefreshRequest request, CancellationToken ct)
    {
        var hash = tokens.HashToken(request.RefreshToken ?? "");
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct)
            ?? throw new UnauthorizedException("Sesión inválida.");

        if (!stored.IsActive(clock.UtcNow))
        {
            // A token reused well after rotation suggests theft: end every session.
            // (Short grace window tolerates benign races such as two tabs refreshing at once.)
            if (stored.RevokedAt is { } revokedAt && clock.UtcNow - revokedAt > TimeSpan.FromSeconds(30))
                await RevokeAllAsync(stored.EmployeeId, ct);
            throw new UnauthorizedException("La sesión expiró.");
        }

        var employee = await db.GetEmployeeAsync(stored.EmployeeId, ct);
        if (!employee.IsActive) throw new UnauthorizedException("Cuenta inactiva.");

        stored.RevokedAt = clock.UtcNow;
        return await IssueTokensAsync(employee, stored.DeviceName, ct);
    }

    public async Task LogoutAsync(RefreshRequest request, CancellationToken ct)
    {
        var hash = tokens.HashToken(request.RefreshToken ?? "");
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (stored is { RevokedAt: null })
        {
            stored.RevokedAt = clock.UtcNow;
            await db.SaveChangesAsync(ct);
        }
    }

    /// <summary>Always succeeds to avoid user enumeration. Delivery is handled out of band.</summary>
    public async Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct)
    {
        var login = request.Login?.Trim().ToLowerInvariant() ?? "";
        var employee = await db.Employees.FirstOrDefaultAsync(e => e.WorkEmail.ToLower() == login || e.EmployeeCode.ToLower() == login, ct);
        audit.RecordFor(employee, "auth.password_reset_requested", $"login={login}");
        await db.SaveChangesAsync(ct);
    }

    public async Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct)
    {
        var employee = await db.GetEmployeeAsync(currentUser.Id, ct);
        if (!passwords.Verify(employee.PasswordHash, request.CurrentPassword ?? ""))
            throw ValidationException.For("currentPassword", "La contraseña actual no es correcta.");
        ValidatePasswordStrength(request.NewPassword);

        employee.PasswordHash = passwords.Hash(request.NewPassword);
        audit.Record(AuditActions.PasswordChanged, nameof(Employee), employee.Id, employee.Id);
        await db.SaveChangesAsync(ct);
    }

    public static void ValidatePasswordStrength(string? password)
    {
        if (password is null || password.Length < 8 || !password.Any(char.IsDigit) || !password.Any(char.IsLetter))
            throw ValidationException.For("newPassword", "Mínimo 8 caracteres, con letras y números.");
    }

    private async Task<AuthTokensResponse> IssueTokensAsync(Employee employee, string? deviceName, CancellationToken ct)
    {
        var (access, expires) = tokens.CreateAccessToken(employee);
        var refresh = tokens.CreateRefreshToken();
        db.RefreshTokens.Add(new RefreshToken
        {
            EmployeeId = employee.Id,
            TokenHash = tokens.HashToken(refresh),
            CreatedAt = clock.UtcNow,
            ExpiresAt = clock.UtcNow.Add(options.RefreshTokenLifetime),
            DeviceName = deviceName
        });
        await db.SaveChangesAsync(ct);
        return new AuthTokensResponse(access, expires, refresh, employee.ToSummary());
    }

    private async Task RevokeAllAsync(Guid employeeId, CancellationToken ct)
    {
        var active = await db.RefreshTokens.Where(t => t.EmployeeId == employeeId && t.RevokedAt == null).ToListAsync(ct);
        foreach (var t in active) t.RevokedAt = clock.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private static string MaskPhone(string? phone) =>
        string.IsNullOrWhiteSpace(phone) || phone.Length < 4 ? "tu teléfono registrado" : $"•••• {phone[^4..]}";
}

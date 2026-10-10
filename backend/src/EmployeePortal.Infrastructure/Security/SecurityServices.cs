using EmployeePortal.Application.Abstractions;
using EmployeePortal.Domain.Employees;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace EmployeePortal.Infrastructure.Security;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "EmployeePortal";
    public string Audience { get; set; } = "EmployeePortal";
    public string SigningKey { get; set; } = "";
    public int AccessTokenMinutes { get; set; } = 15;
}

public sealed class PasswordService : IPasswordService
{
    private readonly PasswordHasher<object> _hasher = new();
    private static readonly object User = new();

    public string Hash(string password) => _hasher.HashPassword(User, password);

    public bool Verify(string hash, string password) =>
        !string.IsNullOrEmpty(hash) && _hasher.VerifyHashedPassword(User, hash, password) != PasswordVerificationResult.Failed;
}

public sealed class TokenService(JwtOptions options, IClock clock) : ITokenService
{
    public (string Token, DateTime ExpiresAt) CreateAccessToken(Employee employee)
    {
        var expires = clock.UtcNow.AddMinutes(options.AccessTokenMinutes);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, employee.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Name, employee.FullName),
            new Claim(JwtRegisteredClaimNames.Email, employee.WorkEmail),
            new Claim("role", employee.Role.ToString()),
            new Claim("code", employee.EmployeeCode),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.SigningKey)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(options.Issuer, options.Audience, claims, clock.UtcNow, expires, credentials);
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    public string CreateRefreshToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))
        .Replace('+', '-').Replace('/', '_').TrimEnd('=');

    public string HashToken(string value) =>
        Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(options.SigningKey), Encoding.UTF8.GetBytes(value)));
}

/// <summary>Development sender: writes the code to the log. Replace with an SMS/email provider in production.</summary>
public sealed class LoggingMfaCodeSender(ILogger<LoggingMfaCodeSender> logger) : IMfaCodeSender
{
    public Task SendAsync(Employee employee, string code, CancellationToken ct)
    {
        logger.LogInformation("MFA code for {Employee}: {Code}", employee.WorkEmail, code);
        return Task.CompletedTask;
    }
}

public sealed class SystemClock : IClock
{
    private static readonly TimeZoneInfo Panama = FindPanama();

    public DateTime UtcNow => DateTime.UtcNow;

    public DateOnly Today => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(UtcNow, Panama));

    private static TimeZoneInfo FindPanama()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Panama"); }
        catch { return TimeZoneInfo.CreateCustomTimeZone("Panama", TimeSpan.FromHours(-5), "Panama", "Panama"); }
    }
}

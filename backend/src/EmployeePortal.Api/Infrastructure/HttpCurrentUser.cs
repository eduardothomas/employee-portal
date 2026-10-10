using EmployeePortal.Application.Abstractions;
using EmployeePortal.Domain.Employees;
using System.IdentityModel.Tokens.Jwt;

namespace EmployeePortal.Api.Infrastructure;

public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private System.Security.Claims.ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated == true;

    public Guid Id => Guid.TryParse(Principal?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id)
        ? id
        : throw new UnauthorizedAccessException();

    public string Name => Principal?.FindFirst(JwtRegisteredClaimNames.Name)?.Value ?? "";

    public Role Role => Enum.TryParse<Role>(Principal?.FindFirst("role")?.Value, out var role) ? role : Role.Employee;

    public string? IpAddress => accessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
}

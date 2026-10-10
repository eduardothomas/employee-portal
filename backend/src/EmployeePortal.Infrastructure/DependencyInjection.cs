using EmployeePortal.Application.Abstractions;
using EmployeePortal.Infrastructure.Pdf;
using EmployeePortal.Infrastructure.Persistence;
using EmployeePortal.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace EmployeePortal.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Database:Provider = "Postgres" (default, uses migrations) or "Sqlite" (zero-setup local dev).
    /// </summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        var provider = config["Database:Provider"] ?? "Postgres";
        var connection = config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured.");

        services.AddDbContext<AppDbContext>(options =>
        {
            if (provider.Equals("Sqlite", StringComparison.OrdinalIgnoreCase)) options.UseSqlite(connection);
            else options.UseNpgsql(ConnectionStrings.NormalizePostgres(connection));
        });
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        var jwt = config.GetSection("Jwt").Get<JwtOptions>() ?? new JwtOptions();
        if (jwt.SigningKey.Length < 32)
            throw new InvalidOperationException("Jwt:SigningKey must be at least 32 characters.");
        services.AddSingleton(jwt);

        services.AddSingleton<IClock, SystemClock>();
        services.AddSingleton<IPasswordService, PasswordService>();
        services.AddSingleton<ITokenService, TokenService>();
        services.AddSingleton<IMfaCodeSender, LoggingMfaCodeSender>();
        services.AddSingleton<PdfRenderer>();
        services.AddSingleton<IPdfRenderer>(sp => sp.GetRequiredService<PdfRenderer>());
        services.AddScoped<DataSeeder>();
        return services;
    }

    public static async Task InitializeDatabaseAsync(this IServiceProvider services, bool seed)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        if (db.Database.IsNpgsql()) await db.Database.MigrateAsync();
        else await db.Database.EnsureCreatedAsync();

        if (seed) await scope.ServiceProvider.GetRequiredService<DataSeeder>().SeedAsync();
    }
}

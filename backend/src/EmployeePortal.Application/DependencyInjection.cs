using EmployeePortal.Application.Common;
using EmployeePortal.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace EmployeePortal.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<AuditTrail>();
        services.AddScoped<Notifier>();
        services.AddScoped<AuthService>();
        services.AddScoped<ProfileService>();
        services.AddScoped<DashboardService>();
        services.AddScoped<PayrollService>();
        services.AddScoped<TimeOffService>();
        services.AddScoped<ApprovalService>();
        services.AddScoped<DocumentService>();
        services.AddScoped<NotificationService>();
        services.AddScoped<AdminService>();
        services.AddScoped<PayrollRunService>();
        return services;
    }
}

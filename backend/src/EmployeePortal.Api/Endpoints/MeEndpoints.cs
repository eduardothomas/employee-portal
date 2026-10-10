using EmployeePortal.Application.Services;
using EmployeePortal.Contracts;

namespace EmployeePortal.Api.Endpoints;

/// <summary>Employee self-service — everything is scoped to the authenticated user.</summary>
public static class MeEndpoints
{
    public static void MapMeEndpoints(this IEndpointRouteBuilder app)
    {
        var me = app.MapGroup("/me").RequireAuthorization();

        // Profile
        var profile = me.MapGroup("").WithTags("Profile");
        profile.MapGet("/", (ProfileService s, CancellationToken ct) => s.GetMeAsync(ct));
        profile.MapGet("/dashboard", (DashboardService s, CancellationToken ct) => s.GetAsync(ct));
        profile.MapPatch("/profile", (UpdateProfileRequest r, ProfileService s, CancellationToken ct) => s.UpdateProfileAsync(r, ct));
        profile.MapPut("/security", async (UpdateSecurityRequest r, ProfileService s, CancellationToken ct) =>
        {
            await s.UpdateSecurityAsync(r, ct);
            return Results.NoContent();
        });
        profile.MapGet("/change-requests", (ProfileService s, CancellationToken ct) => s.GetMyChangeRequestsAsync(ct));
        profile.MapPost("/change-requests", (CreateChangeRequest r, ProfileService s, CancellationToken ct) => s.CreateChangeRequestAsync(r, ct));

        // Payroll
        var payroll = me.MapGroup("").WithTags("Payroll");
        payroll.MapGet("/payroll", (PayrollService s, CancellationToken ct) => s.GetSummaryAsync(ct));
        payroll.MapGet("/payroll/months/{year:int}/{month:int}", (int year, int month, PayrollService s, CancellationToken ct) => s.GetMonthAsync(year, month, ct));
        payroll.MapGet("/payslips", (int? year, PayrollService s, CancellationToken ct) => s.GetPayslipsAsync(year, ct));
        payroll.MapGet("/payslips/{id:guid}", (Guid id, PayrollService s, CancellationToken ct) => s.GetPayslipAsync(id, ct));
        payroll.MapGet("/payslips/{id:guid}/pdf", async (Guid id, PayrollService s, CancellationToken ct) =>
        {
            var (content, fileName) = await s.GetPayslipPdfAsync(id, ct);
            return Results.File(content, "application/pdf", fileName);
        });
        payroll.MapGet("/deductions", (int? year, int? month, PayrollService s, CancellationToken ct) => s.GetDeductionsAsync(year, month, ct));
        payroll.MapGet("/decimo", (PayrollService s, CancellationToken ct) => s.GetDecimoAsync(ct));

        // Time off
        var time = me.MapGroup("").WithTags("Time off");
        time.MapGet("/vacations", (TimeOffService s, CancellationToken ct) => s.GetVacationsAsync(ct));
        time.MapGet("/vacations/preview", (DateOnly from, DateOnly to, TimeOffService s, CancellationToken ct) => s.PreviewAsync(from, to, ct));
        time.MapPost("/vacations", async (CreateVacationRequest r, TimeOffService s, CancellationToken ct) =>
            Results.Created($"/me/vacations", await s.RequestVacationAsync(r, ct)));
        time.MapPost("/vacations/{id:guid}/cancel", async (Guid id, TimeOffService s, CancellationToken ct) =>
        {
            await s.CancelVacationAsync(id, ct);
            return Results.NoContent();
        });
        time.MapGet("/leave-requests", (TimeOffService s, CancellationToken ct) => s.GetMyLeaveRequestsAsync(ct));
        time.MapPost("/leave-requests", async (CreateLeaveRequest r, TimeOffService s, CancellationToken ct) =>
            Results.Created($"/me/leave-requests", await s.RequestLeaveAsync(r, ct)));
        time.MapPost("/leave-requests/{id:guid}/cancel", async (Guid id, TimeOffService s, CancellationToken ct) =>
        {
            await s.CancelLeaveAsync(id, ct);
            return Results.NoContent();
        });

        // Documents
        var docs = me.MapGroup("").WithTags("Documents");
        docs.MapGet("/documents", (DocumentService s, CancellationToken ct) => s.GetMineAsync(ct));
        docs.MapGet("/documents/{id:guid}", async (Guid id, DocumentService s, CancellationToken ct) =>
        {
            var (content, type, name) = await s.DownloadAsync(id, ct);
            return Results.File(content, type, name);
        });

        // Shared, non-"me" resources available to any signed-in employee
        app.MapGet("/leave-types", (TimeOffService s, CancellationToken ct) => s.GetLeaveTypesAsync(false, ct))
            .WithTags("Time off").RequireAuthorization();

        var notifications = app.MapGroup("").WithTags("Notifications").RequireAuthorization();
        notifications.MapGet("/notifications", (NotificationService s, CancellationToken ct) => s.GetMineAsync(ct));
        notifications.MapPost("/notifications/{id:guid}/read", async (Guid id, NotificationService s, CancellationToken ct) =>
        {
            await s.MarkReadAsync(id, ct);
            return Results.NoContent();
        });
        notifications.MapPost("/notifications/read-all", async (NotificationService s, CancellationToken ct) =>
        {
            await s.MarkAllReadAsync(ct);
            return Results.NoContent();
        });
        notifications.MapPost("/devices", async (RegisterDeviceRequest r, NotificationService s, CancellationToken ct) =>
        {
            await s.RegisterDeviceAsync(r, ct);
            return Results.NoContent();
        });
    }
}

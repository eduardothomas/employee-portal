using EmployeePortal.Application.Services;
using EmployeePortal.Contracts;

namespace EmployeePortal.Api.Endpoints;

public static class ManagementEndpoints
{
    public static void MapManagerEndpoints(this IEndpointRouteBuilder app)
    {
        var m = app.MapGroup("/manager").WithTags("Manager").RequireAuthorization("Manager");

        m.MapGet("/team", (ApprovalService s, CancellationToken ct) => s.GetTeamAsync(ct));
        m.MapGet("/approvals", (ApprovalService s, CancellationToken ct) => s.GetPendingAsync(ct));
        m.MapGet("/vacations", (string? status, ApprovalService s, CancellationToken ct) => s.GetVacationsAsync(status, ct));
        m.MapGet("/leave-requests", (string? status, ApprovalService s, CancellationToken ct) => s.GetLeavesAsync(status, ct));

        m.MapPost("/vacations/{id:guid}/approve", (Guid id, ReviewRequest r, ApprovalService s, CancellationToken ct) => Decide(s.DecideVacationAsync(id, true, r, ct)));
        m.MapPost("/vacations/{id:guid}/reject", (Guid id, ReviewRequest r, ApprovalService s, CancellationToken ct) => Decide(s.DecideVacationAsync(id, false, r, ct)));
        m.MapPost("/leave-requests/{id:guid}/approve", (Guid id, ReviewRequest r, ApprovalService s, CancellationToken ct) => Decide(s.DecideLeaveAsync(id, true, r, ct)));
        m.MapPost("/leave-requests/{id:guid}/reject", (Guid id, ReviewRequest r, ApprovalService s, CancellationToken ct) => Decide(s.DecideLeaveAsync(id, false, r, ct)));
    }

    public static void MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var a = app.MapGroup("/admin").WithTags("HR / Admin").RequireAuthorization("HrAdmin");

        a.MapGet("/dashboard", (AdminService s, CancellationToken ct) => s.GetDashboardAsync(ct));

        // Employees
        a.MapGet("/employees", (string? search, string? department, bool? active, int? page, int? pageSize, AdminService s, CancellationToken ct) =>
            s.ListEmployeesAsync(search, department, active, page ?? 1, pageSize ?? 50, ct));
        a.MapGet("/departments", (AdminService s, CancellationToken ct) => s.DepartmentsAsync(ct));
        a.MapGet("/employees/{id:guid}", (Guid id, AdminService s, CancellationToken ct) => s.GetEmployeeAsync(id, ct));
        a.MapPost("/employees", async (SaveEmployeeRequest r, AdminService s, CancellationToken ct) =>
        {
            var created = await s.CreateEmployeeAsync(r, ct);
            return Results.Created($"/admin/employees/{created.Id}", created);
        });
        a.MapPut("/employees/{id:guid}", (Guid id, SaveEmployeeRequest r, AdminService s, CancellationToken ct) => s.UpdateEmployeeAsync(id, r, ct));
        a.MapPost("/employees/{id:guid}/deductions", (Guid id, SaveRecurringDeductionRequest r, AdminService s, CancellationToken ct) => s.AddDeductionAsync(id, r, ct));
        a.MapPut("/employees/{id:guid}/deductions/{deductionId:guid}", (Guid id, Guid deductionId, SaveRecurringDeductionRequest r, AdminService s, CancellationToken ct) =>
            s.UpdateDeductionAsync(id, deductionId, r, ct));
        a.MapPost("/vacations/accrue", async (AdminService s, CancellationToken ct) => Results.Ok(new { employees = await s.AccrueMonthlyVacationAsync(ct) }));

        // Policies
        a.MapGet("/leave-types", (TimeOffService s, CancellationToken ct) => s.GetLeaveTypesAsync(true, ct));
        a.MapPost("/leave-types", (SaveLeaveTypeRequest r, AdminService s, CancellationToken ct) => s.SaveLeaveTypeAsync(null, r, ct));
        a.MapPut("/leave-types/{id:guid}", (Guid id, SaveLeaveTypeRequest r, AdminService s, CancellationToken ct) => s.SaveLeaveTypeAsync(id, r, ct));

        // Documents
        a.MapGet("/documents", (Guid? employeeId, DocumentService s, CancellationToken ct) => s.ListAllAsync(employeeId, ct));
        a.MapGet("/documents/{id:guid}", async (Guid id, DocumentService s, CancellationToken ct) =>
        {
            var (content, type, name) = await s.DownloadAsync(id, ct);
            return Results.File(content, type, name);
        });
        a.MapPost("/documents", async (HttpRequest request, DocumentService s, CancellationToken ct) =>
        {
            var form = await request.ReadFormAsync(ct);
            var file = form.Files.GetFile("file") ?? throw Application.Common.ValidationException.For("file", "Selecciona un archivo.");
            if (file.Length > DocumentService.MaxUploadBytes) throw Application.Common.ValidationException.For("file", "El archivo supera 10 MB.");
            using var ms = new MemoryStream();
            await file.CopyToAsync(ms, ct);
            Guid? employeeId = Guid.TryParse(form["employeeId"], out var eid) ? eid : null;
            return await s.UploadAsync(new UploadDocument(employeeId, form["category"].ToString(), form["title"].ToString(),
                file.FileName, file.ContentType, ms.ToArray()), ct);
        }).DisableAntiforgery();
        a.MapDelete("/documents/{id:guid}", async (Guid id, DocumentService s, CancellationToken ct) =>
        {
            await s.DeleteAsync(id, ct);
            return Results.NoContent();
        });

        // Payroll
        a.MapGet("/payroll-runs", (PayrollRunService s, CancellationToken ct) => s.ListAsync(ct));
        a.MapPost("/payroll-runs", (CreatePayrollRunRequest r, PayrollRunService s, CancellationToken ct) => s.CreateAsync(r, ct));
        a.MapGet("/payroll-runs/{id:guid}", (Guid id, PayrollRunService s, CancellationToken ct) => s.GetAsync(id, ct));
        a.MapPost("/payroll-runs/{id:guid}/publish", (Guid id, PayrollRunService s, CancellationToken ct) => s.PublishAsync(id, ct));
        a.MapDelete("/payroll-runs/{id:guid}", async (Guid id, PayrollRunService s, CancellationToken ct) =>
        {
            await s.DeleteDraftAsync(id, ct);
            return Results.NoContent();
        });

        // Change requests
        a.MapGet("/change-requests", (string? status, ApprovalService s, CancellationToken ct) => s.GetChangeRequestsAsync(status, ct));
        a.MapPost("/change-requests/{id:guid}/approve", (Guid id, ReviewRequest r, ApprovalService s, CancellationToken ct) => Decide(s.DecideChangeRequestAsync(id, true, r, ct)));
        a.MapPost("/change-requests/{id:guid}/reject", (Guid id, ReviewRequest r, ApprovalService s, CancellationToken ct) => Decide(s.DecideChangeRequestAsync(id, false, r, ct)));

        // Communications & audit
        a.MapPost("/announcements", async (AnnouncementRequest r, NotificationService s, CancellationToken ct) =>
            Results.Ok(new { recipients = await s.SendAnnouncementAsync(r, ct) }));
        a.MapGet("/audit", (string? action, Guid? employeeId, DateOnly? from, DateOnly? to, int? page, int? pageSize, AdminService s, CancellationToken ct) =>
            s.GetAuditAsync(action, employeeId, from, to, page ?? 1, pageSize ?? 50, ct));
    }

    private static async Task<IResult> Decide(Task action)
    {
        await action;
        return Results.NoContent();
    }
}

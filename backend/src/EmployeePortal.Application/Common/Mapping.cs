using EmployeePortal.Contracts;
using EmployeePortal.Domain.Audit;
using EmployeePortal.Domain.Common;
using EmployeePortal.Domain.Documents;
using EmployeePortal.Domain.Employees;
using EmployeePortal.Domain.Notifications;
using EmployeePortal.Domain.Payroll;
using EmployeePortal.Domain.Time;

namespace EmployeePortal.Application.Common;

/// <summary>Entity → contract projections. Enum values travel as camelCase strings.</summary>
public static class Mapping
{
    public static string ToApi(this Enum value)
    {
        var s = value.ToString();
        return char.ToLowerInvariant(s[0]) + s[1..];
    }

    public static T ParseEnum<T>(string value, string field) where T : struct, Enum =>
        Enum.TryParse<T>(value, ignoreCase: true, out var result) && Enum.IsDefined(result)
            ? result
            : throw ValidationException.For(field, $"Valor inválido: {value}");

    public static UserSummary ToSummary(this Employee e) =>
        new(e.Id, e.EmployeeCode, e.DisplayName, e.FullName, e.JobTitle, e.Role.ToApi(), e.PhotoUrl);

    public static PayslipSummaryDto ToSummary(this Payslip p) =>
        new(p.Id, p.Number, p.Kind.ToApi(), p.PeriodStart, p.PeriodEnd, p.PayDate, p.Gross, p.TotalDeductions, p.Net);

    public static PayslipLineDto ToDto(this PayslipLine l) => new(l.Code, l.Description, l.Amount);

    public static PayslipDetailDto ToDetail(this Payslip p, Employee e) =>
        new(p.ToSummary(),
            p.Lines.Where(l => l.Type == PayslipLineType.Earning).OrderBy(l => l.SortOrder).Select(ToDto).ToList(),
            p.Lines.Where(l => l.Type == PayslipLineType.Deduction).OrderBy(l => l.SortOrder).Select(ToDto).ToList(),
            e.FullName, e.EmployeeCode, e.JobTitle);

    public static VacationRequestDto ToDto(this VacationRequest r, IReadOnlyDictionary<Guid, string> names) =>
        new(r.Id, r.Number, r.EmployeeId, names.GetValueOrDefault(r.EmployeeId, ""), r.StartDate, r.EndDate, r.Days,
            r.Comment, r.Status.ToApi(), r.CreatedAt, r.ReviewedAt, Reviewer(r, names), r.ReviewComment);

    public static LeaveRequestDto ToDto(this LeaveRequest r, IReadOnlyDictionary<Guid, string> names) =>
        new(r.Id, r.Number, r.EmployeeId, names.GetValueOrDefault(r.EmployeeId, ""), r.LeaveTypeId,
            r.LeaveType?.Name ?? "", r.LeaveType?.Icon ?? "📝", r.StartDate, r.EndDate, r.Hours, r.Reason,
            r.Status.ToApi(), r.CreatedAt, r.ReviewedAt, Reviewer(r, names), r.ReviewComment);

    public static ChangeRequestDto ToDto(this ChangeRequest r, IReadOnlyDictionary<Guid, string> names) =>
        new(r.Id, r.EmployeeId, names.GetValueOrDefault(r.EmployeeId, ""), r.Field, r.CurrentValue, r.RequestedValue,
            r.Reason, r.Status.ToApi(), r.CreatedAt, r.ReviewedAt, Reviewer(r, names), r.ReviewComment);

    public static LeaveTypeDto ToDto(this LeaveType t) =>
        new(t.Id, t.Code, t.Name, t.Icon, t.IsPaid, t.RequiresAttachment, t.MaxDaysPerYear, t.IsActive, t.SortOrder);

    public static NotificationDto ToDto(this Notification n) =>
        new(n.Id, n.Type.ToApi(), n.Title, n.Body, n.Link, n.CreatedAt, n.ReadAt);

    public static DocumentDto ToDto(this Document d, string? employeeName = null) =>
        new(d.Id, d.Category.ToApi(), d.Title, d.FileName, d.ContentType, d.SizeBytes, d.UploadedAt, "document",
            $"/me/documents/{d.Id}", d.EmployeeId, employeeName);

    public static AuditLogDto ToDto(this AuditLog a, IReadOnlyDictionary<Guid, string> names) =>
        new(a.Id, a.At, a.ActorName, a.Action, a.EntityType, a.EntityId,
            a.SubjectEmployeeId is { } id ? names.GetValueOrDefault(id) : null, a.Details, a.IpAddress);

    public static RecurringDeductionDto ToDto(this RecurringDeduction d) =>
        new(d.Id, d.Code, d.Description, d.AmountPerPeriod, d.IsActive);

    private static string? Reviewer(ReviewableRequest r, IReadOnlyDictionary<Guid, string> names) =>
        r.ReviewedById is { } id ? names.GetValueOrDefault(id) : null;

    public static string MaskNationalId(string id) =>
        id.Length <= 3 ? id : new string('•', id.Length - 3) + id[^3..];

    public static string MonthName(int month) => month switch
    {
        1 => "Enero", 2 => "Febrero", 3 => "Marzo", 4 => "Abril", 5 => "Mayo", 6 => "Junio",
        7 => "Julio", 8 => "Agosto", 9 => "Septiembre", 10 => "Octubre", 11 => "Noviembre", _ => "Diciembre"
    };
}

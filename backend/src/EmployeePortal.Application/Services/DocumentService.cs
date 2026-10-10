using EmployeePortal.Application.Abstractions;
using EmployeePortal.Application.Common;
using EmployeePortal.Contracts;
using EmployeePortal.Domain.Audit;
using EmployeePortal.Domain.Documents;
using EmployeePortal.Domain.Employees;
using EmployeePortal.Domain.Notifications;
using EmployeePortal.Domain.Payroll;
using Microsoft.EntityFrameworkCore;

namespace EmployeePortal.Application.Services;

public sealed record UploadDocument(Guid? EmployeeId, string Category, string Title, string FileName, string ContentType, byte[] Content);

public sealed class DocumentService(IAppDbContext db, ICurrentUser user, AuditTrail audit, Notifier notifier)
{
    public const long MaxUploadBytes = 10 * 1024 * 1024;

    private static readonly HashSet<string> AllowedContentTypes =
        ["application/pdf", "image/png", "image/jpeg", "text/plain"];

    /// <summary>The employee's own documents, company-wide documents and their payslip PDFs.</summary>
    public async Task<IReadOnlyList<DocumentDto>> GetMineAsync(CancellationToken ct)
    {
        var docs = await db.Documents.Where(d => d.EmployeeId == user.Id || d.EmployeeId == null)
            .OrderByDescending(d => d.UploadedAt).ToListAsync(ct);

        var payslips = await db.Payslips.Include(p => p.Lines)
            .Where(p => p.EmployeeId == user.Id && p.IsPublished)
            .OrderByDescending(p => p.PayDate).Take(24).ToListAsync(ct);

        var payslipDocs = payslips.Select(p => new DocumentDto(
            p.Id, DocumentCategory.Payroll.ToApi(),
            p.Kind == PayslipKind.Decimo
                ? $"Décimo {Mapping.MonthName(p.PayDate.Month)} {p.PayDate.Year}"
                : $"Comprobante {p.PayDate.Day} {Mapping.MonthName(p.PayDate.Month)} {p.PayDate.Year}",
            $"comprobante-{p.PayDate:yyyy-MM-dd}.pdf", "application/pdf", 0,
            p.PayDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc), "payslip",
            $"/me/payslips/{p.Id}/pdf", user.Id, null));

        return docs.Select(d => d.ToDto()).Concat(payslipDocs).ToList();
    }

    public async Task<(byte[] Content, string ContentType, string FileName)> DownloadAsync(Guid id, CancellationToken ct)
    {
        var doc = await db.Documents.Include(d => d.File).FirstOrDefaultAsync(d => d.Id == id, ct) ?? throw new NotFoundException();
        var allowed = doc.EmployeeId is null || doc.EmployeeId == user.Id || user.Role == Role.HrAdmin;
        if (!allowed) throw new NotFoundException();

        audit.Record(AuditActions.DocumentDownloaded, nameof(Document), doc.Id, doc.EmployeeId, new { doc.Title });
        await db.SaveChangesAsync(ct);
        return (doc.File?.Content ?? [], doc.ContentType, doc.FileName);
    }

    // ── HR/Admin ─────────────────────────────────────────────────────

    public async Task<IReadOnlyList<DocumentDto>> ListAllAsync(Guid? employeeId, CancellationToken ct)
    {
        var query = db.Documents.AsQueryable();
        if (employeeId is { } id) query = query.Where(d => d.EmployeeId == id);
        var docs = await query.OrderByDescending(d => d.UploadedAt).Take(500).ToListAsync(ct);
        var names = await db.NamesAsync(docs.Select(d => d.EmployeeId), ct);
        return docs.Select(d => d.ToDto(d.EmployeeId is { } e ? names.GetValueOrDefault(e) : null)).ToList();
    }

    public async Task<DocumentDto> UploadAsync(UploadDocument u, CancellationToken ct)
    {
        var category = Mapping.ParseEnum<DocumentCategory>(u.Category, "category");
        new Validator()
            .Require(u.Title, "title")
            .MaxLength(u.Title, 200, "title")
            .When(u.Content.Length == 0, "file", "El archivo está vacío.")
            .When(u.Content.Length > MaxUploadBytes, "file", "El archivo supera 10 MB.")
            .When(!AllowedContentTypes.Contains(u.ContentType), "file", "Formato no permitido (PDF, PNG, JPG o TXT).")
            .ThrowIfInvalid();

        string? employeeName = null;
        if (u.EmployeeId is { } empId) employeeName = (await db.GetEmployeeAsync(empId, ct)).FullName;

        var doc = new Document
        {
            EmployeeId = u.EmployeeId,
            Category = category,
            Title = u.Title.Trim(),
            FileName = Path.GetFileName(u.FileName),
            ContentType = u.ContentType,
            SizeBytes = u.Content.Length,
            UploadedById = user.Id
        };
        doc.File = new DocumentFile { DocumentId = doc.Id, Content = u.Content };
        db.Documents.Add(doc);
        audit.Record(AuditActions.DocumentUploaded, nameof(Document), doc.Id, u.EmployeeId, new { doc.Title, doc.SizeBytes });

        if (u.EmployeeId is { } target)
            notifier.Notify(target, NotificationType.Document, "Nuevo documento", $"RRHH publicó «{doc.Title}».", "/me/documents");
        else
        {
            var all = await db.Employees.Where(e => e.IsActive).Select(e => e.Id).ToListAsync(ct);
            foreach (var id in all)
                notifier.Notify(id, NotificationType.Document, "Nuevo documento", $"RRHH publicó «{doc.Title}».", "/me/documents");
        }

        await db.SaveChangesAsync(ct);
        return doc.ToDto(employeeName);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var doc = await db.Documents.Include(d => d.File).FirstOrDefaultAsync(d => d.Id == id, ct) ?? throw new NotFoundException();
        audit.Record(AuditActions.DocumentDeleted, nameof(Document), doc.Id, doc.EmployeeId, new { doc.Title });
        db.Documents.Remove(doc);
        await db.SaveChangesAsync(ct);
    }
}

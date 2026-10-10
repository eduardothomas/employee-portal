using EmployeePortal.Domain.Common;

namespace EmployeePortal.Domain.Documents;

public enum DocumentCategory
{
    Employment = 0, // Laborales
    Payroll = 1,
    Other = 2
}

public class Document : Entity
{
    /// <summary>Null = company-wide document (e.g. reglamento interno).</summary>
    public Guid? EmployeeId { get; set; }
    public DocumentCategory Category { get; set; }
    public string Title { get; set; } = "";
    public string FileName { get; set; } = "";
    public string ContentType { get; set; } = "application/pdf";
    public long SizeBytes { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public Guid? UploadedById { get; set; }
    public DocumentFile? File { get; set; }
}

/// <summary>Binary content kept apart so listing documents never loads blobs.</summary>
public class DocumentFile
{
    public Guid DocumentId { get; set; }
    public byte[] Content { get; set; } = [];
}

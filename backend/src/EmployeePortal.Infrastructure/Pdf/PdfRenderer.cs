using EmployeePortal.Application.Abstractions;
using EmployeePortal.Contracts;
using System.Globalization;
using System.Text;

namespace EmployeePortal.Infrastructure.Pdf;

/// <summary>
/// Dependency-free PDF generation (PDF 1.4, standard Helvetica fonts, WinAnsi encoding).
/// Good enough for payslips and letters; swap for a full library if layouts get complex.
/// </summary>
public sealed class PdfRenderer : IPdfRenderer
{
    public const string CompanyName = "Employee Portal S.A.";
    private static readonly CultureInfo Money = CultureInfo.GetCultureInfo("en-US");

    public byte[] RenderPayslip(PayslipDetailDto p)
    {
        var s = p.Summary;
        var page = new PdfPage();
        const float left = 50, right = 545;

        page.Rect(0, 762, 595, 80, 0.07f, 0.09f, 0.15f);
        page.Text(left, 806, CompanyName, 16, bold: true, gray: 1);
        page.Text(left, 786, s.Kind == "decimo" ? "Comprobante de décimo tercer mes" : "Comprobante de pago", 11, gray: 0.8f);
        page.TextRight(right, 806, s.Number, 11, bold: true, gray: 1);

        float y = 730;
        void Field(float x, string label, string value)
        {
            page.Text(x, y, label.ToUpperInvariant(), 7.5f, gray: 0.45f);
            page.Text(x, y - 13, value, 10.5f);
        }

        Field(left, "Empleado", p.EmployeeName);
        Field(300, "Código", p.EmployeeCode);
        y -= 36;
        Field(left, "Cargo", p.JobTitle);
        Field(300, "Fecha de pago", s.PayDate.ToString("dd 'de' MMMM yyyy", CultureInfo.GetCultureInfo("es-PA")));
        y -= 36;
        Field(left, "Período", $"{s.PeriodStart:dd/MM/yyyy} – {s.PeriodEnd:dd/MM/yyyy}");

        y -= 40;
        y = Section(page, y, "INGRESOS", p.Earnings, s.Gross, left, right);
        y -= 18;
        y = Section(page, y, "DEDUCCIONES", p.DeductionLines, s.Deductions, left, right);

        y -= 26;
        page.Rect(left, y - 18, right - left, 44, 0.94f, 0.96f, 1f);
        page.Text(left + 14, y, "NETO A RECIBIR", 11, bold: true);
        page.TextRight(right - 14, y - 2, Format(s.Net), 18, bold: true);

        page.Line(left, 70, right, 70, 0.85f);
        page.Text(left, 55, "Documento generado electrónicamente por Employee Portal. No requiere firma.", 8, gray: 0.5f);
        page.TextRight(right, 55, $"ID {s.Id.ToString()[..8]}", 8, gray: 0.5f);

        return PdfPage.Build([page], $"Comprobante {s.PayDate:yyyy-MM-dd}");
    }

    /// <summary>Simple letter-style document (contracts, certificates, policies).</summary>
    public byte[] RenderLetter(string title, IEnumerable<string> paragraphs)
    {
        var page = new PdfPage();
        page.Rect(0, 812, 595, 30, 0.07f, 0.09f, 0.15f);
        page.Text(50, 822, CompanyName, 10, bold: true, gray: 1);
        page.Text(50, 760, title, 18, bold: true);
        float y = 720;
        foreach (var para in paragraphs)
        {
            foreach (var line in Wrap(para, 92))
            {
                page.Text(50, y, line, 10.5f);
                y -= 15;
            }
            y -= 10;
        }
        page.Text(50, 70, "Documento generado electrónicamente.", 8, gray: 0.5f);
        return PdfPage.Build([page], title);
    }

    private static float Section(PdfPage page, float y, string title, IReadOnlyList<PayslipLineDto> lines, decimal total, float left, float right)
    {
        page.Text(left, y, title, 9, bold: true, gray: 0.35f);
        y -= 8;
        page.Line(left, y, right, y, 0.8f);
        y -= 18;
        foreach (var l in lines)
        {
            page.Text(left, y, l.Description, 10.5f);
            page.TextRight(right, y, Format(l.Amount), 10.5f);
            y -= 18;
        }
        page.Line(left, y + 8, right, y + 8, 0.9f);
        y -= 6;
        page.Text(left, y, "TOTAL", 10, bold: true);
        page.TextRight(right, y, Format(total), 10.5f, bold: true);
        return y - 14;
    }

    private static string Format(decimal amount) => amount.ToString("$#,##0.00", Money);

    private static IEnumerable<string> Wrap(string text, int width)
    {
        var line = new StringBuilder();
        foreach (var word in text.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            if (line.Length + word.Length + 1 > width && line.Length > 0)
            {
                yield return line.ToString();
                line.Clear();
            }
            if (line.Length > 0) line.Append(' ');
            line.Append(word);
        }
        if (line.Length > 0) yield return line.ToString();
    }
}

internal sealed class PdfPage
{
    private readonly StringBuilder _content = new();
    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;

    public void Text(float x, float y, string text, float size, bool bold = false, float gray = 0.1f) =>
        _content.Append(Inv, $"BT {gray:0.###} g /{(bold ? "F2" : "F1")} {size:0.##} Tf {x:0.##} {y:0.##} Td ({Escape(text)}) Tj ET\n");

    public void TextRight(float right, float y, string text, float size, bool bold = false, float gray = 0.1f) =>
        Text(right - Width(text, size, bold), y, text, size, bold, gray);

    public void Rect(float x, float y, float w, float h, float r, float g, float b) =>
        _content.Append(Inv, $"{r:0.###} {g:0.###} {b:0.###} rg {x:0.##} {y:0.##} {w:0.##} {h:0.##} re f\n");

    public void Line(float x1, float y1, float x2, float y2, float gray) =>
        _content.Append(Inv, $"{gray:0.###} G 0.6 w {x1:0.##} {y1:0.##} m {x2:0.##} {y2:0.##} l S\n");

    /// <summary>Approximate Helvetica advance widths (per 1000 em) — accurate for digits and punctuation.</summary>
    private static float Width(string text, float size, bool bold)
    {
        float units = 0;
        foreach (var c in text)
            units += c switch
            {
                >= '0' and <= '9' or '$' => 556,
                '.' or ',' or ' ' => 278,
                '-' => 333,
                >= 'A' and <= 'Z' => bold ? 722 : 667,
                'i' or 'l' or 'j' => 222,
                'm' or 'w' => 833,
                _ => bold ? 611 : 556
            };
        return units * size / 1000f;
    }

    private static string Escape(string s) => s.Replace("\\", "\\\\").Replace("(", "\\(").Replace(")", "\\)");

    public static byte[] Build(IReadOnlyList<PdfPage> pages, string title)
    {
        var latin1 = Encoding.Latin1;
        var objects = new List<byte[]>();
        int Add(string body) { objects.Add(latin1.GetBytes(body)); return objects.Count; }

        // 1 catalog, 2 pages, 3-4 fonts, 5 info, then page/content pairs.
        var pageIds = Enumerable.Range(0, pages.Count).Select(i => 6 + i * 2).ToList();
        Add("<< /Type /Catalog /Pages 2 0 R >>");
        Add($"<< /Type /Pages /Kids [{string.Join(" ", pageIds.Select(i => $"{i} 0 R"))}] /Count {pages.Count} >>");
        Add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
        Add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
        Add($"<< /Title ({Escape(title)}) /Producer (Employee Portal) >>");
        for (var i = 0; i < pages.Count; i++)
        {
            var content = pages[i]._content.ToString();
            Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {pageIds[i] + 1} 0 R >>");
            Add($"<< /Length {latin1.GetByteCount(content)} >>\nstream\n{content}endstream");
        }

        using var ms = new MemoryStream();
        void Write(string s) => ms.Write(latin1.GetBytes(s));
        Write("%PDF-1.4\n%âãÏÓ\n");
        var offsets = new List<long>();
        for (var i = 0; i < objects.Count; i++)
        {
            offsets.Add(ms.Position);
            Write($"{i + 1} 0 obj\n");
            ms.Write(objects[i]);
            Write("\nendobj\n");
        }
        var xref = ms.Position;
        Write($"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n");
        foreach (var o in offsets) Write($"{o:D10} 00000 n \n");
        Write($"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n{xref}\n%%EOF");
        return ms.ToArray();
    }
}

package com.employeeportal.data.demo

/** Minimal PDF 1.4 writer (port of the backend PdfRenderer), enough for payslips and letters. */
internal object DemoPdf {
    private class Page {
        val sb = StringBuilder()
        fun text(x: Number, y: Number, s: String, size: Number, bold: Boolean = false, gray: Double = 0.1) {
            sb.append("BT $gray g /${if (bold) "F2" else "F1"} $size Tf $x $y Td (${esc(s)}) Tj ET\n")
        }
        fun right(r: Double, y: Number, s: String, size: Double, bold: Boolean = false, gray: Double = 0.1) = text(r - width(s, size, bold), y, s, size, bold, gray)
        fun rect(x: Number, y: Number, w: Number, h: Number, r: Double, g: Double, b: Double) = sb.append("$r $g $b rg $x $y $w $h re f\n")
        fun line(x1: Number, y1: Number, x2: Number, y2: Number, gray: Double) = sb.append("$gray G 0.6 w $x1 $y1 m $x2 $y2 l S\n")
    }

    private fun esc(s: String) = s.replace("–", "-").replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    private fun width(s: String, size: Double, bold: Boolean) = s.sumOf { c ->
        when {
            c.isDigit() || c == '$' -> 556
            c == '.' || c == ',' || c == ' ' -> 278
            c.isUpperCase() -> if (bold) 722 else 667
            c in "ilj" -> 222
            c in "mw" -> 833
            else -> if (bold) 611 else 556
        }.toInt()
    } * size / 1000

    private fun latin1(s: String) = ByteArray(s.length) { i -> s[i].code.let { if (it < 256) it.toByte() else '?'.code.toByte() } }

    private fun build(page: Page, title: String): ByteArray {
        val content = page.sb.toString()
        val objects = listOf(
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [6 0 R] /Count 1 >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
            "<< /Title (${esc(title)}) /Producer (Employee Portal Demo) >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 7 0 R >>",
            "<< /Length ${content.length} >>\nstream\n${content}endstream",
        )
        val out = StringBuilder("%PDF-1.4\n")
        val offsets = objects.mapIndexed { i, o -> out.length.also { out.append("${i + 1} 0 obj\n$o\nendobj\n") } }
        val xref = out.length
        out.append("xref\n0 ${objects.size + 1}\n0000000000 65535 f \n")
        offsets.forEach { out.append(it.toString().padStart(10, '0')).append(" 00000 n \n") }
        out.append("trailer\n<< /Size ${objects.size + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n$xref\n%%EOF")
        return latin1(out.toString())
    }

    private const val COMPANY = "Employee Portal S.A."
    private fun money(n: Double) = com.employeeportal.core.format.money(n)

    fun payslip(
        number: String, decimo: Boolean, employee: String, code: String, title: String, payDate: String, period: String,
        earnings: List<PanamaRules.Line>, deductions: List<PanamaRules.Line>,
    ): ByteArray {
        val p = Page()
        val l = 50; val r = 545.0
        p.rect(0, 762, 595, 80, 0.07, 0.09, 0.15)
        p.text(l, 806, COMPANY, 16, true, 1.0)
        p.text(l, 786, if (decimo) "Comprobante de décimo tercer mes" else "Comprobante de pago", 11, false, 0.8)
        p.right(r, 806, number, 11.0, true, gray = 1.0)
        var y = 730
        fun field(x: Int, label: String, value: String) { p.text(x, y, label.uppercase(), 7.5, false, 0.45); p.text(x, y - 13, value, 10.5) }
        field(l, "Empleado", employee); field(300, "Código", code); y -= 36
        field(l, "Cargo", title); field(300, "Fecha de pago", payDate); y -= 36
        field(l, "Período", period); y -= 40
        fun section(name: String, lines: List<PanamaRules.Line>) {
            p.text(l, y, name, 9, true, 0.35); y -= 8; p.line(l, y, r, y, 0.8); y -= 18
            lines.forEach { p.text(l, y, it.description, 10.5); p.right(r, y, money(it.amount), 10.5); y -= 18 }
            p.line(l, y + 8, r, y + 8, 0.9); y -= 6
            p.text(l, y, "TOTAL", 10, true); p.right(r, y, money(lines.sumOf { it.amount }), 10.5, true); y -= 14
        }
        section("INGRESOS", earnings); y -= 18
        section("DEDUCCIONES", deductions); y -= 26
        p.rect(l, y - 18, r - l, 44, 0.94, 0.96, 1.0)
        p.text(l + 14, y, "NETO A RECIBIR", 11, true)
        p.right(r - 14, y - 2, money(earnings.sumOf { it.amount } - deductions.sumOf { it.amount }), 18.0, true)
        p.text(l, 55, "Documento generado por Employee Portal (modo demo). Datos ficticios.", 8, false, 0.5)
        return build(p, "Comprobante $number")
    }

    fun letter(title: String, paragraphs: List<String>): ByteArray {
        val p = Page()
        p.rect(0, 812, 595, 30, 0.07, 0.09, 0.15)
        p.text(50, 822, COMPANY, 10, true, 1.0)
        p.text(50, 760, title, 18, true)
        var y = 720
        paragraphs.forEach { para ->
            var line = ""
            para.split(" ").forEach { w ->
                if ((line + " " + w).length > 92 && line.isNotEmpty()) { p.text(50, y, line, 10.5); y -= 15; line = w } else line = if (line.isEmpty()) w else "$line $w"
            }
            if (line.isNotEmpty()) { p.text(50, y, line, 10.5); y -= 15 }
            y -= 10
        }
        p.text(50, 70, "Documento generado electrónicamente (modo demo). Datos ficticios.", 8, false, 0.5)
        return build(p, title)
    }
}

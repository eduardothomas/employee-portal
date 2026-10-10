// Minimal PDF 1.4 writer (port of Infrastructure/Pdf/PdfRenderer.cs) for the demo backend.

class Page {
  content = ''
  text(x: number, y: number, s: string, size: number, bold = false, gray = 0.1) {
    this.content += `BT ${gray} g /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${esc(s)}) Tj ET\n`
  }
  right(r: number, y: number, s: string, size: number, bold = false, gray = 0.1) {
    this.text(r - width(s, size, bold), y, s, size, bold, gray)
  }
  rect(x: number, y: number, w: number, h: number, r: number, g: number, b: number) {
    this.content += `${r} ${g} ${b} rg ${x} ${y} ${w} ${h} re f\n`
  }
  line(x1: number, y1: number, x2: number, y2: number, gray: number) {
    this.content += `${gray} G 0.6 w ${x1} ${y1} m ${x2} ${y2} l S\n`
  }
}

const esc = (s: string) => s.replace(/[–—]/g, '-').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

function width(s: string, size: number, bold: boolean) {
  let u = 0
  for (const c of s) {
    if (/[0-9$]/.test(c)) u += 556
    else if (/[., ]/.test(c)) u += 278
    else if (/[A-Z]/.test(c)) u += bold ? 722 : 667
    else if (/[ilj]/.test(c)) u += 222
    else if (/[mw]/.test(c)) u += 833
    else u += bold ? 611 : 556
  }
  return (u * size) / 1000
}

/** Latin-1 bytes so accented Spanish text renders with WinAnsiEncoding. */
function latin1(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    out[i] = c < 256 ? c : 63
  }
  return out
}

function build(page: Page, title: string): Blob {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [6 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${esc(title)}) /Producer (Employee Portal Demo) >>`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 7 0 R >>',
    `<< /Length ${page.content.length} >>\nstream\n${page.content}endstream`,
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([latin1(out) as BlobPart], { type: 'application/pdf' })
}

const money = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const COMPANY = 'Employee Portal S.A.'

export interface PayslipPdfInput {
  number: string
  kind: string
  id: string
  employeeName: string
  employeeCode: string
  jobTitle: string
  payDateLong: string
  period: string
  earnings: { description: string; amount: number }[]
  deductions: { description: string; amount: number }[]
  gross: number
  totalDeductions: number
  net: number
}

export function payslipPdf(p: PayslipPdfInput): Blob {
  const pg = new Page()
  const L = 50, R = 545
  pg.rect(0, 762, 595, 80, 0.07, 0.09, 0.15)
  pg.text(L, 806, COMPANY, 16, true, 1)
  pg.text(L, 786, p.kind === 'decimo' ? 'Comprobante de décimo tercer mes' : 'Comprobante de pago', 11, false, 0.8)
  pg.right(R, 806, p.number, 11, true, 1)
  let y = 730
  const field = (x: number, label: string, value: string) => {
    pg.text(x, y, label.toUpperCase(), 7.5, false, 0.45)
    pg.text(x, y - 13, value, 10.5)
  }
  field(L, 'Empleado', p.employeeName); field(300, 'Código', p.employeeCode); y -= 36
  field(L, 'Cargo', p.jobTitle); field(300, 'Fecha de pago', p.payDateLong); y -= 36
  field(L, 'Período', p.period); y -= 40
  const section = (title: string, lines: { description: string; amount: number }[], total: number) => {
    pg.text(L, y, title, 9, true, 0.35); y -= 8; pg.line(L, y, R, y, 0.8); y -= 18
    for (const l of lines) { pg.text(L, y, l.description, 10.5); pg.right(R, y, money(l.amount), 10.5); y -= 18 }
    pg.line(L, y + 8, R, y + 8, 0.9); y -= 6
    pg.text(L, y, 'TOTAL', 10, true); pg.right(R, y, money(total), 10.5, true); y -= 14
  }
  section('INGRESOS', p.earnings, p.gross); y -= 18
  section('DEDUCCIONES', p.deductions, p.totalDeductions); y -= 26
  pg.rect(L, y - 18, R - L, 44, 0.94, 0.96, 1)
  pg.text(L + 14, y, 'NETO A RECIBIR', 11, true)
  pg.right(R - 14, y - 2, money(p.net), 18, true)
  pg.line(L, 70, R, 70, 0.85)
  pg.text(L, 55, 'Documento generado por Employee Portal (modo demo). Datos ficticios.', 8, false, 0.5)
  return build(pg, `Comprobante ${p.number}`)
}

export function letterPdf(title: string, paragraphs: string[]): Blob {
  const pg = new Page()
  pg.rect(0, 812, 595, 30, 0.07, 0.09, 0.15)
  pg.text(50, 822, COMPANY, 10, true, 1)
  pg.text(50, 760, title, 18, true)
  let y = 720
  for (const para of paragraphs) {
    let line = ''
    for (const word of para.split(' ')) {
      if ((line + ' ' + word).length > 92 && line) { pg.text(50, y, line, 10.5); y -= 15; line = word }
      else line = line ? `${line} ${word}` : word
    }
    if (line) { pg.text(50, y, line, 10.5); y -= 15 }
    y -= 10
  }
  pg.text(50, 70, 'Documento generado electrónicamente (modo demo). Datos ficticios.', 8, false, 0.5)
  return build(pg, title)
}

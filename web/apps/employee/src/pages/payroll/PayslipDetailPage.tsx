import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { MONTHS, formatDate, parseDate, useResource } from '@ep/shared'
import type { PayslipDetail } from '@ep/shared'
import { PdfViewer } from '../../components/LazyPdfViewer'
import { Load, Money, NavBar } from '../../components/ui'
import { biometric, biometricLabel } from '../../lib/biometric'
import { Breakdown } from './Breakdown'

export function PayslipDetailPage() {
  const { id } = useParams()
  const res = useResource<PayslipDetail>(`/me/payslips/${id}`)
  const [viewing, setViewing] = useState(false)
  const protectedPdf = biometric.isEnrolled()

  return (
    <>
      <NavBar title="Comprobante" />
      <div className="page">
        <Load res={res}>
          {(p) => {
            const d = parseDate(p.summary.payDate)
            return (
              <>
                <div className="center" style={{ margin: '16px 0 28px' }}>
                  <p className="muted">{p.summary.kind === 'decimo' ? 'Décimo tercer mes' : 'Comprobante'} · {p.summary.number}</p>
                  <h1 style={{ fontSize: 22, fontWeight: 600, margin: '4px 0 16px' }}>
                    {d.getDate()} {MONTHS[d.getMonth()]} {d.getFullYear()}
                  </h1>
                  <p className="muted small">Neto</p>
                  <div className="amount-xl"><Money value={p.summary.net} /></div>
                  <p className="muted small" style={{ marginTop: 6 }}>
                    Período {formatDate(p.summary.periodStart)} – {formatDate(p.summary.periodEnd)}
                  </p>
                </div>

                <button className="btn block" onClick={() => setViewing(true)}>
                  {protectedPdf ? '🔒 ' : ''}Ver PDF
                </button>
                {protectedPdf && <p className="form-note center">Protegido con {biometricLabel()}</p>}

                <div className="spacer" />
                <Breakdown earnings={p.earnings} deductions={p.deductionLines} gross={p.summary.gross} totalDeductions={p.summary.deductions} net={p.summary.net} />

                {viewing && (
                  <PdfViewer path={`/me/payslips/${p.summary.id}/pdf`} fileName={`comprobante-${p.summary.payDate}.pdf`}
                    title={`Comprobante ${formatDate(p.summary.payDate)}`} protect onClose={() => setViewing(false)} />
                )}
              </>
            )
          }}
        </Load>
      </div>
    </>
  )
}

import { formatDate, formatLongDate, formatMoney, monthName, useResource } from '@ep/shared'
import type { PayrollSummary } from '@ep/shared'
import { Link } from 'react-router-dom'
import { Load, Money, Row, Section } from '../../components/ui'

export function PayrollPage() {
  const res = useResource<PayrollSummary>('/me/payroll')

  return (
    <div className="page">
      <h1 className="large-title">Payroll</h1>
      <Load res={res}>
        {(p) => (
          <>
            <div className="wallet">
              <span className="wallet-label">Salario mensual</span>
              <div className="wallet-amount"><Money value={p.monthlySalary} /></div>
              <div className="wallet-footer">
                <div>
                  <div className="wallet-meta small">Próximo pago</div>
                  <div style={{ fontWeight: 600 }}>{formatLongDate(p.nextPayDate)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="wallet-meta small">Neto estimado</div>
                  <div style={{ fontWeight: 600 }}>{formatMoney(p.nextPayEstimatedNet)}</div>
                </div>
              </div>
            </div>

            {p.latestPayslip && (
              <Section title="Comprobante más reciente">
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="muted small">{formatDate(p.latestPayslip.payDate)}</div>
                      <div className="amount-lg"><Money value={p.latestPayslip.net} /></div>
                    </div>
                    <span className="badge approved">Pagado</span>
                  </div>
                  <Link to={`/payroll/payslips/${p.latestPayslip.id}`} className="btn secondary block" style={{ marginTop: 16 }}>Ver comprobante</Link>
                </div>
              </Section>
            )}

            <Section title="Explorar">
              <div className="list">
                <Row icon="💵" title="Comprobantes" to="/payroll/payslips" />
                <Row icon="📊" title="Descuentos" to="/payroll/deductions" />
                <Row icon="🎁" title="Décimo tercer mes" to="/payroll/decimo" />
              </div>
            </Section>

            <Section title="Historial">
              <div className="list">
                {p.history.map((h) => (
                  <Row key={`${h.year}-${h.month}`} title={`${monthName(h.month)} ${h.year}`} subtitle={`Bruto ${formatMoney(h.gross)}`}
                    value={<Money value={h.net} />} strong to={`/payroll/month/${h.year}/${h.month}`} />
                ))}
              </div>
            </Section>
          </>
        )}
      </Load>
    </div>
  )
}

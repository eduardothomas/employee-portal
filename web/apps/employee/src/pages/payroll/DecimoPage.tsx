import { formatDate, formatLongDate, formatMoney, useResource } from '@ep/shared'
import type { Decimo } from '@ep/shared'
import { Empty, Load, Money, NavBar, Row, Section } from '../../components/ui'

export function DecimoPage() {
  const res = useResource<Decimo>('/me/decimo')

  return (
    <>
      <NavBar title="Décimo" />
      <div className="page">
        <h1 className="large-title">Décimo</h1>
        <Load res={res}>
          {(d) => (
            <>
              <div className="wallet green">
                <span className="wallet-label">Próximo pago · estimado</span>
                <div className="wallet-amount"><Money value={d.estimatedNet} /></div>
                <div className="wallet-footer">
                  <span className="wallet-meta">{formatLongDate(d.nextPayDate)}</span>
                  <span className="wallet-meta small">Bruto {formatMoney(d.estimatedGross)}</span>
                </div>
              </div>
              <p className="form-note">
                Período {formatDate(d.periodStart)} – {formatDate(d.periodEnd)}. Se paga en tres partidas (15 de abril, agosto y diciembre),
                cada una equivalente a 1/12 de lo devengado en el período, menos 7.25% de CSS.
              </p>

              <Section title="Historial">
                {d.history.length === 0 ? (
                  <div className="list"><Empty emoji="🎁">Sin pagos anteriores</Empty></div>
                ) : (
                  <div className="list">
                    {d.history.map((p) => (
                      <Row key={p.id} title={formatDate(p.payDate)} value={<Money value={p.net} />} strong to={`/payroll/payslips/${p.id}`} />
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </Load>
      </div>
    </>
  )
}

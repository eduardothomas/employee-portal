import { MONTHS, capitalize, parseDate, useResource } from '@ep/shared'
import type { PayslipSummary } from '@ep/shared'
import { Empty, Load, Money, NavBar, Row } from '../../components/ui'

export function PayslipsPage() {
  const res = useResource<PayslipSummary[]>('/me/payslips')

  return (
    <>
      <NavBar title="Comprobantes" />
      <div className="page">
        <h1 className="large-title">Comprobantes</h1>
        <Load res={res}>
          {(list) => {
            if (list.length === 0) return <Empty emoji="🧾">Aún no tienes comprobantes</Empty>
            // year → month → payslips
            const years = new Map<number, Map<number, PayslipSummary[]>>()
            for (const p of list) {
              const d = parseDate(p.payDate)
              const months = years.get(d.getFullYear()) ?? new Map()
              months.set(d.getMonth(), [...(months.get(d.getMonth()) ?? []), p])
              years.set(d.getFullYear(), months)
            }
            return [...years].map(([year, months]) => (
              <section key={year} style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 4px 12px' }}>{year}</h2>
                {[...months].map(([month, slips]) => (
                  <div key={month} style={{ marginBottom: 16 }}>
                    <h3 className="section-title">{capitalize(MONTHS[month])}</h3>
                    <div className="list">
                      {slips.map((p) => (
                        <Row key={p.id} icon={p.kind === 'decimo' ? '🎁' : '💵'}
                          title={`${parseDate(p.payDate).getDate()} ${capitalize(MONTHS[month]).slice(0, 3)}`}
                          subtitle={p.kind === 'decimo' ? 'Décimo tercer mes' : 'Quincena'}
                          value={<Money value={p.net} />} strong to={`/payroll/payslips/${p.id}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ))
          }}
        </Load>
      </div>
    </>
  )
}

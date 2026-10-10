import { useState } from 'react'
import { MONTHS_SHORT, formatMoney, monthName, useResource } from '@ep/shared'
import type { Deductions } from '@ep/shared'
import { Load, NavBar, Section } from '../../components/ui'

export function DeductionsPage() {
  const [period, setPeriod] = useState<{ year: number; month: number } | null>(null)
  const res = useResource<Deductions>(period ? `/me/deductions?year=${period.year}&month=${period.month}` : '/me/deductions')
  const [tab, setTab] = useState<'month' | 'ytd'>('month')

  return (
    <>
      <NavBar title="Descuentos" />
      <div className="page">
        <h1 className="large-title">Descuentos</h1>
        <Load res={res}>
          {(d) => {
            const history = [...d.history].reverse()
            const max = Math.max(...history.map((h) => h.total), 1)
            const items = tab === 'month' ? d.items : d.yearToDate
            const total = items.reduce((s, i) => s + i.amount, 0)
            return (
              <>
                <div className="card">
                  <p className="muted small">Historial · toca un mes</p>
                  <div className="bars">
                    {history.map((h) => (
                      <button key={`${h.year}-${h.month}`} className={`bar${h.year === d.year && h.month === d.month ? ' current' : ''}`}
                        style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }}
                        onClick={() => setPeriod({ year: h.year, month: h.month })} aria-label={`${monthName(h.month)} ${h.year}: ${formatMoney(h.total)}`}>
                        <span style={{ height: `${(h.total / max) * 100}%` }} />
                        <small>{MONTHS_SHORT[h.month - 1]}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="spacer" />
                <div className="segmented">
                  <button className={tab === 'month' ? 'active' : ''} onClick={() => setTab('month')}>{monthName(d.month)} {d.year}</button>
                  <button className={tab === 'ytd' ? 'active' : ''} onClick={() => setTab('ytd')}>Acumulado {d.year}</button>
                </div>

                <Section>
                  <div className="card">
                    <table className="breakdown">
                      <tbody>
                        {items.map((i) => (
                          <tr key={i.code}><td>{i.description}</td><td>{formatMoney(i.amount)}</td></tr>
                        ))}
                        <tr className="total"><td>Total</td><td>{formatMoney(total)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="form-note">CSS 9.75% · Seguro Educativo 1.25% · ISR según tabla progresiva de la DGI.</p>
                </Section>
              </>
            )
          }}
        </Load>
      </div>
    </>
  )
}

import { useParams } from 'react-router-dom'
import { formatDate, monthName, useResource } from '@ep/shared'
import type { MonthDetail } from '@ep/shared'
import { Load, Money, NavBar, Row, Section } from '../../components/ui'
import { Breakdown } from './Breakdown'

export function MonthDetailPage() {
  const { year, month } = useParams()
  const res = useResource<MonthDetail>(`/me/payroll/months/${year}/${month}`)
  const title = `${monthName(Number(month))} ${year}`

  return (
    <>
      <NavBar title={title} />
      <div className="page">
        <h1 className="large-title">{title}</h1>
        <Load res={res}>
          {(m) => (
            <>
              <Breakdown earnings={m.earnings} deductions={m.deductionLines} gross={m.gross} totalDeductions={m.deductions} net={m.net} />
              <Section title="Pagos del mes">
                <div className="list">
                  {m.payslips.map((p) => (
                    <Row key={p.id} title={formatDate(p.payDate)} value={<Money value={p.net} />} to={`/payroll/payslips/${p.id}`} />
                  ))}
                </div>
              </Section>
            </>
          )}
        </Load>
      </div>
    </>
  )
}

import { formatMoney } from '@ep/shared'
import type { PayslipLine } from '@ep/shared'
import { Section } from '../../components/ui'

export function Breakdown({ earnings, deductions, gross, totalDeductions, net }: {
  earnings: PayslipLine[]
  deductions: PayslipLine[]
  gross: number
  totalDeductions: number
  net: number
}) {
  return (
    <>
      <Section title="Ingresos">
        <div className="card">
          <table className="breakdown">
            <tbody>
              {earnings.map((l) => (
                <tr key={l.code}><td>{l.description}</td><td>{formatMoney(l.amount)}</td></tr>
              ))}
              <tr className="total"><td>Total</td><td>{formatMoney(gross)}</td></tr>
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Descuentos">
        <div className="card">
          <table className="breakdown">
            <tbody>
              {deductions.map((l) => (
                <tr key={l.code}><td>{l.description}</td><td>−{formatMoney(l.amount)}</td></tr>
              ))}
              <tr className="total"><td>Total</td><td>−{formatMoney(totalDeductions)}</td></tr>
            </tbody>
          </table>
        </div>
      </Section>
      <div className="section net-box">
        <span style={{ fontWeight: 600 }}>NETO</span>
        <span className="amount-lg">{formatMoney(net)}</span>
      </div>
    </>
  )
}

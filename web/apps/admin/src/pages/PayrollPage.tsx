import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage, formatDate, formatMoney, useAuth, useResource } from '@ep/shared'
import type { PayrollRun, PayrollRunDetail } from '@ep/shared'
import { Badge, FormField, Load, Modal, PageHeader, Panel, toast } from '../components/ui'

export function PayrollPage() {
  const { api } = useAuth()
  const navigate = useNavigate()
  const res = useResource<PayrollRun[]>('/admin/payroll-runs')
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('regular')
  const [payDate, setPayDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    setError(null)
    try {
      const run = await api.post<PayrollRunDetail>('/admin/payroll-runs', { kind, payDate })
      toast('Planilla generada en borrador')
      navigate(`/payroll/${run.run.id}`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function accrue() {
    if (!confirm('¿Sumar 2.73 días de vacaciones (30/11) a todos los colaboradores activos?')) return
    try {
      const r = await api.post<{ employees: number }>('/admin/vacations/accrue')
      toast(`Vacaciones acumuladas para ${r.employees} colaboradores`)
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="Planillas" subtitle="Quincenas el 15 y último día de cada mes · Décimo el 15 de abril, agosto y diciembre"
        actions={<>
          <button className="btn secondary" onClick={accrue}>Acumular vacaciones del mes</button>
          <button className="btn" onClick={() => setOpen(true)}>+ Nueva planilla</button>
        </>} />
      <Panel body={false}>
        <Load res={res}>
          {(runs) => (
            <table className="table">
              <thead><tr><th>Fecha de pago</th><th>Tipo</th><th>Período</th><th className="num">Colaboradores</th><th className="num">Bruto</th><th className="num">Deducciones</th><th className="num">Neto</th><th>Estado</th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => navigate(`/payroll/${r.id}`)}>
                    <td><b>{formatDate(r.payDate)}</b></td>
                    <td>{r.kind === 'decimo' ? '🎁 Décimo' : 'Quincena'}</td>
                    <td className="muted">{formatDate(r.periodStart)} – {formatDate(r.periodEnd)}</td>
                    <td className="num">{r.employeeCount}</td>
                    <td className="num">{formatMoney(r.totalGross)}</td>
                    <td className="num">{formatMoney(r.totalDeductions)}</td>
                    <td className="num"><b>{formatMoney(r.totalNet)}</b></td>
                    <td><Badge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Load>
      </Panel>

      <Modal open={open} title="Nueva planilla" onClose={() => setOpen(false)}
        footer={<><button className="btn secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="btn" disabled={busy || !payDate} onClick={create}>Generar borrador</button></>}>
        <div className="stack">
          <FormField label="Tipo">
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="regular">Quincena regular</option>
              <option value="decimo">Décimo tercer mes</option>
            </select>
          </FormField>
          <FormField label="Fecha de pago">
            <input className="input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </FormField>
          <p className="muted small">Se calculan CSS (9.75%), Seguro Educativo (1.25%), ISR y descuentos fijos de cada colaborador. Los comprobantes no serán visibles hasta publicar.</p>
          {error && <div className="alert error">{error}</div>}
        </div>
      </Modal>
    </>
  )
}

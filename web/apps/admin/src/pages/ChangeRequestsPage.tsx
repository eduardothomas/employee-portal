import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDateTime, useAuth, useResource } from '@ep/shared'
import type { ChangeRequest } from '@ep/shared'
import { Badge, Load, PageHeader, Panel, ReviewModal, toast } from '../components/ui'

const FIELD: Record<string, string> = {
  firstName: 'Nombre', lastName: 'Apellido', jobTitle: 'Cargo', department: 'Departamento', monthlySalary: 'Salario',
  hireDate: 'Fecha de ingreso', manager: 'Supervisor', bankAccount: 'Cuenta bancaria', nationalId: 'Cédula',
}

export function ChangeRequestsPage() {
  const { api } = useAuth()
  const [status, setStatus] = useState('pending')
  const res = useResource<ChangeRequest[]>(`/admin/change-requests?status=${status}`)
  const [selected, setSelected] = useState<ChangeRequest | null>(null)

  async function decide(approve: boolean, comment: string) {
    if (!selected) return
    await api.post(`/admin/change-requests/${selected.id}/${approve ? 'approve' : 'reject'}`, { comment: comment || null })
    toast(approve ? 'Aprobada — recuerda aplicar el cambio en la ficha del colaborador' : 'Solicitud rechazada')
    setSelected(null)
    void res.reload()
  }

  return (
    <>
      <PageHeader title="Solicitudes de cambio" subtitle="Datos que el colaborador no puede editar directamente"
        actions={
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
          </select>
        } />
      <Panel body={false}>
        <Load res={res}>
          {(list) => list.length === 0 ? <div className="empty">No hay solicitudes</div> : (
            <table className="table">
              <thead><tr><th>Colaborador</th><th>Campo</th><th>Valor actual</th><th>Valor solicitado</th><th>Motivo</th><th>Fecha</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td><Link to={`/employees/${c.employeeId}`}><b>{c.employeeName}</b></Link></td>
                    <td>{FIELD[c.field] ?? c.field}</td>
                    <td className="muted">{c.currentValue ?? '—'}</td>
                    <td><b>{c.requestedValue}</b></td>
                    <td className="muted">{c.reason ?? '—'}</td>
                    <td className="muted">{formatDateTime(c.createdAt)}</td>
                    <td><Badge status={c.status} /></td>
                    <td className="num">{c.status === 'pending' && <button className="btn sm" onClick={() => setSelected(c)}>Revisar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Load>
      </Panel>
      {selected && (
        <ReviewModal title={`${FIELD[selected.field] ?? selected.field} · ${selected.employeeName}`}
          detail={<dl className="dl">
            <dt>Actual</dt><dd>{selected.currentValue ?? '—'}</dd>
            <dt>Solicitado</dt><dd><b>{selected.requestedValue}</b></dd>
            <dt>Motivo</dt><dd>{selected.reason ?? '—'}</dd>
          </dl>}
          onClose={() => setSelected(null)} onDecide={decide} />
      )}
    </>
  )
}

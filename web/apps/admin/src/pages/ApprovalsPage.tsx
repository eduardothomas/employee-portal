import { useState } from 'react'
import { formatDate, formatDateTime, useAuth, useResource } from '@ep/shared'
import type { LeaveRequest, VacationRequest } from '@ep/shared'
import { Badge, Load, PageHeader, Panel, ReviewModal, toast } from '../components/ui'

type Selected = { kind: 'vacations'; item: VacationRequest } | { kind: 'leave-requests'; item: LeaveRequest }

export function ApprovalsPage() {
  const { api } = useAuth()
  const [status, setStatus] = useState('pending')
  const vacations = useResource<VacationRequest[]>(`/manager/vacations?status=${status}`)
  const leaves = useResource<LeaveRequest[]>(`/manager/leave-requests?status=${status}`)
  const [selected, setSelected] = useState<Selected | null>(null)

  async function decide(approve: boolean, comment: string) {
    if (!selected) return
    await api.post(`/manager/${selected.kind}/${selected.item.id}/${approve ? 'approve' : 'reject'}`, { comment: comment || null })
    toast(approve ? 'Solicitud aprobada · el colaborador fue notificado' : 'Solicitud rechazada')
    setSelected(null)
    void vacations.reload()
    void leaves.reload()
  }

  const pending = status === 'pending'

  return (
    <>
      <PageHeader title="Aprobaciones" subtitle="Vacaciones y permisos de tu equipo"
        actions={
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        } />

      <Panel title="Vacaciones" body={false}>
        <Load res={vacations}>
          {(list) => list.length === 0 ? <div className="empty">No hay solicitudes</div> : (
            <table className="table">
              <thead><tr><th>Número</th><th>Colaborador</th><th>Fechas</th><th className="num">Días</th><th>Comentario</th><th>Solicitado</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {list.map((v) => (
                  <tr key={v.id}>
                    <td className="mono">{v.number}</td>
                    <td><b>{v.employeeName}</b></td>
                    <td>{formatDate(v.startDate)} – {formatDate(v.endDate)}</td>
                    <td className="num">{v.days}</td>
                    <td className="muted">{v.comment ?? '—'}</td>
                    <td className="muted">{formatDateTime(v.createdAt)}</td>
                    <td><Badge status={v.status} />{v.reviewerName && <div className="muted small">{v.reviewerName}</div>}</td>
                    <td className="num">{pending && <button className="btn sm" onClick={() => setSelected({ kind: 'vacations', item: v })}>Revisar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Load>
      </Panel>

      <Panel title="Permisos" body={false}>
        <Load res={leaves}>
          {(list) => list.length === 0 ? <div className="empty">No hay solicitudes</div> : (
            <table className="table">
              <thead><tr><th>Número</th><th>Colaborador</th><th>Tipo</th><th>Fecha</th><th>Motivo</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {list.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{l.number}</td>
                    <td><b>{l.employeeName}</b></td>
                    <td>{l.leaveTypeIcon} {l.leaveTypeName}</td>
                    <td>{formatDate(l.startDate)}{l.endDate !== l.startDate && ` – ${formatDate(l.endDate)}`}{l.hours && <span className="muted"> · {l.hours} h</span>}</td>
                    <td className="muted">{l.reason}</td>
                    <td><Badge status={l.status} />{l.reviewerName && <div className="muted small">{l.reviewerName}</div>}</td>
                    <td className="num">{pending && <button className="btn sm" onClick={() => setSelected({ kind: 'leave-requests', item: l })}>Revisar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Load>
      </Panel>

      {selected && (
        <ReviewModal
          title={selected.kind === 'vacations' ? `Vacaciones · ${selected.item.employeeName}` : `Permiso · ${selected.item.employeeName}`}
          detail={selected.kind === 'vacations' ? (
            <dl className="dl">
              <dt>Fechas</dt><dd>{formatDate(selected.item.startDate)} – {formatDate(selected.item.endDate)}</dd>
              <dt>Días laborables</dt><dd>{selected.item.days}</dd>
              <dt>Comentario</dt><dd>{selected.item.comment ?? '—'}</dd>
            </dl>
          ) : (
            <dl className="dl">
              <dt>Tipo</dt><dd>{selected.item.leaveTypeIcon} {selected.item.leaveTypeName}</dd>
              <dt>Fecha</dt><dd>{formatDate(selected.item.startDate)}{selected.item.hours ? ` · ${selected.item.hours} horas` : ''}</dd>
              <dt>Motivo</dt><dd>{selected.item.reason}</dd>
            </dl>
          )}
          onClose={() => setSelected(null)}
          onDecide={decide}
        />
      )}
    </>
  )
}

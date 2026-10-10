import { useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage, formatShortDate, useAuth, useResource } from '@ep/shared'
import type { LeaveRequest } from '@ep/shared'
import { Empty, Load, NavBar, Row, Section, Sheet, StatusBadge, toast } from '../../components/ui'

export function LeavePage() {
  const { api } = useAuth()
  const res = useResource<LeaveRequest[]>('/me/leave-requests')
  const [selected, setSelected] = useState<LeaveRequest | null>(null)

  async function cancel(l: LeaveRequest) {
    try {
      await api.post(`/me/leave-requests/${l.id}/cancel`)
      toast('Permiso cancelado')
      setSelected(null)
      void res.reload()
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  const row = (l: LeaveRequest) => (
    <Row key={l.id} icon={l.leaveTypeIcon} title={l.leaveTypeName}
      subtitle={`${formatShortDate(l.startDate)}${l.endDate !== l.startDate ? ` – ${formatShortDate(l.endDate)}` : ''}${l.hours ? ` · ${l.hours} h` : ''}`}
      value={<StatusBadge status={l.status} />} onClick={() => setSelected(l)} />
  )

  return (
    <>
      <NavBar title="Permisos" />
      <div className="page">
        <h1 className="large-title">Permisos</h1>
        <Link to="/time/leave/new" className="btn block">+ Nuevo permiso</Link>
        <Load res={res}>
          {(list) => {
            const pending = list.filter((l) => l.status === 'pending')
            const history = list.filter((l) => l.status !== 'pending')
            return (
              <>
                <Section title="Pendientes">
                  <div className="list">{pending.length ? pending.map(row) : <Empty emoji="👌">Sin permisos pendientes</Empty>}</div>
                </Section>
                <Section title="Historial">
                  <div className="list">{history.length ? history.map(row) : <Empty emoji="🗂️">Sin historial</Empty>}</div>
                </Section>
              </>
            )
          }}
        </Load>
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.leaveTypeIcon} ${selected.leaveTypeName}` : ''}>
        {selected && (
          <>
            <div className="list">
              <Row title="Número" value={selected.number} />
              <Row title="Fecha" value={formatShortDate(selected.startDate)} />
              {selected.hours && <Row title="Horas" value={selected.hours} />}
              <Row title="Estado" value={<StatusBadge status={selected.status} />} />
              <Row title="Motivo" subtitle={selected.reason} />
              {selected.reviewerName && <Row title="Revisado por" value={selected.reviewerName} />}
              {selected.reviewComment && <Row title="Respuesta" subtitle={selected.reviewComment} />}
            </div>
            {selected.status === 'pending' && (
              <button className="btn danger block" style={{ marginTop: 16 }} onClick={() => cancel(selected)}>Cancelar permiso</button>
            )}
          </>
        )}
      </Sheet>
    </>
  )
}

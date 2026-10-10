import { useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage, formatDays, formatShortDate, useAuth, useResource } from '@ep/shared'
import type { LeaveRequest, VacationRequest, Vacations } from '@ep/shared'
import { Calendar } from '../../components/Calendar'
import { Empty, Load, Row, Section, Sheet, StatusBadge, toast } from '../../components/ui'

export function TimePage() {
  const { api } = useAuth()
  const vacations = useResource<Vacations>('/me/vacations')
  const leaves = useResource<LeaveRequest[]>('/me/leave-requests')
  const [tab, setTab] = useState<'vacations' | 'calendar'>('vacations')
  const [selected, setSelected] = useState<VacationRequest | null>(null)

  async function cancel(v: VacationRequest) {
    try {
      await api.post(`/me/vacations/${v.id}/cancel`)
      toast('Solicitud cancelada')
      setSelected(null)
      void vacations.reload()
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  return (
    <div className="page">
      <h1 className="large-title">Tiempo</h1>
      <div className="segmented">
        <button className={tab === 'vacations' ? 'active' : ''} onClick={() => setTab('vacations')}>Vacaciones</button>
        <button className={tab === 'calendar' ? 'active' : ''} onClick={() => setTab('calendar')}>Calendario</button>
      </div>

      <Load res={vacations}>
        {(v) =>
          tab === 'calendar' ? (
            <div className="card">
              <Calendar
                initialMonth={v.upcoming ? new Date(v.upcoming.startDate + 'T00:00') : undefined}
                holidays={v.holidays}
                ranges={[
                  ...v.requests.filter((r) => r.status === 'approved' || r.status === 'pending')
                    .map((r) => ({ start: r.startDate, end: r.endDate, kind: 'vacation' as const, pending: r.status === 'pending' })),
                  ...(leaves.data ?? []).filter((l) => l.status === 'approved' || l.status === 'pending')
                    .map((l) => ({ start: l.startDate, end: l.endDate, kind: 'leave' as const, pending: l.status === 'pending' })),
                ]}
              />
            </div>
          ) : (
            <>
              <div className="stats">
                <div className="stat accent"><div className="stat-value">{v.balance.available}</div><div className="stat-label">Disponibles</div></div>
                <div className="stat"><div className="stat-value">{v.balance.used}</div><div className="stat-label">Utilizados</div></div>
                <div className="stat"><div className="stat-value">{v.balance.accrued}</div><div className="stat-label">Acumulados</div></div>
              </div>
              {v.balance.pending > 0 && <p className="form-note">{formatDays(v.balance.pending)} en solicitudes pendientes de aprobación.</p>}

              {v.upcoming && (
                <Section title="Próximas vacaciones">
                  <button className="card" style={{ width: '100%', textAlign: 'left', border: 0, cursor: 'pointer' }} onClick={() => setSelected(v.upcoming)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="amount-lg" style={{ textTransform: 'uppercase', fontSize: 22 }}>
                          {formatShortDate(v.upcoming.startDate)} — {formatShortDate(v.upcoming.endDate)}
                        </div>
                        <div className="muted">{formatDays(v.upcoming.days)} laborables</div>
                      </div>
                      <StatusBadge status={v.upcoming.status} />
                    </div>
                  </button>
                </Section>
              )}

              <div className="section">
                <Link to="/time/vacations/new" className="btn block">Solicitar vacaciones</Link>
              </div>

              <Section title="Solicitudes">
                {v.requests.length === 0 ? (
                  <div className="list"><Empty emoji="🏝️">Aún no has solicitado vacaciones</Empty></div>
                ) : (
                  <div className="list">
                    {v.requests.map((r) => (
                      <Row key={r.id} title={`${formatShortDate(r.startDate)} – ${formatShortDate(r.endDate)}`}
                        subtitle={`${r.number} · ${formatDays(r.days)}`} value={<StatusBadge status={r.status} />}
                        onClick={() => setSelected(r)} />
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Permisos" action={<Link to="/time/leave">Ver todos</Link>}>
                <div className="list">
                  <Row icon="📝" title="Nuevo permiso" to="/time/leave/new" />
                  {(leaves.data ?? []).filter((l) => l.status === 'pending').slice(0, 3).map((l) => (
                    <Row key={l.id} icon={l.leaveTypeIcon} title={l.leaveTypeName} subtitle={formatShortDate(l.startDate)} value={<StatusBadge status={l.status} />} to="/time/leave" chevron={false} />
                  ))}
                </div>
              </Section>
            </>
          )
        }
      </Load>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.number}>
        {selected && (
          <>
            <div className="list">
              <Row title="Desde" value={formatShortDate(selected.startDate)} />
              <Row title="Hasta" value={formatShortDate(selected.endDate)} />
              <Row title="Días laborables" value={selected.days} />
              <Row title="Estado" value={<StatusBadge status={selected.status} />} />
              {selected.reviewerName && <Row title="Revisado por" value={selected.reviewerName} />}
              {selected.comment && <Row title="Comentario" subtitle={selected.comment} />}
              {selected.reviewComment && <Row title="Respuesta" subtitle={selected.reviewComment} />}
            </div>
            {selected.status === 'pending' && (
              <button className="btn danger block" style={{ marginTop: 16 }} onClick={() => cancel(selected)}>Cancelar solicitud</button>
            )}
          </>
        )}
      </Sheet>
    </div>
  )
}

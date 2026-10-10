import { useState } from 'react'
import { errorMessage, formatDays, formatShortDate, useAuth, useResource } from '@ep/shared'
import type { Approvals, TeamMember } from '@ep/shared'
import { Avatar, Empty, Load, NavBar, Row, Section, Sheet, toast } from '../../components/ui'

interface Pending {
  kind: 'vacations' | 'leave-requests'
  id: string
  title: string
  detail: string
}

/** Managers approve their team's requests from the phone. */
export function ApprovalsPage() {
  const { api } = useAuth()
  const approvals = useResource<Approvals>('/manager/approvals')
  const team = useResource<TeamMember[]>('/manager/team')
  const [selected, setSelected] = useState<Pending | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  async function decide(approve: boolean) {
    if (!selected) return
    setBusy(true)
    try {
      await api.post(`/manager/${selected.kind}/${selected.id}/${approve ? 'approve' : 'reject'}`, { comment: comment || null })
      toast(approve ? 'Solicitud aprobada' : 'Solicitud rechazada')
      setSelected(null)
      setComment('')
      void approvals.reload()
      void team.reload()
    } catch (e) {
      toast(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <NavBar title="Aprobaciones" />
      <div className="page">
        <Load res={approvals}>
          {(a) =>
            a.vacations.length + a.leaves.length === 0 ? (
              <Empty emoji="🎉">No hay solicitudes pendientes</Empty>
            ) : (
              <Section title="Pendientes">
                <div className="list">
                  {a.vacations.map((v) => (
                    <Row key={v.id} icon="🏖️" title={v.employeeName}
                      subtitle={`Vacaciones · ${formatShortDate(v.startDate)} – ${formatShortDate(v.endDate)} · ${formatDays(v.days)}`}
                      onClick={() => setSelected({ kind: 'vacations', id: v.id, title: `Vacaciones de ${v.employeeName}`, detail: `${formatShortDate(v.startDate)} – ${formatShortDate(v.endDate)} (${formatDays(v.days)})${v.comment ? ` · “${v.comment}”` : ''}` })} />
                  ))}
                  {a.leaves.map((l) => (
                    <Row key={l.id} icon={l.leaveTypeIcon} title={l.employeeName}
                      subtitle={`${l.leaveTypeName} · ${formatShortDate(l.startDate)}${l.hours ? ` · ${l.hours} h` : ''}`}
                      onClick={() => setSelected({ kind: 'leave-requests', id: l.id, title: `${l.leaveTypeName} — ${l.employeeName}`, detail: `${formatShortDate(l.startDate)}${l.hours ? `, ${l.hours} horas` : ''} · “${l.reason}”` })} />
                  ))}
                </div>
              </Section>
            )
          }
        </Load>

        <div className="spacer" />
        <Load res={team}>
          {(members) =>
            members.length > 0 && (
              <Section title="Mi equipo">
                <div className="list">
                  {members.map((m) => (
                    <Row key={m.id} icon={<Avatar name={m.fullName} url={m.photoUrl} size={32} />} title={m.fullName}
                      subtitle={m.awayToday ? `Hoy: ${m.awayToday}` : m.jobTitle}
                      value={<span className="small">{formatDays(m.vacationAvailable)}</span>} />
                  ))}
                </div>
              </Section>
            )
          }
        </Load>
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.title}>
        <p className="muted" style={{ marginBottom: 16 }}>{selected?.detail}</p>
        <div className="form-group">
          <div className="field">
            <label>Comentario (opcional)</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button className="btn danger" disabled={busy} onClick={() => decide(false)}>Rechazar</button>
          <button className="btn" disabled={busy} onClick={() => decide(true)}>Aprobar</button>
        </div>
      </Sheet>
    </>
  )
}

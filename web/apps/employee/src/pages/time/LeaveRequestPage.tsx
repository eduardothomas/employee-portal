import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, errorMessage, toIsoDate, useAuth, useResource } from '@ep/shared'
import type { LeaveType } from '@ep/shared'
import { Load, NavBar, toast } from '../../components/ui'

export function LeaveRequestPage() {
  const { api } = useAuth()
  const navigate = useNavigate()
  const types = useResource<LeaveType[]>('/leave-types')
  const today = toIsoDate(new Date())
  const [typeId, setTypeId] = useState('')
  const [start, setStart] = useState(today)
  const [end, setEnd] = useState(today)
  const [partial, setPartial] = useState(false)
  const [hours, setHours] = useState('2')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<ApiError | string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post('/me/leave-requests', {
        leaveTypeId: typeId,
        startDate: start,
        endDate: partial ? start : end,
        hours: partial ? Number(hours) : null,
        reason,
      })
      toast('Permiso solicitado')
      navigate('/time/leave', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err : errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const selected = types.data?.find((t) => t.id === typeId)

  return (
    <>
      <NavBar title="Nuevo permiso" />
      <form className="page" onSubmit={submit}>
        <h1 className="large-title">Permiso</h1>
        <Load res={types}>
          {(list) => (
            <div className="quick" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
              {list.map((t) => (
                <button type="button" key={t.id} onClick={() => setTypeId(t.id)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 6px', borderRadius: 16, cursor: 'pointer', fontSize: 13,
                    border: t.id === typeId ? '2px solid var(--accent)' : '2px solid transparent', background: 'var(--surface)', boxShadow: 'var(--shadow)' }}>
                  <span style={{ fontSize: 26 }}>{t.icon}</span>{t.name}
                </button>
              ))}
            </div>
          )}
        </Load>
        {selected?.requiresAttachment && <div className="alert info" style={{ marginBottom: 16 }}>Este permiso requiere presentar constancia a RRHH.</div>}
        {selected?.maxDaysPerYear && <p className="form-note" style={{ marginBottom: 12 }}>Máximo {selected.maxDaysPerYear} días por año.</p>}

        <div className="form-group">
          <div className="field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Por horas</span>
            <input type="checkbox" className="switch" checked={partial} onChange={(e) => setPartial(e.target.checked)} />
          </div>
          <div className="field">
            <label htmlFor="start">{partial ? 'Fecha' : 'Desde'}</label>
            <input id="start" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value) }} required />
          </div>
          {partial ? (
            <div className="field">
              <label htmlFor="hours">Horas</label>
              <select id="hours" value={hours} onChange={(e) => setHours(e.target.value)}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => <option key={h} value={h}>{h} {h === 1 ? 'hora' : 'horas'}</option>)}
              </select>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="end">Hasta</label>
              <input id="end" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} required />
            </div>
          )}
          <div className="field">
            <label htmlFor="reason">Motivo</label>
            <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} required />
          </div>
        </div>

        {error && <div className="alert error" style={{ marginTop: 12 }}>{typeof error === 'string' ? error : errorMessage(error)}</div>}
        <button className="btn block" style={{ marginTop: 20 }} disabled={busy || !typeId || !reason.trim()}>
          {busy ? 'Enviando…' : 'Solicitar permiso'}
        </button>
      </form>
    </>
  )
}

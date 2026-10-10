import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage, formatDays, formatShortDate, toIsoDate, useAuth } from '@ep/shared'
import type { VacationPreview, VacationRequest } from '@ep/shared'
import { NavBar } from '../../components/ui'

export function VacationRequestPage() {
  const { api } = useAuth()
  const today = toIsoDate(new Date())
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [comment, setComment] = useState('')
  const [preview, setPreview] = useState<VacationPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<VacationRequest | null>(null)

  useEffect(() => {
    setPreview(null)
    if (!start || !end) return
    const t = setTimeout(() => {
      api.get<VacationPreview>(`/me/vacations/preview?from=${start}&to=${end}`).then(setPreview).catch((e) => setError(errorMessage(e)))
    }, 250)
    return () => clearTimeout(t)
  }, [api, start, end])

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      setSent(await api.post<VacationRequest>('/me/vacations', { startDate: start, endDate: end, comment: comment || null }))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="page center">
        <div className="success-check">✓</div>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Solicitud enviada</h1>
        <p className="muted" style={{ margin: '6px 0 28px' }}>{sent.number}</p>
        <div className="card" style={{ textAlign: 'left' }}>
          <p className="section-title" style={{ margin: '0 0 4px' }}>Estado</p>
          <ul className="timeline">
            <li className="done"><span className="mark">✓</span>Enviada</li>
            <li className="current"><span className="mark" />Pendiente de aprobación</li>
            <li className="todo"><span className="mark" />Aprobada</li>
          </ul>
        </div>
        <p className="muted small" style={{ margin: '16px 0 24px' }}>
          {formatShortDate(sent.startDate)} – {formatShortDate(sent.endDate)} · {formatDays(sent.days)}. Te avisaremos cuando tu supervisor responda.
        </p>
        <Link to="/time" className="btn block">Listo</Link>
      </div>
    )
  }

  return (
    <>
      <NavBar title="Nueva solicitud" />
      <div className="page">
        <h1 className="large-title">Vacaciones</h1>
        <div className="form-group">
          <div className="field">
            <label htmlFor="from">Desde</label>
            <input id="from" type="date" min={today} value={start} onChange={(e) => { setStart(e.target.value); if (!end || e.target.value > end) setEnd(e.target.value) }} />
          </div>
          <div className="field">
            <label htmlFor="to">Hasta</label>
            <input id="to" type="date" min={start || today} value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        {preview && (
          <div className="stats" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 16 }}>
            <div className="stat accent"><div className="stat-value">{preview.days}</div><div className="stat-label">Días laborables</div></div>
            <div className="stat"><div className="stat-value">{preview.available}</div><div className="stat-label">Disponibles</div></div>
          </div>
        )}
        {preview && preview.holidaysInRange.length > 0 && (
          <p className="form-note">No se descuentan feriados: {preview.holidaysInRange.map((h) => `${formatShortDate(h.date)} (${h.name})`).join(', ')}.</p>
        )}
        {preview?.error && <div className="alert warn" style={{ marginTop: 12 }}>{preview.error}</div>}

        <div className="form-group" style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor="comment">Comentario</label>
            <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Opcional" />
          </div>
        </div>

        {error && <div className="alert error" style={{ marginTop: 12 }}>{error}</div>}
        <button className="btn block" style={{ marginTop: 20 }} disabled={busy || !preview?.isValid} onClick={submit}>
          {busy ? 'Enviando…' : 'Solicitar'}
        </button>
      </div>
    </>
  )
}

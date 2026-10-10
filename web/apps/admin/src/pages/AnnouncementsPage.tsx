import { useState, type FormEvent } from 'react'
import { errorMessage, useAuth, useResource } from '@ep/shared'
import { FormField, PageHeader, Panel, toast } from '../components/ui'

export function AnnouncementsPage() {
  const { api } = useAuth()
  const departments = useResource<string[]>('/admin/departments')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [department, setDepartment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!confirm('¿Enviar este comunicado?')) return
    setBusy(true)
    setError(null)
    try {
      const r = await api.post<{ recipients: number }>('/admin/announcements', { title, body, department: department || null })
      toast(`Comunicado enviado a ${r.recipients} colaboradores`)
      setTitle('')
      setBody('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Comunicaciones" subtitle="Envía avisos al centro de notificaciones del app" />
      <div className="grid cols-2">
        <Panel title="Nuevo comunicado">
          <form className="stack" onSubmit={send}>
            <FormField label="Destinatarios">
              <select className="select" value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="">Toda la empresa</option>
                {departments.data?.map((d) => <option key={d}>{d}</option>)}
              </select>
            </FormField>
            <FormField label="Título"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required /></FormField>
            <FormField label="Mensaje"><textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={6} required /></FormField>
            {error && <div className="alert error">{error}</div>}
            <button className="btn" disabled={busy}>Enviar comunicado</button>
          </form>
        </Panel>
        <Panel title="Vista previa">
          <div style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 14, background: 'var(--surface-2)' }}>
            <span style={{ fontSize: 22 }}>📣</span>
            <div>
              <b>{title || 'Título del comunicado'}</b>
              <p className="muted" style={{ marginTop: 2, whiteSpace: 'pre-wrap' }}>{body || 'El mensaje aparecerá aquí.'}</p>
            </div>
          </div>
          <p className="muted small" style={{ marginTop: 12 }}>Push notifications (APNs/Web Push) están en el roadmap; por ahora llega al centro de notificaciones.</p>
        </Panel>
      </div>
    </>
  )
}

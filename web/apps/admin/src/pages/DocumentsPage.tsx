import { useState } from 'react'
import { errorMessage, formatBytes, formatDateTime, saveBlob, useAuth, useResource } from '@ep/shared'
import type { DocumentItem, EmployeeListItem, PagedResult } from '@ep/shared'
import { FormField, Load, Modal, PageHeader, Panel, toast } from '../components/ui'

const CATEGORY: Record<string, string> = { employment: 'Laboral', payroll: 'Payroll', other: 'Otros' }

export function DocumentsPage() {
  const { api } = useAuth()
  const res = useResource<DocumentItem[]>('/admin/documents')
  const people = useResource<PagedResult<EmployeeListItem>>('/admin/employees?pageSize=200&active=true')
  const [open, setOpen] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [category, setCategory] = useState('employment')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function upload() {
    if (!file) return
    setBusy(true)
    setError(null)
    const form = new FormData()
    form.set('file', file)
    form.set('title', title)
    form.set('category', category)
    if (employeeId) form.set('employeeId', employeeId)
    try {
      await api.post('/admin/documents', form)
      toast('Documento publicado · se notificó a los destinatarios')
      setOpen(false)
      setTitle('')
      setFile(null)
      void res.reload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function download(d: DocumentItem) {
    try {
      saveBlob(await api.blob(`/admin/documents/${d.id}`), d.fileName)
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  async function remove(d: DocumentItem) {
    if (!confirm(`¿Eliminar «${d.title}»?`)) return
    await api.delete(`/admin/documents/${d.id}`)
    toast('Documento eliminado')
    void res.reload()
  }

  return (
    <>
      <PageHeader title="Documentos" subtitle="Contratos, cartas, certificados y documentos de la empresa. Los comprobantes de pago se generan automáticamente."
        actions={<button className="btn" onClick={() => setOpen(true)}>+ Subir documento</button>} />
      <Panel body={false}>
        <Load res={res}>
          {(docs) => docs.length === 0 ? <div className="empty">Sin documentos</div> : (
            <table className="table">
              <thead><tr><th>Título</th><th>Destinatario</th><th>Categoría</th><th>Tamaño</th><th>Publicado</th><th /></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td><b>📄 {d.title}</b><div className="muted small">{d.fileName}</div></td>
                    <td>{d.employeeName ?? <span className="badge role">Toda la empresa</span>}</td>
                    <td>{CATEGORY[d.category]}</td>
                    <td className="muted">{formatBytes(d.sizeBytes)}</td>
                    <td className="muted">{formatDateTime(d.uploadedAt)}</td>
                    <td className="num">
                      <button className="btn ghost sm" onClick={() => download(d)}>Descargar</button>
                      <button className="btn ghost sm" style={{ color: 'var(--danger)' }} onClick={() => remove(d)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Load>
      </Panel>

      <Modal open={open} title="Subir documento" onClose={() => setOpen(false)}
        footer={<><button className="btn secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="btn" disabled={busy || !file || !title.trim()} onClick={upload}>Publicar</button></>}>
        <div className="stack">
          <FormField label="Destinatario">
            <select className="select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Toda la empresa</option>
              {people.data?.items.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </FormField>
          <FormField label="Categoría">
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="employment">Laboral</option>
              <option value="payroll">Payroll</option>
              <option value="other">Otros</option>
            </select>
          </FormField>
          <FormField label="Título"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Carta de trabajo" /></FormField>
          <FormField label="Archivo (PDF, PNG, JPG · máx. 10 MB)">
            <input type="file" accept="application/pdf,image/png,image/jpeg,text/plain" onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              setFile(f)
              if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ''))
            }} />
          </FormField>
          {error && <div className="alert error">{error}</div>}
        </div>
      </Modal>
    </>
  )
}

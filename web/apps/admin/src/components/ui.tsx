import { useEffect, useState, type ReactNode } from 'react'
import { STATUS_LABEL, errorMessage, initials } from '@ep/shared'

export function PageHeader({ title, subtitle, actions, breadcrumb }: { title: string; subtitle?: ReactNode; actions?: ReactNode; breadcrumb?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        {breadcrumb && <div className="breadcrumb">{breadcrumb}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

export function Panel({ title, actions, children, body = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; body?: boolean }) {
  return (
    <section className="panel">
      {(title || actions) && (
        <div className="panel-head">
          <h2>{title}</h2>
          {actions}
        </div>
      )}
      {body ? <div className="panel-body">{children}</div> : <div className="table-wrap">{children}</div>}
    </section>
  )
}

export const Badge = ({ status, children }: { status: string; children?: ReactNode }) => (
  <span className={`badge ${status}`}>{children ?? STATUS_LABEL[status] ?? status}</span>
)

export function Avatar({ name, url }: { name: string; url?: string | null }) {
  return <span className="avatar">{url ? <img src={url} alt="" /> : initials(name)}</span>
}

export const Spinner = () => <div className="spinner" role="status" />

export function Load<T>({ res, children }: { res: { data: T | undefined; error: unknown; reload(): void }; children: (data: T) => ReactNode }) {
  if (res.error)
    return (
      <div className="empty">
        <p>{errorMessage(res.error)}</p>
        <button className="btn ghost" onClick={res.reload}>Reintentar</button>
      </div>
    )
  if (res.data === undefined) return <Spinner />
  return <>{children(res.data)}</>
}

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose(): void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="x" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function FormField({ label, error, children, full }: { label: string; error?: string; children: ReactNode; full?: boolean }) {
  return (
    <div className={`form-field${full ? ' full' : ''}`}>
      <label>{label}</label>
      {children}
      {error && <div className="error">{error}</div>}
    </div>
  )
}

let toastSetter: ((msg: string | null) => void) | null = null
export const toast = (msg: string) => toastSetter?.(msg)

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    toastSetter = setMsg
    return () => {
      toastSetter = null
    }
  }, [])
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 3000)
    return () => clearTimeout(t)
  }, [msg])
  return msg ? <div className="toast" role="status">{msg}</div> : null
}

/** Review dialog shared by vacations, leave and change requests. */
export function ReviewModal({ title, detail, onClose, onDecide }: {
  title: string
  detail: ReactNode
  onClose(): void
  onDecide(approve: boolean, comment: string): Promise<void>
}) {
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(approve: boolean) {
    setBusy(true)
    setError(null)
    try {
      await onDecide(approve, comment)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open title={title} onClose={onClose} footer={
      <>
        <button className="btn danger" disabled={busy} onClick={() => decide(false)}>Rechazar</button>
        <button className="btn" disabled={busy} onClick={() => decide(true)}>Aprobar</button>
      </>
    }>
      <div className="stack">
        <div>{detail}</div>
        <FormField label="Comentario (opcional)">
          <textarea className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
        </FormField>
        {error && <div className="alert error">{error}</div>}
      </div>
    </Modal>
  )
}

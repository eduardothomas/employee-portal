import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { STATUS_LABEL, errorMessage, formatMoney, initials } from '@ep/shared'
import { ChevronLeft, ChevronRight } from './icons'

export function NavBar({ title, back = true, action }: { title?: string; back?: boolean | string; action?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="nav-bar">
      {back ? (
        <button className="nav-back" onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))} aria-label="Atrás">
          <ChevronLeft /> <span>Atrás</span>
        </button>
      ) : (
        <span />
      )}
      <h1>{title}</h1>
      <div className="nav-action">{action}</div>
    </header>
  )
}

interface RowProps {
  to?: string
  onClick?: () => void
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  value?: ReactNode
  strong?: boolean
  chevron?: boolean
}

export function Row({ to, onClick, icon, title, subtitle, value, strong, chevron }: RowProps) {
  const body = (
    <>
      {icon !== undefined && <span className="row-icon">{icon}</span>}
      <span className="row-main">
        <span className="row-title" style={{ display: 'block' }}>{title}</span>
        {subtitle && <span className="row-sub" style={{ display: 'block' }}>{subtitle}</span>}
      </span>
      {value !== undefined && <span className={`row-value${strong ? ' strong' : ''}`}>{value}</span>}
      {(chevron ?? (!!to || !!onClick)) && <ChevronRight />}
    </>
  )
  const cls = `row${icon !== undefined ? ' has-icon' : ''}`
  if (to) return <Link to={to} className={cls}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>
  return <div className={cls}>{body}</div>
}

export function Section({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      {title && (
        <div className="section-header">
          <h2 className="section-title">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export const Money = ({ value, hidden }: { value: number; hidden?: boolean }) => (
  <span className={`num${hidden ? ' blur-amount' : ''}`}>{formatMoney(value)}</span>
)

export const StatusBadge = ({ status }: { status: string }) => <span className={`badge ${status}`}>{STATUS_LABEL[status] ?? status}</span>

export const Spinner = () => <div className="spinner" role="status" aria-label="Cargando" />

export function Empty({ emoji, children }: { emoji: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="emoji">{emoji}</span>
      {children}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="empty">
      <span className="emoji">⚠️</span>
      <p>{errorMessage(error)}</p>
      {onRetry && <button className="btn plain" onClick={onRetry}>Reintentar</button>}
    </div>
  )
}

/** Renders loading/error states for a resource, children only when data is ready. */
export function Load<T>({ res, children }: { res: { data: T | undefined; error: unknown; loading: boolean; reload(): void }; children: (data: T) => ReactNode }) {
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />
  if (res.data === undefined) return <Spinner />
  return <>{children(res.data)}</>
}

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {url ? <img src={url} alt="" /> : initials(name)}
    </span>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose(): void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  )
}

let toastSetter: ((msg: string | null) => void) | null = null

export function toast(message: string) {
  toastSetter?.(message)
}

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
    const t = setTimeout(() => setMsg(null), 2600)
    return () => clearTimeout(t)
  }, [msg])
  return msg ? <div className="toast" role="status">{msg}</div> : null
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}

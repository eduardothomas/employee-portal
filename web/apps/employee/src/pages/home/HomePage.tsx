import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDays, formatLongDate, formatRelative, greeting, useResource } from '@ep/shared'
import type { Dashboard } from '@ep/shared'
import { BellIcon, EyeIcon } from '../../components/icons'
import { Empty, Load, Money, Row, Section } from '../../components/ui'

const HIDE_KEY = 'ep.employee.hideAmounts'

export function HomePage() {
  const res = useResource<Dashboard>('/me/dashboard')
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(HIDE_KEY) === '1' } catch { return false }
  })

  function toggleHidden() {
    setHidden((h) => {
      try { localStorage.setItem(HIDE_KEY, h ? '0' : '1') } catch { /* ignore */ }
      return !h
    })
  }

  return (
    <div className="page">
      <Load res={res}>
        {(d) => {
          const pct = d.vacation.accrued > 0 ? Math.max(0, Math.min(100, (d.vacation.available / d.vacation.accrued) * 100)) : 0
          return (
            <>
              <div className="page-top" style={{ marginTop: 12 }}>
                <div>
                  <h1 className="greet-name">Hola, {d.displayName} 👋</h1>
                  <p className="greet-sub" style={{ marginBottom: 0 }}>{greeting()}</p>
                </div>
                <Link to="/notifications" className="icon-btn" aria-label="Notificaciones">
                  <BellIcon />
                  {d.unreadNotifications > 0 && <span className="dot">{d.unreadNotifications}</span>}
                </Link>
              </div>
              <div className="spacer" />

              <div className="wallet blue">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="wallet-label">Próximo pago</span>
                  <button onClick={toggleHidden} style={{ background: 'none', border: 0, color: 'inherit', opacity: 0.8, cursor: 'pointer' }} aria-label={hidden ? 'Mostrar montos' : 'Ocultar montos'}>
                    <EyeIcon off={hidden} />
                  </button>
                </div>
                <div>
                  <div className="wallet-amount"><Money value={d.nextPay.estimatedNet} hidden={hidden} /></div>
                  <div className="wallet-meta">{formatLongDate(d.nextPay.date)} · estimado</div>
                </div>
                <div className="wallet-footer">
                  <span className="wallet-meta small">Depósito quincenal</span>
                  <Link to="/payroll" className="wallet-link">Ver detalles →</Link>
                </div>
              </div>

              {d.isManager && d.pendingApprovals > 0 && (
                <Link to="/approvals" className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16, color: 'var(--text)' }}>
                  <span className="row-icon" style={{ background: 'var(--warning-soft)' }}>✅</span>
                  <span style={{ flex: 1 }}>
                    <b>{d.pendingApprovals} solicitudes</b>
                    <span className="muted small" style={{ display: 'block' }}>de tu equipo esperan aprobación</span>
                  </span>
                  <span className="muted">›</span>
                </Link>
              )}

              <div className="spacer" />
              <div className="quick">
                <Link to="/time/vacations/new"><span className="icon">🏖️</span>Vacaciones</Link>
                <Link to="/time/leave/new"><span className="icon">📝</span>Permiso</Link>
                <Link to="/payroll/payslips"><span className="icon">💵</span>Comprobantes</Link>
                <Link to="/me/documents"><span className="icon">📄</span>Documentos</Link>
              </div>

              <div className="spacer" />
              <Section title="Vacaciones">
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span className="amount-lg">{formatDays(d.vacation.available)}</span>
                    <span className="muted small">disponibles</span>
                  </div>
                  <div className="progress" style={{ margin: '14px 0 10px' }}><span style={{ width: `${pct}%` }} /></div>
                  <div className="muted small" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{formatDays(d.vacation.used)} usados</span>
                    {d.vacation.pending > 0 && <span>{formatDays(d.vacation.pending)} pendientes</span>}
                    <span>{formatDays(d.vacation.accrued)} acumulados</span>
                  </div>
                  <Link to="/time" className="btn secondary block" style={{ marginTop: 16 }}>Ver vacaciones</Link>
                </div>
              </Section>

              {d.pendingRequests > 0 && (
                <p className="muted small center" style={{ marginTop: 12 }}>
                  Tienes {d.pendingRequests} {d.pendingRequests === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}.
                </p>
              )}

              <div className="spacer" />
              <Section title="Actividad reciente" action={<Link to="/notifications">Ver todo</Link>}>
                {d.recentActivity.length === 0 ? (
                  <div className="list"><Empty emoji="✨">Sin actividad todavía</Empty></div>
                ) : (
                  <div className="list">
                    {d.recentActivity.map((a, i) => (
                      <Row key={i} icon={a.icon} title={a.title} subtitle={a.subtitle} value={<span className="small">{formatRelative(a.date)}</span>}
                        to={a.link ?? undefined} chevron={false} />
                    ))}
                  </div>
                )}
              </Section>
            </>
          )
        }}
      </Load>
    </div>
  )
}

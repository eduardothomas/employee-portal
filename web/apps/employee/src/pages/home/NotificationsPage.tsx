import { useNavigate } from 'react-router-dom'
import { formatRelative, useAuth, useResource } from '@ep/shared'
import type { NotificationItem } from '@ep/shared'
import { Empty, Load, NavBar } from '../../components/ui'

const ICONS: Record<string, string> = {
  payslip: '💰', vacation: '🏖️', leave: '📝', document: '📄', profile: '👤', announcement: '📣', general: '🔔',
}

export function NotificationsPage() {
  const { api } = useAuth()
  const navigate = useNavigate()
  const res = useResource<NotificationItem[]>('/notifications')

  async function open(n: NotificationItem) {
    if (!n.readAt) await api.post(`/notifications/${n.id}/read`).catch(() => undefined)
    if (n.link) navigate(n.link)
    else void res.reload()
  }

  async function readAll() {
    await api.post('/notifications/read-all')
    void res.reload()
  }

  return (
    <>
      <NavBar title="Notificaciones" action={<button className="btn plain small" onClick={readAll}>Leer todo</button>} />
      <div className="page">
        <Load res={res}>
          {(items) => {
            if (items.length === 0) return <Empty emoji="🔕">No tienes notificaciones</Empty>
            const groups = new Map<string, NotificationItem[]>()
            for (const n of items) {
              const key = formatRelative(n.createdAt)
              groups.set(key, [...(groups.get(key) ?? []), n])
            }
            return [...groups].map(([label, list]) => (
              <section key={label} className="section" style={{ marginBottom: 24 }}>
                <h2 className="section-title">{label}</h2>
                <div className="list">
                  {list.map((n) => (
                    <button key={n.id} className="row has-icon" onClick={() => open(n)}>
                      <span className="row-icon">{ICONS[n.type] ?? '🔔'}</span>
                      <span className="row-main">
                        <span className="row-title" style={{ display: 'block', fontWeight: n.readAt ? 400 : 600 }}>{n.title}</span>
                        <span className="row-sub" style={{ display: 'block', whiteSpace: 'normal' }}>{n.body}</span>
                      </span>
                      {!n.readAt && <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', flex: 'none' }} />}
                    </button>
                  ))}
                </div>
              </section>
            ))
          }}
        </Load>
      </div>
    </>
  )
}

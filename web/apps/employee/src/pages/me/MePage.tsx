import { ROLE_LABEL, useAuth, useResource } from '@ep/shared'
import type { Me } from '@ep/shared'
import { Avatar, Load, Row, Section } from '../../components/ui'

export function MePage() {
  const { logout } = useAuth()
  const res = useResource<Me>('/me')

  return (
    <div className="page">
      <h1 className="large-title">Mi perfil</h1>
      <Load res={res}>
        {(me) => (
          <>
            <div className="profile-head">
              <Avatar name={me.fullName} url={me.photoUrl} size={96} />
              <h2>{me.fullName}</h2>
              <p className="muted">{me.employment.jobTitle}</p>
              <p className="muted small">{me.employment.employeeCode} · {me.employment.department}</p>
            </div>

            <div className="list">
              <Row icon="👤" title="Información personal" to="/me/personal" />
              <Row icon="💼" title="Información laboral" to="/me/employment" />
              <Row icon="🏦" title="Información bancaria" to="/me/bank" />
              <Row icon="🆘" title="Contactos de emergencia" to="/me/personal#emergency" />
            </div>

            <Section>
              <div className="list">
                <Row icon="📄" title="Documentos" to="/me/documents" />
                <Row icon="🔐" title="Seguridad" to="/me/security" />
                <Row icon="🔔" title="Notificaciones" to="/notifications" value={me.unreadNotifications || undefined} />
              </div>
            </Section>

            {me.role !== 'employee' && (
              <Section title={ROLE_LABEL[me.role]}>
                <div className="list">
                  <Row icon="✅" title="Aprobaciones y equipo" to="/approvals" />
                </div>
              </Section>
            )}

            <Section>
              <div className="list">
                <Row title={<span style={{ color: 'var(--danger)' }}>Cerrar sesión</span>} onClick={() => void logout()} chevron={false} />
              </div>
            </Section>
            <p className="muted small center" style={{ marginTop: 24 }}>Employee Portal · v1.0</p>
          </>
        )}
      </Load>
    </div>
  )
}

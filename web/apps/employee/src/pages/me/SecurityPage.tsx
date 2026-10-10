import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, errorMessage, useAuth } from '@ep/shared'
import { Field, NavBar, Row, Section, Sheet, toast } from '../../components/ui'
import { biometric, biometricLabel } from '../../lib/biometric'

export function SecurityPage() {
  const { api, user, logout } = useAuth()
  const label = biometricLabel()
  const [available, setAvailable] = useState(false)
  const [enabled, setEnabled] = useState(() => biometric.isEnrolled(user?.id))
  const [pwOpen, setPwOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<ApiError | null>(null)

  useEffect(() => {
    void biometric.isAvailable().then(setAvailable)
  }, [])

  async function toggle(on: boolean) {
    try {
      if (on && user) await biometric.enroll(user)
      else biometric.disable()
      await api.put('/me/security', { biometricEnabled: on })
      setEnabled(on)
      toast(on ? `${label} activado` : `${label} desactivado`)
    } catch {
      toast(`No se pudo ${on ? 'activar' : 'desactivar'} ${label}.`)
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next })
      toast('Contraseña actualizada')
      setPwOpen(false)
      setCurrent('')
      setNext('')
    } catch (err) {
      if (err instanceof ApiError) setError(err)
      else toast(errorMessage(err))
    }
  }

  return (
    <>
      <NavBar title="Seguridad" />
      <div className="page">
        <h1 className="large-title">Seguridad</h1>
        <div className="list">
          <div className="row has-icon">
            <span className="row-icon">🔒</span>
            <span className="row-main">
              <span className="row-title" style={{ display: 'block' }}>{label}</span>
              <span className="row-sub" style={{ display: 'block' }}>{available ? 'Desbloqueo y comprobantes protegidos' : 'No disponible en este dispositivo'}</span>
            </span>
            <input type="checkbox" className="switch" disabled={!available} checked={enabled} onChange={(e) => toggle(e.target.checked)} />
          </div>
          <Row icon="🔑" title="Cambiar contraseña" onClick={() => setPwOpen(true)} />
          <div className="row has-icon">
            <span className="row-icon">📲</span>
            <span className="row-main"><span className="row-title" style={{ display: 'block' }}>Verificación en dos pasos</span>
              <span className="row-sub" style={{ display: 'block' }}>Código por SMS en cada inicio de sesión</span></span>
            <span className="badge approved">Activa</span>
          </div>
        </div>
        <Section>
          <div className="list">
            <Row title={<span style={{ color: 'var(--danger)' }}>Cerrar sesión en este dispositivo</span>} onClick={() => void logout()} chevron={false} />
          </div>
        </Section>
      </div>

      <Sheet open={pwOpen} onClose={() => setPwOpen(false)} title="Cambiar contraseña">
        <form onSubmit={changePassword}>
          <div className="form-group">
            <Field label="Contraseña actual" error={error?.field('currentPassword')}>
              <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </Field>
            <Field label="Nueva contraseña" error={error?.field('newPassword')}>
              <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
            </Field>
          </div>
          <p className="form-note">Mínimo 8 caracteres, con letras y números.</p>
          <button className="btn block" style={{ marginTop: 16 }}>Actualizar</button>
        </form>
      </Sheet>
    </>
  )
}

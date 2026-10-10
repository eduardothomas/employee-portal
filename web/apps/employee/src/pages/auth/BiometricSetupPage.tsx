import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@ep/shared'
import { FaceIdIcon } from '../../components/icons'
import { biometric, biometricLabel } from '../../lib/biometric'

export function BiometricSetupPage() {
  const { user, api } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const label = biometricLabel()

  async function activate() {
    if (!user) return
    try {
      await biometric.enroll(user)
      await api.put('/me/security', { biometricEnabled: true })
      navigate('/', { replace: true })
    } catch {
      setError(`No se pudo activar ${label}.`)
    }
  }

  return (
    <main className="auth center">
      <FaceIdIcon className="faceid" />
      <h1 style={{ fontSize: 28 }}>¿Quieres usar {label} para iniciar sesión?</h1>
      <p className="lead">Accede más rápido y protege tus comprobantes de pago.</p>
      {error && <p className="error">{error}</p>}
      <div className="stack">
        <button className="btn block" onClick={activate}>Activar</button>
        <button className="btn plain block" onClick={() => navigate('/', { replace: true })}>Ahora no</button>
      </div>
    </main>
  )
}

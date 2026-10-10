import { useEffect, useState } from 'react'
import { useAuth } from '@ep/shared'
import { FaceIdIcon } from '../../components/icons'
import { biometric, biometricLabel } from '../../lib/biometric'

/** Shown when a remembered session exists and the user enabled biometric unlock. */
export function LockedPage() {
  const { unlock, logout } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const label = biometricLabel()

  async function tryUnlock() {
    setError(null)
    if (!(await biometric.verify())) {
      setError(`No se pudo verificar con ${label}.`)
      return
    }
    if (!(await unlock())) setError('Tu sesión expiró. Inicia sesión nuevamente.')
  }

  useEffect(() => {
    void tryUnlock()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="auth center">
      <FaceIdIcon className="faceid" />
      <h1 style={{ fontSize: 28 }}>Employee Portal</h1>
      <p className="lead">Desbloquea con {label} para continuar.</p>
      {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}
      <div className="stack">
        <button className="btn block" onClick={tryUnlock}>Usar {label}</button>
        <button className="btn plain block" onClick={() => { biometric.disable(); void logout() }}>Usar contraseña</button>
      </div>
    </main>
  )
}

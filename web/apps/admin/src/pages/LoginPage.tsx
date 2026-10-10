import { useState, type FormEvent } from 'react'
import { IS_DEMO, asset, errorMessage, useAuth } from '@ep/shared'

export function LoginPage() {
  const { login, verifyMfa, challenge } = useAuth()
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <div className="panel login-card">
        <img src={asset('icon.svg')} alt="" />
        {!challenge ? (
          <>
            <h1>Portal de RRHH</h1>
            <p className="lead">Inicia sesión con tu cuenta corporativa.</p>
            <form onSubmit={(e: FormEvent) => { e.preventDefault(); void run(() => login(user, password)) }}>
              <input className="input" placeholder="Email o ID de empleado" autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} required />
              <input className="input" type="password" placeholder="Contraseña" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              {error && <div className="alert error">{error}</div>}
              <button className="btn" disabled={busy}>{busy ? 'Ingresando…' : 'Continuar'}</button>
            </form>
            {(import.meta.env.DEV || IS_DEMO) && (
              <p className="alert info" style={{ marginTop: 20 }}>
                Demo RRHH: <b>ana.castillo@employeeportal.dev</b> · Manager: <b>laura.mendez@employeeportal.dev</b> · contraseña <b>Portal2026!</b>
              </p>
            )}
          </>
        ) : (
          <>
            <h1>Verificación</h1>
            <p className="lead">Código enviado a {challenge.maskedDestination}.</p>
            <form onSubmit={(e: FormEvent) => { e.preventDefault(); void run(() => verifyMfa(code)) }}>
              <input className="input otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              {challenge.devCode && <div className="alert info">Modo desarrollo — código: <b>{challenge.devCode}</b></div>}
              {error && <div className="alert error">{error}</div>}
              <button className="btn" disabled={busy || code.length !== 6}>Verificar</button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}

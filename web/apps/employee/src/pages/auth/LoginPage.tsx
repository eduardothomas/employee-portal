import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IS_DEMO, asset, errorMessage, useAuth } from '@ep/shared'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(user, password)
      navigate('/login/verify')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth">
      <img src={asset('icon.svg')} alt="" className="auth-logo" />
      <h1>Bienvenido</h1>
      <p className="lead">Employee Portal</p>
      <form onSubmit={submit}>
        <input className="input-lg" placeholder="Email o ID de empleado" autoComplete="username" autoCapitalize="none"
          value={user} onChange={(e) => setUser(e.target.value)} required />
        <input className="input-lg" type="password" placeholder="Contraseña" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="error">{error}</p>}
        <button className="btn block" disabled={busy || !user || !password}>{busy ? 'Ingresando…' : 'Iniciar sesión'}</button>
        <p className="center"><Link to="/forgot-password">¿Olvidaste tu contraseña?</Link></p>
      </form>
      {(import.meta.env.DEV || IS_DEMO) && (
        <p className="hint" style={{ marginTop: 32 }}>
          Demo: <b>EMP-0001</b> (empleado) o <b>laura.mendez@employeeportal.dev</b> (manager) · contraseña <b>Portal2026!</b>
        </p>
      )}
    </main>
  )
}

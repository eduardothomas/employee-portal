import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage, useAuth } from '@ep/shared'

export function ForgotPasswordPage() {
  const { api } = useAuth()
  const [login, setLogin] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await api.post('/auth/forgot-password', { login })
      setSent(true)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <main className="auth">
      <h1>Recuperar acceso</h1>
      {sent ? (
        <>
          <p className="lead">Si la cuenta existe, recibirás instrucciones en tu correo y teléfono registrados. Si no las recibes, contacta a RRHH.</p>
          <Link to="/login" className="btn block">Volver al inicio</Link>
        </>
      ) : (
        <>
          <p className="lead">Ingresa tu email o ID de empleado.</p>
          <form onSubmit={submit}>
            <input className="input-lg" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Email o ID de empleado" required />
            {error && <p className="error">{error}</p>}
            <button className="btn block">Enviar instrucciones</button>
            <p className="center"><Link to="/login">Cancelar</Link></p>
          </form>
        </>
      )}
    </main>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { errorMessage, useAuth } from '@ep/shared'
import { biometric } from '../../lib/biometric'

const LENGTH = 6

export function MfaPage() {
  const { challenge, verifyMfa } = useAuth()
  const navigate = useNavigate()
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => inputs.current[0]?.focus(), [])

  if (!challenge) return <Navigate to="/login" replace />

  async function submit(code: string) {
    setBusy(true)
    setError(null)
    try {
      const tokens = await verifyMfa(code)
      const canOffer = !biometric.isEnrolled(tokens.user.id) && (await biometric.isAvailable())
      navigate(canOffer ? '/login/biometric' : '/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setDigits(Array(LENGTH).fill(''))
      inputs.current[0]?.focus()
    } finally {
      setBusy(false)
    }
  }

  function update(index: number, value: string) {
    const clean = value.replace(/\D/g, '')
    const next = [...digits]
    if (clean.length > 1) {
      // Pasted code
      clean.slice(0, LENGTH).split('').forEach((d, i) => (next[i] = d))
    } else {
      next[index] = clean
    }
    setDigits(next)
    const firstEmpty = next.findIndex((d) => !d)
    if (firstEmpty === -1) void submit(next.join(''))
    else if (clean) inputs.current[Math.min(firstEmpty, LENGTH - 1)]?.focus()
  }

  return (
    <main className="auth">
      <h1>Verificación</h1>
      <p className="lead">Introduce el código de 6 dígitos enviado a {challenge.maskedDestination}.</p>
      <div className="otp">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputs.current[i] = el }}
            value={d}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={i === 0 ? LENGTH : 1}
            disabled={busy}
            aria-label={`Dígito ${i + 1}`}
            onChange={(e) => update(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !d && i > 0) inputs.current[i - 1]?.focus()
            }}
          />
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {challenge.devCode && (
        <p className="hint center">Modo desarrollo — tu código es <b>{challenge.devCode}</b></p>
      )}
      <button className="btn plain block" onClick={() => navigate('/login')}>Volver</button>
    </main>
  )
}

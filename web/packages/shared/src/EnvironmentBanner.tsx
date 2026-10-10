import { useEffect, useState } from 'react'
import { API_URL, IS_DEMO } from './config'
import { resetDemo } from './demo/server'

const bar = { background: '#111827', color: '#e5e7eb', fontSize: 12, padding: '6px 12px', display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 100 } as const
const link = { color: 'inherit', textDecoration: 'underline', background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer' } as const

/**
 * Demo mode: shows a "Modo demo" bar with reset and a link to the other app.
 * API mode (production build): while the API does not answer /health — e.g. Render's free plan
 * waking up (~1 min) — shows a "despertando el servidor" bar so people don't think it is broken.
 */
export function EnvironmentBanner({ otherApp }: { otherApp: { label: string; href: string } }) {
  const [waking, setWaking] = useState(false)

  useEffect(() => {
    if (IS_DEMO || import.meta.env.DEV) return
    let done = false
    const slow = setTimeout(() => !done && setWaking(true), 2500)
    const ping = async () => {
      for (let i = 0; i < 30 && !done; i++) {
        try {
          if ((await fetch(`${API_URL}/health`)).ok) break
        } catch { /* still asleep */ }
        await new Promise((r) => setTimeout(r, 4000))
      }
      done = true
      setWaking(false)
    }
    void ping()
    return () => {
      done = true
      clearTimeout(slow)
    }
  }, [])

  if (waking)
    return <div style={{ ...bar, background: '#7c2d12' }}>⏳ Despertando el servidor… la primera carga puede tardar hasta un minuto.</div>
  if (!IS_DEMO) return null

  const reset = () => {
    if (!confirm('¿Reiniciar el demo? Se borrarán los cambios hechos en este navegador.')) return
    resetDemo()
    try {
      for (const k of ['ep.employee.refresh', 'ep.admin.refresh', 'ep.employee.biometric']) localStorage.removeItem(k)
    } catch { /* ignore */ }
    location.reload()
  }

  return (
    <div style={bar}>
      <span>🧪 <b>Modo demo</b> · datos ficticios guardados solo en tu navegador</span>
      <a href={otherApp.href} style={link}>{otherApp.label}</a>
      <button onClick={reset} style={link}>Reiniciar demo</button>
    </div>
  )
}

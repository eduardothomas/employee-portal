import { useState } from 'react'
import { errorMessage, useAuth } from '@ep/shared'
import { Sheet, toast } from '../../components/ui'

export interface ChangeTarget {
  field: string
  label: string
  current?: string | null
}

/** "Solicitar modificación" for fields only HR can change. */
export function ChangeRequestSheet({ target, onClose }: { target: ChangeTarget | null; onClose(): void }) {
  const { api } = useAuth()
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!target) return
    setBusy(true)
    setError(null)
    try {
      await api.post('/me/change-requests', { field: target.field, requestedValue: value, reason: reason || null })
      toast('Solicitud enviada a RRHH')
      setValue('')
      setReason('')
      onClose()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={!!target} onClose={onClose} title={`Modificar ${target?.label.toLowerCase() ?? ''}`}>
      <div className="form-group">
        {target?.current && (
          <div className="field readonly"><label>Valor actual</label><input value={target.current} readOnly /></div>
        )}
        <div className="field"><label>Nuevo valor</label><input value={value} onChange={(e) => setValue(e.target.value)} autoFocus /></div>
        <div className="field"><label>Motivo</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} /></div>
      </div>
      <p className="form-note">RRHH revisará tu solicitud. Recibirás una notificación con la respuesta.</p>
      {error && <div className="alert error" style={{ marginTop: 12 }}>{error}</div>}
      <button className="btn block" style={{ marginTop: 16 }} disabled={busy || !value.trim()} onClick={submit}>Enviar solicitud</button>
    </Sheet>
  )
}

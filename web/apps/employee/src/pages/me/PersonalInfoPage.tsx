import { useEffect, useRef, useState } from 'react'
import { ApiError, errorMessage, formatDate, useAuth, useResource } from '@ep/shared'
import type { Me, UpdateProfileRequest } from '@ep/shared'
import { Avatar, Field, Load, NavBar, Row, Section, toast } from '../../components/ui'
import { ChangeRequestSheet, type ChangeTarget } from './ChangeRequestSheet'

type Form = Required<{ [K in keyof UpdateProfileRequest]: string }>

const EMPTY: Form = {
  preferredName: '', personalEmail: '', phone: '', address: '',
  emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelationship: '', photoUrl: '',
}

/** Resizes an image client-side to a small square data URL (avatar). */
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const scale = Math.max(size / bitmap.width, size / bitmap.height)
  const w = bitmap.width * scale
  const h = bitmap.height * scale
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export function PersonalInfoPage() {
  const { api } = useAuth()
  const res = useResource<Me>('/me')
  const [form, setForm] = useState<Form>(EMPTY)
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [change, setChange] = useState<ChangeTarget | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const p = res.data?.personal
    if (!p) return
    setForm({
      preferredName: p.preferredName ?? '', personalEmail: p.personalEmail ?? '', phone: p.phone ?? '', address: p.address ?? '',
      emergencyContactName: p.emergencyContactName ?? '', emergencyContactPhone: p.emergencyContactPhone ?? '',
      emergencyContactRelationship: p.emergencyContactRelationship ?? '', photoUrl: p.photoUrl ?? '',
    })
  }, [res.data])

  useEffect(() => {
    if (res.data && location.hash === '#emergency') document.getElementById('emergency')?.scrollIntoView({ behavior: 'smooth' })
  }, [res.data])

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value })

  async function save() {
    setBusy(true)
    setError(null)
    try {
      res.setData(await api.patch<Me>('/me/profile', form))
      toast('Cambios guardados')
    } catch (e) {
      if (e instanceof ApiError) setError(e)
      else toast(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function pickPhoto(file?: File) {
    if (!file) return
    try {
      setForm({ ...form, photoUrl: await toAvatarDataUrl(file) })
    } catch {
      toast('No se pudo leer la imagen.')
    }
  }

  return (
    <>
      <NavBar title="Información personal" action={<button className="btn plain small" disabled={busy} onClick={save}>Guardar</button>} />
      <div className="page">
        <Load res={res}>
          {(me) => (
            <>
              <div className="profile-head">
                <Avatar name={me.fullName} url={form.photoUrl || null} size={96} />
                <button className="btn plain small" onClick={() => fileRef.current?.click()}>Cambiar foto</button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
              </div>

              <Section title="Datos registrados">
                <div className="list">
                  <Row title="Nombre" value={`${me.personal.firstName} ${me.personal.lastName}`} onClick={() => setChange({ field: 'firstName', label: 'Nombre', current: me.personal.firstName })} />
                  <Row title="Cédula" value={me.personal.nationalIdMasked} onClick={() => setChange({ field: 'nationalId', label: 'Cédula', current: me.personal.nationalIdMasked })} />
                  {me.personal.birthDate && <Row title="Nacimiento" value={formatDate(me.personal.birthDate)} />}
                </div>
                <p className="form-note">Para corregir estos datos se envía una solicitud a RRHH.</p>
              </Section>

              <Section title="Contacto">
                <div className="form-group">
                  <Field label="Nombre preferido" error={error?.field('preferredName')}><input value={form.preferredName} onChange={set('preferredName')} placeholder={me.personal.firstName} /></Field>
                  <Field label="Teléfono" error={error?.field('phone')}><input type="tel" value={form.phone} onChange={set('phone')} /></Field>
                  <Field label="Email personal" error={error?.field('personalEmail')}><input type="email" value={form.personalEmail} onChange={set('personalEmail')} /></Field>
                  <Field label="Dirección" error={error?.field('address')}><textarea value={form.address} onChange={set('address')} rows={2} /></Field>
                </div>
              </Section>

              <Section title="Contacto de emergencia">
                <div className="form-group" id="emergency">
                  <Field label="Nombre"><input value={form.emergencyContactName} onChange={set('emergencyContactName')} /></Field>
                  <Field label="Teléfono"><input type="tel" value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} /></Field>
                  <Field label="Parentesco"><input value={form.emergencyContactRelationship} onChange={set('emergencyContactRelationship')} /></Field>
                </div>
              </Section>

              <button className="btn block section" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
            </>
          )}
        </Load>
      </div>
      <ChangeRequestSheet target={change} onClose={() => setChange(null)} />
    </>
  )
}

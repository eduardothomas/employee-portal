import { useState } from 'react'
import { errorMessage, useAuth, useResource } from '@ep/shared'
import type { LeaveType, SaveLeaveType } from '@ep/shared'
import { Badge, FormField, Load, Modal, PageHeader, Panel, toast } from '../components/ui'

const NEW: SaveLeaveType = { code: '', name: '', icon: '📝', isPaid: true, requiresAttachment: false, maxDaysPerYear: null, isActive: true, sortOrder: 10 }

export function LeaveTypesPage() {
  const { api } = useAuth()
  const res = useResource<LeaveType[]>('/admin/leave-types')
  const [editing, setEditing] = useState<(SaveLeaveType & { id?: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!editing) return
    setError(null)
    const { id, ...body } = editing
    try {
      if (id) await api.put(`/admin/leave-types/${id}`, body)
      else await api.post('/admin/leave-types', body)
      toast('Tipo de permiso guardado')
      setEditing(null)
      void res.reload()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const set = <K extends keyof SaveLeaveType>(k: K, v: SaveLeaveType[K]) => setEditing((e) => (e ? { ...e, [k]: v } : e))

  return (
    <>
      <PageHeader title="Tipos de permiso" subtitle="Políticas configurables — el app del empleado las muestra automáticamente"
        actions={<button className="btn" onClick={() => setEditing({ ...NEW })}>+ Nuevo tipo</button>} />
      <Panel body={false}>
        <Load res={res}>
          {(types) => (
            <table className="table">
              <thead><tr><th>Tipo</th><th>Código</th><th>Remunerado</th><th>Requiere constancia</th><th className="num">Máx. días/año</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {types.map((t) => (
                  <tr key={t.id}>
                    <td><b>{t.icon} {t.name}</b></td>
                    <td className="mono">{t.code}</td>
                    <td>{t.isPaid ? 'Sí' : 'No'}</td>
                    <td>{t.requiresAttachment ? 'Sí' : 'No'}</td>
                    <td className="num">{t.maxDaysPerYear ?? '—'}</td>
                    <td><Badge status={t.isActive ? 'active' : 'inactive'}>{t.isActive ? 'Activo' : 'Inactivo'}</Badge></td>
                    <td className="num"><button className="btn ghost sm" onClick={() => setEditing({ ...t })}>Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Load>
      </Panel>

      <Modal open={!!editing} title={editing?.id ? 'Editar tipo de permiso' : 'Nuevo tipo de permiso'} onClose={() => setEditing(null)}
        footer={<><button className="btn secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="btn" onClick={save}>Guardar</button></>}>
        {editing && (
          <div className="form-grid">
            <FormField label="Nombre"><input className="input" value={editing.name} onChange={(e) => set('name', e.target.value)} /></FormField>
            <FormField label="Código"><input className="input" value={editing.code} onChange={(e) => set('code', e.target.value)} placeholder="medico" /></FormField>
            <FormField label="Ícono (emoji)"><input className="input" value={editing.icon} onChange={(e) => set('icon', e.target.value)} maxLength={4} /></FormField>
            <FormField label="Máximo de días por año">
              <input className="input" type="number" min={0} value={editing.maxDaysPerYear ?? ''} onChange={(e) => set('maxDaysPerYear', e.target.value ? Number(e.target.value) : null)} placeholder="Sin límite" />
            </FormField>
            <FormField label="Orden"><input className="input" type="number" value={editing.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} /></FormField>
            <div className="form-field full" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <label className="check"><input type="checkbox" checked={editing.isPaid} onChange={(e) => set('isPaid', e.target.checked)} /> Remunerado</label>
              <label className="check"><input type="checkbox" checked={editing.requiresAttachment} onChange={(e) => set('requiresAttachment', e.target.checked)} /> Requiere constancia</label>
              <label className="check"><input type="checkbox" checked={editing.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Activo</label>
            </div>
            {error && <div className="alert error full">{error}</div>}
          </div>
        )}
      </Modal>
    </>
  )
}

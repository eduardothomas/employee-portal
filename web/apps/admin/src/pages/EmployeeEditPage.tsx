import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, errorMessage, formatDateTime, formatMoney, toIsoDate, useAuth, useResource } from '@ep/shared'
import type { AuditLogItem, EmployeeDetail, EmployeeListItem, PagedResult, RecurringDeduction, SaveEmployee } from '@ep/shared'
import { Badge, FormField, Load, Modal, PageHeader, Panel, Spinner, toast } from '../components/ui'

const EMPTY: SaveEmployee = {
  employeeCode: '', firstName: '', lastName: '', preferredName: null, nationalId: '', birthDate: null,
  workEmail: '', personalEmail: null, phone: null, address: null, jobTitle: '', department: '',
  hireDate: toIsoDate(new Date()), employmentType: 'fullTime', managerId: null, monthlySalary: 0, isActive: true,
  bankName: null, bankAccountType: null, bankAccountNumber: null, role: 'employee', vacationAccruedDays: 0, initialPassword: '',
}

function toForm(e: EmployeeDetail): SaveEmployee {
  return {
    employeeCode: e.employeeCode, firstName: e.firstName, lastName: e.lastName, preferredName: e.preferredName,
    nationalId: e.nationalId, birthDate: e.birthDate, workEmail: e.workEmail, personalEmail: e.personalEmail, phone: e.phone,
    address: e.address, jobTitle: e.jobTitle, department: e.department, hireDate: e.hireDate, employmentType: e.employmentType,
    managerId: e.managerId, monthlySalary: e.monthlySalary, isActive: e.isActive, bankName: e.bankName,
    bankAccountType: e.bankAccountType, bankAccountNumber: e.bankAccountNumber, role: e.role,
    vacationAccruedDays: e.vacationAccruedDays, initialPassword: '',
  }
}

export function EmployeeEditPage() {
  const { id } = useParams()
  const isNew = !id
  const { api } = useAuth()
  const navigate = useNavigate()
  const detail = useResource<EmployeeDetail>(isNew ? null : `/admin/employees/${id}`)
  const people = useResource<PagedResult<EmployeeListItem>>('/admin/employees?pageSize=200&active=true')
  const [form, setForm] = useState<SaveEmployee>(EMPTY)
  const [tab, setTab] = useState<'data' | 'deductions' | 'history'>('data')
  const [error, setError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (detail.data) setForm(toForm(detail.data))
  }, [detail.data])

  const set = <K extends keyof SaveEmployee>(k: K, v: SaveEmployee[K]) => setForm((f) => ({ ...f, [k]: v }))
  const text = (k: keyof SaveEmployee) => ({
    className: 'input',
    value: (form[k] as string | null) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value as never),
  })

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const payload = { ...form, initialPassword: form.initialPassword || null }
    try {
      if (isNew) {
        const created = await api.post<EmployeeDetail>('/admin/employees', payload)
        toast('Colaborador creado')
        navigate(`/employees/${created.id}`, { replace: true })
      } else {
        detail.setData(await api.put<EmployeeDetail>(`/admin/employees/${id}`, payload))
        toast('Cambios guardados · registrados en auditoría')
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err)
      else toast(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!isNew && !detail.data && !detail.error) return <Spinner />
  const title = isNew ? 'Nuevo colaborador' : `${detail.data?.firstName} ${detail.data?.lastName}`
  const f = (name: string) => error?.field(name)

  return (
    <>
      <PageHeader breadcrumb={<Link to="/employees">Colaboradores</Link>} title={title}
        subtitle={detail.data ? `${detail.data.employeeCode} · ${detail.data.jobTitle}` : 'Completa la información para crear el acceso al portal'}
        actions={tab === 'data' && <button className="btn" form="employee-form" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>} />

      {!isNew && (
        <div className="tabs">
          <button className={tab === 'data' ? 'active' : ''} onClick={() => setTab('data')}>Información</button>
          <button className={tab === 'deductions' ? 'active' : ''} onClick={() => setTab('deductions')}>Descuentos fijos</button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Historial de cambios</button>
        </div>
      )}

      {tab === 'data' && (
        <form id="employee-form" onSubmit={save}>
          {error && Object.keys(error.errors).length === 0 && <div className="alert error" style={{ marginBottom: 16 }}>{error.message}</div>}
          <Panel title="Identidad">
            <div className="form-grid">
              <FormField label="Nombre" error={f('firstName')}><input {...text('firstName')} required /></FormField>
              <FormField label="Apellido" error={f('lastName')}><input {...text('lastName')} required /></FormField>
              <FormField label="Nombre preferido"><input {...text('preferredName')} /></FormField>
              <FormField label="Cédula" error={f('nationalId')}><input {...text('nationalId')} required /></FormField>
              <FormField label="Fecha de nacimiento"><input type="date" {...text('birthDate')} onChange={(e) => set('birthDate', e.target.value || null)} /></FormField>
              <FormField label="Teléfono"><input {...text('phone')} /></FormField>
              <FormField label="Email personal" error={f('personalEmail')}><input type="email" {...text('personalEmail')} /></FormField>
              <FormField label="Dirección"><input {...text('address')} /></FormField>
            </div>
          </Panel>

          <Panel title="Información laboral">
            <div className="form-grid">
              <FormField label="Código de empleado" error={f('employeeCode')}><input {...text('employeeCode')} required placeholder="EMP-0000" /></FormField>
              <FormField label="Email corporativo" error={f('workEmail')}><input type="email" {...text('workEmail')} required /></FormField>
              <FormField label="Cargo" error={f('jobTitle')}><input {...text('jobTitle')} required /></FormField>
              <FormField label="Departamento" error={f('department')}><input {...text('department')} required /></FormField>
              <FormField label="Fecha de ingreso"><input type="date" {...text('hireDate')} required /></FormField>
              <FormField label="Tipo de contrato">
                <select className="select" value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)}>
                  <option value="fullTime">Tiempo completo</option>
                  <option value="partTime">Medio tiempo</option>
                  <option value="contractor">Contratista</option>
                </select>
              </FormField>
              <FormField label="Supervisor" error={f('managerId')}>
                <select className="select" value={form.managerId ?? ''} onChange={(e) => set('managerId', e.target.value || null)}>
                  <option value="">— Sin supervisor —</option>
                  {people.data?.items.filter((p) => p.id !== id).map((p) => <option key={p.id} value={p.id}>{p.fullName} · {p.jobTitle}</option>)}
                </select>
              </FormField>
              <FormField label="Salario mensual (USD)" error={f('monthlySalary')}>
                <input className="input" type="number" min={0} step="0.01" value={form.monthlySalary} onChange={(e) => set('monthlySalary', Number(e.target.value))} required />
              </FormField>
              <FormField label="Días de vacaciones acumulados" error={f('vacationAccruedDays')}>
                <input className="input" type="number" min={0} step="0.5" value={form.vacationAccruedDays} onChange={(e) => set('vacationAccruedDays', Number(e.target.value))} />
              </FormField>
              <FormField label="Estado">
                <label className="check"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Activo</label>
              </FormField>
            </div>
            {detail.data && (
              <p className="muted small" style={{ marginTop: 12 }}>
                Balance actual: {detail.data.vacationBalance.available} disponibles · {detail.data.vacationBalance.used} usados · {detail.data.vacationBalance.pending} pendientes.
                Los cambios de salario quedan registrados en auditoría.
              </p>
            )}
          </Panel>

          <Panel title="Información bancaria">
            <div className="form-grid">
              <FormField label="Banco"><input {...text('bankName')} /></FormField>
              <FormField label="Tipo de cuenta">
                <select className="select" value={form.bankAccountType ?? ''} onChange={(e) => set('bankAccountType', e.target.value || null)}>
                  <option value="">—</option><option>Ahorros</option><option>Corriente</option>
                </select>
              </FormField>
              <FormField label="Número de cuenta"><input {...text('bankAccountNumber')} /></FormField>
            </div>
          </Panel>

          <Panel title="Acceso al portal">
            <div className="form-grid">
              <FormField label="Rol">
                <select className="select" value={form.role} onChange={(e) => set('role', e.target.value)}>
                  <option value="employee">Empleado</option>
                  <option value="manager">Manager</option>
                  <option value="hrAdmin">RRHH / Admin</option>
                </select>
              </FormField>
              <FormField label={isNew ? 'Contraseña inicial' : 'Restablecer contraseña'} error={f('newPassword')}>
                <input className="input" type="password" autoComplete="new-password" value={form.initialPassword ?? ''}
                  onChange={(e) => set('initialPassword', e.target.value)} required={isNew} placeholder={isNew ? 'Mínimo 8 caracteres' : 'Dejar vacío para no cambiar'} />
              </FormField>
            </div>
          </Panel>
        </form>
      )}

      {tab === 'deductions' && detail.data && <DeductionsTab employee={detail.data} onChange={detail.reload} />}
      {tab === 'history' && id && <HistoryTab employeeId={id} />}
    </>
  )
}

function DeductionsTab({ employee, onChange }: { employee: EmployeeDetail; onChange(): void }) {
  const { api } = useAuth()
  const [editing, setEditing] = useState<Partial<RecurringDeduction> | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!editing) return
    setError(null)
    const body = { code: editing.code ?? '', description: editing.description ?? '', amountPerPeriod: Number(editing.amountPerPeriod ?? 0), isActive: editing.isActive ?? true }
    try {
      if (editing.id) await api.put(`/admin/employees/${employee.id}/deductions/${editing.id}`, body)
      else await api.post(`/admin/employees/${employee.id}/deductions`, body)
      setEditing(null)
      toast('Descuento guardado')
      onChange()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <Panel title="Descuentos aplicados en cada quincena" body={false}
      actions={<button className="btn sm" onClick={() => setEditing({ isActive: true })}>+ Agregar</button>}>
      {employee.recurringDeductions.length === 0 ? <div className="empty">Sin descuentos fijos. CSS, Seguro Educativo e ISR se calculan automáticamente.</div> : (
        <table className="table">
          <thead><tr><th>Código</th><th>Descripción</th><th className="num">Monto por quincena</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {employee.recurringDeductions.map((d) => (
              <tr key={d.id}>
                <td className="mono">{d.code}</td><td>{d.description}</td><td className="num">{formatMoney(d.amountPerPeriod)}</td>
                <td><Badge status={d.isActive ? 'active' : 'inactive'}>{d.isActive ? 'Activo' : 'Inactivo'}</Badge></td>
                <td className="num"><button className="btn ghost sm" onClick={() => setEditing(d)}>Editar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Modal open={!!editing} title={editing?.id ? 'Editar descuento' : 'Nuevo descuento'} onClose={() => setEditing(null)}
        footer={<><button className="btn secondary" onClick={() => setEditing(null)}>Cancelar</button><button className="btn" onClick={save}>Guardar</button></>}>
        {editing && (
          <div className="form-grid">
            <FormField label="Código"><input className="input" value={editing.code ?? ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="PRESTAMO" /></FormField>
            <FormField label="Monto por quincena"><input className="input" type="number" step="0.01" value={editing.amountPerPeriod ?? ''} onChange={(e) => setEditing({ ...editing, amountPerPeriod: Number(e.target.value) })} /></FormField>
            <FormField label="Descripción" full><input className="input" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></FormField>
            <FormField label="Estado"><label className="check"><input type="checkbox" checked={editing.isActive ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} /> Activo</label></FormField>
            {error && <div className="alert error full">{error}</div>}
          </div>
        )}
      </Modal>
    </Panel>
  )
}

function HistoryTab({ employeeId }: { employeeId: string }) {
  const res = useResource<PagedResult<AuditLogItem>>(`/admin/audit?employeeId=${employeeId}&pageSize=100`)
  return (
    <Panel title="Quién cambió qué" body={false}>
      <Load res={res}>
        {(page) => page.items.length === 0 ? <div className="empty">Sin registros</div> : (
          <table className="table">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
            <tbody>
              {page.items.map((a) => (
                <tr key={a.id}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(a.at)}</td>
                  <td>{a.actorName}</td>
                  <td className="mono">{a.action}</td>
                  <td className="mono muted" style={{ maxWidth: 420, wordBreak: 'break-word' }}>{a.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Load>
    </Panel>
  )
}

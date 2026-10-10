import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ROLE_LABEL, formatDate, formatMoney, useResource } from '@ep/shared'
import type { EmployeeListItem, PagedResult } from '@ep/shared'
import { Avatar, Badge, Load, PageHeader } from '../components/ui'

export function EmployeesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [active, setActive] = useState('true')
  const departments = useResource<string[]>('/admin/departments')

  const qs = new URLSearchParams({ pageSize: '200' })
  if (search.trim()) qs.set('search', search.trim())
  if (department) qs.set('department', department)
  if (active) qs.set('active', active)
  const res = useResource<PagedResult<EmployeeListItem>>(`/admin/employees?${qs}`)

  return (
    <>
      <PageHeader title="Colaboradores" subtitle="Administra la información laboral de la organización"
        actions={<Link to="/employees/new" className="btn">+ Nuevo colaborador</Link>} />
      <section className="panel">
        <div className="toolbar">
          <input className="input" placeholder="Buscar por nombre, código, email o cargo…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
          <select className="select" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">Todos los departamentos</option>
            {departments.data?.map((d) => <option key={d}>{d}</option>)}
          </select>
          <select className="select" value={active} onChange={(e) => setActive(e.target.value)}>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
            <option value="">Todos</option>
          </select>
        </div>
        <Load res={res}>
          {(page) => page.items.length === 0 ? <div className="empty">Sin resultados</div> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Colaborador</th><th>Cargo</th><th>Departamento</th><th>Supervisor</th><th>Ingreso</th><th>Rol</th><th className="num">Salario</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {page.items.map((e) => (
                    <tr key={e.id} className="clickable" onClick={() => navigate(`/employees/${e.id}`)}>
                      <td><div className="cell-person"><Avatar name={e.fullName} /><div><b>{e.fullName}</b><span>{e.employeeCode} · {e.workEmail}</span></div></div></td>
                      <td>{e.jobTitle}</td>
                      <td>{e.department}</td>
                      <td className="muted">{e.managerName ?? '—'}</td>
                      <td className="muted">{formatDate(e.hireDate)}</td>
                      <td>{e.role !== 'employee' ? <Badge status="role">{ROLE_LABEL[e.role]}</Badge> : <span className="muted">Empleado</span>}</td>
                      <td className="num">{formatMoney(e.monthlySalary)}</td>
                      <td><Badge status={e.isActive ? 'active' : 'inactive'}>{e.isActive ? 'Activo' : 'Inactivo'}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="muted small" style={{ padding: '10px 16px' }}>{page.total} colaboradores</div>
            </div>
          )}
        </Load>
      </section>
    </>
  )
}

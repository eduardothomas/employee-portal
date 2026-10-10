import { useState } from 'react'
import { formatDate, formatMoney, useResource } from '@ep/shared'
import type { ChangeRequest, Me } from '@ep/shared'
import { Load, NavBar, Row, Section, StatusBadge } from '../../components/ui'
import { ChangeRequestSheet, type ChangeTarget } from './ChangeRequestSheet'

const TYPE: Record<string, string> = { fullTime: 'Tiempo completo', partTime: 'Medio tiempo', contractor: 'Contratista' }
const FIELD_LABEL: Record<string, string> = {
  firstName: 'Nombre', lastName: 'Apellido', jobTitle: 'Cargo', department: 'Departamento', monthlySalary: 'Salario',
  hireDate: 'Fecha de ingreso', manager: 'Supervisor', bankAccount: 'Cuenta bancaria', nationalId: 'Cédula',
}

export function EmploymentPage() {
  const res = useResource<Me>('/me')
  const requests = useResource<ChangeRequest[]>('/me/change-requests')
  const [change, setChange] = useState<ChangeTarget | null>(null)

  return (
    <>
      <NavBar title="Información laboral" />
      <div className="page">
        <Load res={res}>
          {({ employment: e }) => (
            <>
              <div className="list">
                <Row title="Código" value={e.employeeCode} />
                <Row title="Cargo" value={e.jobTitle} onClick={() => setChange({ field: 'jobTitle', label: 'Cargo', current: e.jobTitle })} />
                <Row title="Departamento" value={e.department} onClick={() => setChange({ field: 'department', label: 'Departamento', current: e.department })} />
                <Row title="Supervisor" value={e.managerName ?? '—'} onClick={() => setChange({ field: 'manager', label: 'Supervisor', current: e.managerName })} />
                <Row title="Fecha de ingreso" value={formatDate(e.hireDate)} onClick={() => setChange({ field: 'hireDate', label: 'Fecha de ingreso', current: e.hireDate })} />
                <Row title="Tipo" value={TYPE[e.employmentType] ?? e.employmentType} />
                <Row title="Salario mensual" value={formatMoney(e.monthlySalary)} onClick={() => setChange({ field: 'monthlySalary', label: 'Salario', current: e.monthlySalary.toFixed(2) })} />
                <Row title="Email corporativo" value={<span className="small">{e.workEmail}</span>} />
              </div>
              <p className="form-note">Estos datos los administra RRHH. Toca un campo para solicitar una modificación.</p>
            </>
          )}
        </Load>

        {requests.data && requests.data.length > 0 && (
          <Section title="Mis solicitudes de cambio">
            <div className="list">
              {requests.data.map((r) => (
                <Row key={r.id} title={FIELD_LABEL[r.field] ?? r.field} subtitle={`→ ${r.requestedValue}${r.reviewComment ? ` · ${r.reviewComment}` : ''}`} value={<StatusBadge status={r.status} />} />
              ))}
            </div>
          </Section>
        )}
      </div>
      <ChangeRequestSheet target={change} onClose={() => { setChange(null); void requests.reload() }} />
    </>
  )
}

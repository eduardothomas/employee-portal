import { useState } from 'react'
import { formatDateTime, useResource } from '@ep/shared'
import type { AuditLogItem, PagedResult } from '@ep/shared'
import { Load, PageHeader } from '../components/ui'

const PREFIXES = [
  ['', 'Todas las acciones'], ['auth', 'Autenticación'], ['employee', 'Colaboradores'], ['employee.salary_changed', 'Cambios de salario'],
  ['vacation', 'Vacaciones'], ['leave', 'Permisos'], ['document', 'Documentos'], ['payslip', 'Comprobantes'], ['payroll', 'Planillas'],
  ['profile', 'Perfil'], ['announcement', 'Comunicados'],
]

export function AuditPage() {
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const qs = new URLSearchParams({ page: String(page), pageSize: '50' })
  if (action) qs.set('action', action)
  if (from) qs.set('from', from)
  if (to) qs.set('to', to)
  const res = useResource<PagedResult<AuditLogItem>>(`/admin/audit?${qs}`)

  return (
    <>
      <PageHeader title="Auditoría" subtitle="¿Quién modificó el salario? ¿Quién aprobó estas vacaciones? ¿Quién descargó este documento?" />
      <section className="panel">
        <div className="toolbar">
          <select className="select" value={action} onChange={(e) => { setAction(e.target.value); setPage(1) }}>
            {PREFIXES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
          <span className="muted">a</span>
          <input className="input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} />
        </div>
        <Load res={res}>
          {(data) => (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Colaborador</th><th>Detalle</th><th>IP</th></tr></thead>
                  <tbody>
                    {data.items.map((a) => (
                      <tr key={a.id}>
                        <td className="muted" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(a.at)}</td>
                        <td><b>{a.actorName}</b></td>
                        <td className="mono">{a.action}</td>
                        <td>{a.subjectEmployeeName ?? '—'}</td>
                        <td className="mono muted" style={{ maxWidth: 380, wordBreak: 'break-word' }}>{a.details ?? ''}</td>
                        <td className="mono muted">{a.ipAddress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row-between" style={{ padding: '10px 16px' }}>
                <span className="muted small">{data.total} registros</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn secondary sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
                  <button className="btn secondary sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Siguiente</button>
                </div>
              </div>
            </>
          )}
        </Load>
      </section>
    </>
  )
}

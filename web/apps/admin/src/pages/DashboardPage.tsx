import { Link } from 'react-router-dom'
import { formatDate, formatDateTime, formatLongDate, formatMoney, useResource } from '@ep/shared'
import type { AdminDashboard } from '@ep/shared'
import { Load, PageHeader, Panel } from '../components/ui'

export function DashboardPage() {
  const res = useResource<AdminDashboard>('/admin/dashboard')

  return (
    <>
      <PageHeader title="Resumen" subtitle="Estado general de la organización" />
      <Load res={res}>
        {(d) => {
          const maxDept = Math.max(...d.headcountByDepartment.map((x) => x.count), 1)
          return (
            <>
              <div className="grid cols-4">
                <div className="panel kpi"><div className="label">Colaboradores activos</div><div className="value">{d.activeEmployees}</div><div className="hint">{d.awayToday} ausentes hoy</div></div>
                <Link to="/approvals" className="panel kpi alert" style={{ color: 'inherit' }}>
                  <div className="label">Solicitudes pendientes</div><div className="value">{d.pendingVacations + d.pendingLeaves}</div>
                  <div className="hint">{d.pendingVacations} vacaciones · {d.pendingLeaves} permisos</div>
                </Link>
                <div className="panel kpi"><div className="label">Próximo pago</div><div className="value" style={{ fontSize: 22 }}>{formatLongDate(d.nextPayDate)}</div><div className="hint">Última planilla neta {formatMoney(d.lastPayrollNet)}</div></div>
                <div className="panel kpi"><div className="label">Costo salarial mensual</div><div className="value">{formatMoney(d.monthlyPayrollCost)}</div><div className="hint">Salarios base</div></div>
              </div>

              {d.pendingChangeRequests > 0 && (
                <div className="alert info" style={{ marginTop: 16 }}>
                  Hay {d.pendingChangeRequests} solicitud(es) de cambio de datos esperando revisión. <Link to="/change-requests">Revisar →</Link>
                </div>
              )}

              <div className="grid cols-2" style={{ marginTop: 20 }}>
                <Panel title="Colaboradores por departamento">
                  <div className="bar-list">
                    {d.headcountByDepartment.map((x) => (
                      <div key={x.label} className="bar-item">
                        <span>{x.label}</span>
                        <div className="bar-track"><span style={{ width: `${(x.count / maxDept) * 100}%` }} /></div>
                        <span className="num">{x.count}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel title="Próximas vacaciones aprobadas" body={false}>
                  {d.upcomingVacations.length === 0 ? <div className="empty">Sin vacaciones próximas</div> : (
                    <table className="table">
                      <tbody>
                        {d.upcomingVacations.map((v) => (
                          <tr key={v.id}>
                            <td><b>{v.employeeName}</b></td>
                            <td className="muted">{formatDate(v.startDate)} – {formatDate(v.endDate)}</td>
                            <td className="num">{v.days} días</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Panel>
              </div>

              <Panel title="Actividad reciente" actions={<Link to="/audit">Ver auditoría →</Link>} body={false}>
                <table className="table">
                  <tbody>
                    {d.recentAudit.map((a) => (
                      <tr key={a.id}>
                        <td className="muted" style={{ width: 170 }}>{formatDateTime(a.at)}</td>
                        <td><b>{a.actorName}</b></td>
                        <td><span className="mono">{a.action}</span></td>
                        <td className="muted">{a.subjectEmployeeName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            </>
          )
        }}
      </Load>
    </>
  )
}

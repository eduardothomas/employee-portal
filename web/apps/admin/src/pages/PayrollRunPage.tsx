import { Link, useNavigate, useParams } from 'react-router-dom'
import { errorMessage, formatDate, formatMoney, useAuth, useResource } from '@ep/shared'
import type { PayrollRunDetail } from '@ep/shared'
import { Badge, Load, PageHeader, Panel, toast } from '../components/ui'

export function PayrollRunPage() {
  const { id } = useParams()
  const { api } = useAuth()
  const navigate = useNavigate()
  const res = useResource<PayrollRunDetail>(`/admin/payroll-runs/${id}`)

  async function publish() {
    if (!confirm('Al publicar, cada colaborador verá su comprobante y recibirá una notificación. ¿Continuar?')) return
    try {
      res.setData(await api.post<PayrollRunDetail>(`/admin/payroll-runs/${id}/publish`))
      toast('Planilla publicada')
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  async function remove() {
    if (!confirm('¿Eliminar este borrador?')) return
    try {
      await api.delete(`/admin/payroll-runs/${id}`)
      toast('Borrador eliminado')
      navigate('/payroll')
    } catch (e) {
      toast(errorMessage(e))
    }
  }

  return (
    <Load res={res}>
      {({ run, payslips }) => (
        <>
          <PageHeader breadcrumb={<Link to="/payroll">Planillas</Link>}
            title={`${run.kind === 'decimo' ? 'Décimo' : 'Quincena'} · ${formatDate(run.payDate)}`}
            subtitle={<>Período {formatDate(run.periodStart)} – {formatDate(run.periodEnd)} · <Badge status={run.status} /></>}
            actions={run.status === 'draft' && <>
              <button className="btn danger" onClick={remove}>Eliminar borrador</button>
              <button className="btn" onClick={publish}>Publicar planilla</button>
            </>} />

          <div className="grid cols-4">
            <div className="panel kpi"><div className="label">Colaboradores</div><div className="value">{run.employeeCount}</div></div>
            <div className="panel kpi"><div className="label">Bruto</div><div className="value">{formatMoney(run.totalGross)}</div></div>
            <div className="panel kpi"><div className="label">Deducciones</div><div className="value">{formatMoney(run.totalDeductions)}</div></div>
            <div className="panel kpi"><div className="label">Neto a pagar</div><div className="value">{formatMoney(run.totalNet)}</div></div>
          </div>

          <Panel title="Detalle por colaborador" body={false}>
            <table className="table">
              <thead><tr><th>Colaborador</th><th>Departamento</th><th className="num">Bruto</th><th className="num">Deducciones</th><th className="num">Neto</th></tr></thead>
              <tbody>
                {payslips.map((p) => (
                  <tr key={p.payslipId}>
                    <td><Link to={`/employees/${p.employeeId}`}><b>{p.employeeName}</b></Link></td>
                    <td className="muted">{p.department}</td>
                    <td className="num">{formatMoney(p.gross)}</td>
                    <td className="num">{formatMoney(p.deductions)}</td>
                    <td className="num"><b>{formatMoney(p.net)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </Load>
  )
}

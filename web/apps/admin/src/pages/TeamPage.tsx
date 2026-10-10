import { useResource } from '@ep/shared'
import type { TeamMember } from '@ep/shared'
import { Avatar, Badge, Load, PageHeader, Panel } from '../components/ui'

export function TeamPage() {
  const res = useResource<TeamMember[]>('/manager/team')
  return (
    <>
      <PageHeader title="Mi equipo" subtitle="Colaboradores que te reportan directamente" />
      <Panel body={false}>
        <Load res={res}>
          {(team) => team.length === 0 ? <div className="empty">No tienes reportes directos</div> : (
            <table className="table">
              <thead><tr><th>Colaborador</th><th>Departamento</th><th>Hoy</th><th className="num">Vacaciones disponibles</th><th className="num">Solicitudes pendientes</th></tr></thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id}>
                    <td><div className="cell-person"><Avatar name={m.fullName} url={m.photoUrl} /><div><b>{m.fullName}</b><span>{m.jobTitle}</span></div></div></td>
                    <td>{m.department}</td>
                    <td>{m.awayToday ? <Badge status="pending">{m.awayToday}</Badge> : <Badge status="active">Disponible</Badge>}</td>
                    <td className="num">{m.vacationAvailable} días</td>
                    <td className="num">{m.pendingRequests || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Load>
      </Panel>
    </>
  )
}

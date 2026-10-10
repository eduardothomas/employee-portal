import type { ReactNode } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { EnvironmentBanner, ROLE_LABEL, asset, useAuth, useResource } from '@ep/shared'
import type { AdminDashboard } from '@ep/shared'
import { Avatar, Spinner, ToastHost } from './components/ui'
import { AnnouncementsPage } from './pages/AnnouncementsPage'
import { ApprovalsPage } from './pages/ApprovalsPage'
import { AuditPage } from './pages/AuditPage'
import { ChangeRequestsPage } from './pages/ChangeRequestsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { EmployeeEditPage } from './pages/EmployeeEditPage'
import { EmployeesPage } from './pages/EmployeesPage'
import { LeaveTypesPage } from './pages/LeaveTypesPage'
import { LoginPage } from './pages/LoginPage'
import { PayrollPage } from './pages/PayrollPage'
import { PayrollRunPage } from './pages/PayrollRunPage'
import { TeamPage } from './pages/TeamPage'

function Layout() {
  const { user, logout } = useAuth()
  const isHr = user?.role === 'hrAdmin'
  const counts = useResource<AdminDashboard>(isHr ? '/admin/dashboard' : null)
  const pending = counts.data ? counts.data.pendingVacations + counts.data.pendingLeaves : 0

  const item = (to: string, label: string, icon: string, count?: number) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
      <span>{icon}</span>{label}{!!count && <span className="count">{count}</span>}
    </NavLink>
  )

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand"><img src={asset('icon.svg')} alt="" /><div>Employee Portal<small>Recursos Humanos</small></div></div>
        {isHr ? (
          <>
            {item('/', 'Resumen', '📊')}
            <div className="nav-label">Gestión</div>
            {item('/employees', 'Colaboradores', '👥')}
            {item('/approvals', 'Aprobaciones', '✅', pending)}
            {item('/change-requests', 'Solicitudes de cambio', '✏️', counts.data?.pendingChangeRequests)}
            {item('/payroll', 'Planillas', '💰')}
            {item('/documents', 'Documentos', '📄')}
            <div className="nav-label">Configuración</div>
            {item('/leave-types', 'Tipos de permiso', '🗂️')}
            {item('/announcements', 'Comunicaciones', '📣')}
            {item('/audit', 'Auditoría', '🛡️')}
            <div className="nav-label">Mi equipo</div>
            {item('/team', 'Equipo directo', '🧑‍🤝‍🧑')}
          </>
        ) : (
          <>
            {item('/', 'Aprobaciones', '✅')}
            {item('/team', 'Mi equipo', '👥')}
          </>
        )}
        <div className="sidebar-footer">
          <Avatar name={user?.fullName ?? ''} url={user?.photoUrl} />
          <div className="who"><b>{user?.fullName}</b><span>{ROLE_LABEL[user?.role ?? 'employee']}</span></div>
          <button onClick={() => void logout()}>Salir</button>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  )
}

function Guard({ children }: { children: ReactNode }) {
  const { status, user, logout } = useAuth()
  if (status === 'loading') return <Spinner />
  if (status !== 'authenticated') return <LoginPage />
  if (user?.role === 'employee')
    return (
      <main className="login">
        <div className="panel login-card">
          <h1>Acceso restringido</h1>
          <p className="lead">Este portal es para RRHH y supervisores. Usa el app de colaboradores para tus consultas.</p>
          <button className="btn" onClick={() => void logout()}>Cerrar sesión</button>
        </div>
      </main>
    )
  return <>{children}</>
}

export function App() {
  const { user } = useAuth()
  const isHr = user?.role === 'hrAdmin'
  return (
    <>
    <EnvironmentBanner otherApp={{ label: 'Abrir app del colaborador →', href: import.meta.env.BASE_URL.replace(/admin\/$/, '') }} />
    <Guard>
      <Routes>
        <Route element={<Layout />}>
          {isHr ? (
            <>
              <Route index element={<DashboardPage />} />
              <Route path="employees" element={<EmployeesPage />} />
              <Route path="employees/new" element={<EmployeeEditPage />} />
              <Route path="employees/:id" element={<EmployeeEditPage key="edit" />} />
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route path="change-requests" element={<ChangeRequestsPage />} />
              <Route path="payroll" element={<PayrollPage />} />
              <Route path="payroll/:id" element={<PayrollRunPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="leave-types" element={<LeaveTypesPage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route path="audit" element={<AuditPage />} />
            </>
          ) : (
            <Route index element={<ApprovalsPage />} />
          )}
          <Route path="team" element={<TeamPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ToastHost />
    </Guard>
    </>
  )
}

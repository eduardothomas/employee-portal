import type { ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { EnvironmentBanner, useAuth } from '@ep/shared'
import { TabBar } from './components/TabBar'
import { Spinner, ToastHost } from './components/ui'
import { BiometricSetupPage } from './pages/auth/BiometricSetupPage'
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage'
import { LockedPage } from './pages/auth/LockedPage'
import { LoginPage } from './pages/auth/LoginPage'
import { MfaPage } from './pages/auth/MfaPage'
import { ApprovalsPage } from './pages/home/ApprovalsPage'
import { HomePage } from './pages/home/HomePage'
import { NotificationsPage } from './pages/home/NotificationsPage'
import { BankPage } from './pages/me/BankPage'
import { DocumentsPage } from './pages/me/DocumentsPage'
import { EmploymentPage } from './pages/me/EmploymentPage'
import { MePage } from './pages/me/MePage'
import { PersonalInfoPage } from './pages/me/PersonalInfoPage'
import { SecurityPage } from './pages/me/SecurityPage'
import { DecimoPage } from './pages/payroll/DecimoPage'
import { DeductionsPage } from './pages/payroll/DeductionsPage'
import { MonthDetailPage } from './pages/payroll/MonthDetailPage'
import { PayrollPage } from './pages/payroll/PayrollPage'
import { PayslipDetailPage } from './pages/payroll/PayslipDetailPage'
import { PayslipsPage } from './pages/payroll/PayslipsPage'
import { LeavePage } from './pages/time/LeavePage'
import { LeaveRequestPage } from './pages/time/LeaveRequestPage'
import { TimePage } from './pages/time/TimePage'
import { VacationRequestPage } from './pages/time/VacationRequestPage'

/** Root tab screens show the tab bar; pushed screens (details/forms) hide it like iOS. */
function TabsLayout() {
  return (
    <div className="shell">
      <Outlet />
      <TabBar />
    </div>
  )
}

function StackLayout() {
  return (
    <div className="shell no-tabs">
      <Outlet />
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'loading') return <Spinner />
  if (status === 'locked') return <LockedPage />
  if (status === 'anonymous') return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  if (status === 'authenticated') return <Navigate to="/" replace />
  if (status === 'locked') return <LockedPage />
  return <>{children}</>
}

export function App() {
  return (
    <>
      <EnvironmentBanner otherApp={{ label: 'Abrir portal de RRHH →', href: `${import.meta.env.BASE_URL}admin/` }} />
      <Routes>
        <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
        <Route path="/login/verify" element={<PublicOnly><MfaPage /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
        <Route path="/login/biometric" element={<RequireAuth><BiometricSetupPage /></RequireAuth>} />

        <Route element={<RequireAuth><TabsLayout /></RequireAuth>}>
          <Route index element={<HomePage />} />
          <Route path="payroll" element={<PayrollPage />} />
          <Route path="time" element={<TimePage />} />
          <Route path="me" element={<MePage />} />
        </Route>

        <Route element={<RequireAuth><StackLayout /></RequireAuth>}>
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="payroll/month/:year/:month" element={<MonthDetailPage />} />
          <Route path="payroll/payslips" element={<PayslipsPage />} />
          <Route path="payroll/payslips/:id" element={<PayslipDetailPage />} />
          <Route path="payroll/deductions" element={<DeductionsPage />} />
          <Route path="payroll/decimo" element={<DecimoPage />} />
          <Route path="time/vacations" element={<Navigate to="/time" replace />} />
          <Route path="time/vacations/new" element={<VacationRequestPage />} />
          <Route path="time/leave" element={<LeavePage />} />
          <Route path="time/leave/new" element={<LeaveRequestPage />} />
          <Route path="me/personal" element={<PersonalInfoPage />} />
          <Route path="me/employment" element={<EmploymentPage />} />
          <Route path="me/bank" element={<BankPage />} />
          <Route path="me/documents" element={<DocumentsPage />} />
          <Route path="me/security" element={<SecurityPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastHost />
    </>
  )
}

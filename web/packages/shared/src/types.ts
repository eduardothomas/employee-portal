// Mirrors EmployeePortal.Contracts (backend). Dates are ISO strings: DateOnly → "yyyy-MM-dd".

export type Role = 'employee' | 'manager' | 'hrAdmin'
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface UserSummary {
  id: string
  employeeCode: string
  displayName: string
  fullName: string
  jobTitle: string
  role: Role
  photoUrl: string | null
}

export interface LoginResponse {
  challengeId: string
  maskedDestination: string
  expiresAt: string
  devCode: string | null
}

export interface AuthTokensResponse {
  accessToken: string
  accessTokenExpiresAt: string
  refreshToken: string
  user: UserSummary
}

export interface PersonalInfo {
  firstName: string
  lastName: string
  preferredName: string | null
  nationalIdMasked: string
  birthDate: string | null
  personalEmail: string | null
  phone: string | null
  address: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelationship: string | null
  photoUrl: string | null
}

export interface EmploymentInfo {
  employeeCode: string
  jobTitle: string
  department: string
  hireDate: string
  employmentType: string
  managerName: string | null
  monthlySalary: number
  workEmail: string
}

export interface BankInfo {
  bankName: string | null
  accountType: string | null
  maskedAccount: string | null
}

export interface Me {
  id: string
  displayName: string
  fullName: string
  role: Role
  photoUrl: string | null
  personal: PersonalInfo
  employment: EmploymentInfo
  bank: BankInfo
  biometricEnabled: boolean
  unreadNotifications: number
}

export type UpdateProfileRequest = Partial<{
  preferredName: string
  personalEmail: string
  phone: string
  address: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelationship: string
  photoUrl: string
}>

export interface ChangeRequest {
  id: string
  employeeId: string
  employeeName: string
  field: string
  currentValue: string | null
  requestedValue: string
  reason: string | null
  status: RequestStatus
  createdAt: string
  reviewedAt: string | null
  reviewerName: string | null
  reviewComment: string | null
}

export interface ActivityItem {
  type: string
  icon: string
  title: string
  subtitle: string
  date: string
  link: string | null
}

export interface VacationBalance {
  accrued: number
  used: number
  pending: number
  available: number
}

export interface Dashboard {
  displayName: string
  nextPay: { date: string; estimatedNet: number }
  vacation: VacationBalance
  pendingRequests: number
  unreadNotifications: number
  isManager: boolean
  pendingApprovals: number
  recentActivity: ActivityItem[]
}

export interface PayslipLine {
  code: string
  description: string
  amount: number
}

export interface PayslipSummary {
  id: string
  number: string
  kind: 'regular' | 'decimo'
  periodStart: string
  periodEnd: string
  payDate: string
  gross: number
  deductions: number
  net: number
}

export interface PayslipDetail {
  summary: PayslipSummary
  earnings: PayslipLine[]
  deductionLines: PayslipLine[]
  employeeName: string
  employeeCode: string
  jobTitle: string
}

export interface MonthlyNet {
  year: number
  month: number
  gross: number
  deductions: number
  net: number
}

export interface PayrollSummary {
  monthlySalary: number
  nextPayDate: string
  nextPayEstimatedNet: number
  latestPayslip: PayslipSummary | null
  history: MonthlyNet[]
}

export interface MonthDetail {
  year: number
  month: number
  earnings: PayslipLine[]
  deductionLines: PayslipLine[]
  gross: number
  deductions: number
  net: number
  payslips: PayslipSummary[]
}

export interface DeductionMonth {
  year: number
  month: number
  total: number
  byCode: Record<string, number>
}

export interface Deductions {
  year: number
  month: number
  items: PayslipLine[]
  total: number
  yearToDate: PayslipLine[]
  history: DeductionMonth[]
}

export interface Decimo {
  nextPayDate: string
  periodStart: string
  periodEnd: string
  estimatedGross: number
  estimatedNet: number
  history: PayslipSummary[]
}

export interface Holiday {
  date: string
  name: string
}

export interface VacationRequest {
  id: string
  number: string
  employeeId: string
  employeeName: string
  startDate: string
  endDate: string
  days: number
  comment: string | null
  status: RequestStatus
  createdAt: string
  reviewedAt: string | null
  reviewerName: string | null
  reviewComment: string | null
}

export interface Vacations {
  balance: VacationBalance
  upcoming: VacationRequest | null
  requests: VacationRequest[]
  holidays: Holiday[]
}

export interface VacationPreview {
  startDate: string
  endDate: string
  days: number
  available: number
  remainingAfter: number
  holidaysInRange: Holiday[]
  isValid: boolean
  error: string | null
}

export interface LeaveType {
  id: string
  code: string
  name: string
  icon: string
  isPaid: boolean
  requiresAttachment: boolean
  maxDaysPerYear: number | null
  isActive: boolean
  sortOrder: number
}

export type SaveLeaveType = Omit<LeaveType, 'id'>

export interface LeaveRequest {
  id: string
  number: string
  employeeId: string
  employeeName: string
  leaveTypeId: string
  leaveTypeName: string
  leaveTypeIcon: string
  startDate: string
  endDate: string
  hours: number | null
  reason: string
  status: RequestStatus
  createdAt: string
  reviewedAt: string | null
  reviewerName: string | null
  reviewComment: string | null
}

export interface DocumentItem {
  id: string
  category: 'employment' | 'payroll' | 'other'
  title: string
  fileName: string
  contentType: string
  sizeBytes: number
  uploadedAt: string
  source: 'document' | 'payslip'
  downloadUrl: string
  employeeId: string | null
  employeeName: string | null
}

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  createdAt: string
  readAt: string | null
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface TeamMember {
  id: string
  employeeCode: string
  fullName: string
  jobTitle: string
  department: string
  photoUrl: string | null
  vacationAvailable: number
  awayToday: string | null
  pendingRequests: number
}

export interface Approvals {
  vacations: VacationRequest[]
  leaves: LeaveRequest[]
}

export interface EmployeeListItem {
  id: string
  employeeCode: string
  fullName: string
  workEmail: string
  jobTitle: string
  department: string
  role: Role
  managerName: string | null
  isActive: boolean
  hireDate: string
  monthlySalary: number
}

export interface RecurringDeduction {
  id: string
  code: string
  description: string
  amountPerPeriod: number
  isActive: boolean
}

export interface EmployeeDetail {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  preferredName: string | null
  nationalId: string
  birthDate: string | null
  workEmail: string
  personalEmail: string | null
  phone: string | null
  address: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelationship: string | null
  jobTitle: string
  department: string
  hireDate: string
  employmentType: 'fullTime' | 'partTime' | 'contractor'
  managerId: string | null
  managerName: string | null
  monthlySalary: number
  isActive: boolean
  bankName: string | null
  bankAccountType: string | null
  bankAccountNumber: string | null
  role: Role
  vacationAccruedDays: number
  vacationBalance: VacationBalance
  recurringDeductions: RecurringDeduction[]
}

export interface SaveEmployee {
  employeeCode: string
  firstName: string
  lastName: string
  preferredName: string | null
  nationalId: string
  birthDate: string | null
  workEmail: string
  personalEmail: string | null
  phone: string | null
  address: string | null
  jobTitle: string
  department: string
  hireDate: string
  employmentType: string
  managerId: string | null
  monthlySalary: number
  isActive: boolean
  bankName: string | null
  bankAccountType: string | null
  bankAccountNumber: string | null
  role: string
  vacationAccruedDays: number
  initialPassword: string | null
}

export interface PayrollRun {
  id: string
  kind: 'regular' | 'decimo'
  periodStart: string
  periodEnd: string
  payDate: string
  status: 'draft' | 'published'
  createdAt: string
  publishedAt: string | null
  employeeCount: number
  totalGross: number
  totalDeductions: number
  totalNet: number
}

export interface PayrollRunRow {
  payslipId: string
  employeeId: string
  employeeName: string
  department: string
  gross: number
  deductions: number
  net: number
}

export interface PayrollRunDetail {
  run: PayrollRun
  payslips: PayrollRunRow[]
}

export interface AuditLogItem {
  id: number
  at: string
  actorName: string
  action: string
  entityType: string
  entityId: string | null
  subjectEmployeeName: string | null
  details: string | null
  ipAddress: string | null
}

export interface AdminDashboard {
  activeEmployees: number
  pendingVacations: number
  pendingLeaves: number
  pendingChangeRequests: number
  awayToday: number
  nextPayDate: string
  lastPayrollNet: number
  monthlyPayrollCost: number
  headcountByDepartment: { label: string; count: number }[]
  upcomingVacations: VacationRequest[]
  recentAudit: AuditLogItem[]
}

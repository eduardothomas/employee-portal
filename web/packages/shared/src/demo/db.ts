import { toIsoDate } from '../format'
import type { Role } from '../types'
import {
  addWorkingDays, calculateDecimo, calculateRegular, decimoPeriod, nextPayDate, nextWorkingDay, periodFor, previousPayDate,
  addDays, workingDays, MONTH_NAMES, type Line,
} from './rules'

export type Status = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface Emp {
  id: string; employeeCode: string; firstName: string; lastName: string; preferredName: string | null; nationalId: string
  birthDate: string | null; workEmail: string; personalEmail: string | null; phone: string | null; address: string | null
  emergencyContactName: string | null; emergencyContactPhone: string | null; emergencyContactRelationship: string | null
  jobTitle: string; department: string; hireDate: string; employmentType: string; managerId: string | null
  monthlySalary: number; isActive: boolean; bankName: string | null; bankAccountType: string | null; bankAccountNumber: string | null
  vacationAccruedDays: number; role: Role; biometricEnabled: boolean; photoUrl: string | null; password: string
}
export interface Deduction { id: string; employeeId: string; code: string; description: string; amountPerPeriod: number; isActive: boolean }
export interface Run { id: string; kind: 'regular' | 'decimo'; periodStart: string; periodEnd: string; payDate: string; status: 'draft' | 'published'; createdAt: string; publishedAt: string | null }
export interface Slip { id: string; employeeId: string; runId: string; kind: 'regular' | 'decimo'; periodStart: string; periodEnd: string; payDate: string; isPublished: boolean; lines: Line[] }
interface Reviewable { id: string; employeeId: string; status: Status; createdAt: string; reviewedById: string | null; reviewedAt: string | null; reviewComment: string | null }
export interface Vac extends Reviewable { number: string; startDate: string; endDate: string; days: number; comment: string | null }
export interface LeaveT { id: string; code: string; name: string; icon: string; isPaid: boolean; requiresAttachment: boolean; maxDaysPerYear: number | null; isActive: boolean; sortOrder: number }
export interface Leave extends Reviewable { number: string; leaveTypeId: string; startDate: string; endDate: string; hours: number | null; reason: string }
export interface Change extends Reviewable { field: string; currentValue: string | null; requestedValue: string; reason: string | null }
export interface Doc {
  id: string; employeeId: string | null; category: 'employment' | 'payroll' | 'other'; title: string; fileName: string; contentType: string
  sizeBytes: number; uploadedAt: string; letter?: { title: string; paragraphs: string[] }; dataBase64?: string
}
export interface Notif { id: string; employeeId: string; type: string; title: string; body: string; link: string | null; createdAt: string; readAt: string | null }
export interface Audit { id: number; at: string; actorId: string | null; actorName: string; action: string; entityType: string; entityId: string | null; subjectEmployeeId: string | null; details: string | null }

export interface DemoDb {
  version: number
  employees: Emp[]; deductions: Deduction[]; runs: Run[]; slips: Slip[]; vacations: Vac[]; leaveTypes: LeaveT[]; leaves: Leave[]
  changes: Change[]; documents: Doc[]; notifications: Notif[]; audit: Audit[]; mfa: Record<string, { employeeId: string; code: string }>
}

export const DEMO_PASSWORD = 'Portal2026!'
export const uid = () => crypto.randomUUID()
export const nowIso = () => new Date().toISOString()
const today = () => toIsoDate(new Date())

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function seed(): DemoDb {
  const t = today()
  const db: DemoDb = { version: 1, employees: [], deductions: [], runs: [], slips: [], vacations: [], leaveTypes: [], leaves: [], changes: [], documents: [], notifications: [], audit: [], mfa: {} }

  const E = (code: string, first: string, last: string, title: string, dept: string, salary: number, role: Role, manager: Emp | null, hired: string, phone: string, accrued: number): Emp => {
    const e: Emp = {
      id: uid(), employeeCode: code, firstName: first, lastName: last, preferredName: null, nationalId: `8-${700 + db.employees.length * 31}-${1000 + db.employees.length * 977}`,
      birthDate: `199${db.employees.length}-0${(db.employees.length % 9) + 1}-1${db.employees.length}`, workEmail: `${slug(first)}.${slug(last)}@employeeportal.dev`,
      personalEmail: null, phone, address: 'Ciudad de Panamá', emergencyContactName: null, emergencyContactPhone: null, emergencyContactRelationship: null,
      jobTitle: title, department: dept, hireDate: hired, employmentType: 'fullTime', managerId: manager?.id ?? null, monthlySalary: salary, isActive: true,
      bankName: 'Banco General', bankAccountType: 'Ahorros', bankAccountNumber: `04-01-99-${100000 + db.employees.length * 12345}`,
      vacationAccruedDays: accrued, role, biometricEnabled: false, photoUrl: null, password: DEMO_PASSWORD,
    }
    db.employees.push(e)
    return e
  }
  const ricardo = E('EMP-0010', 'Ricardo', 'Arias', 'Director General', 'Dirección', 9000, 'manager', null, '2018-01-08', '+507 6000-0010', 24)
  const ana = E('EMP-0003', 'Ana', 'Castillo', 'Gerente de Recursos Humanos', 'Recursos Humanos', 4800, 'hrAdmin', ricardo, '2019-06-03', '+507 6000-0003', 18)
  const laura = E('EMP-0002', 'Laura', 'Méndez', 'Engineering Manager', 'Tecnología', 5200, 'manager', ricardo, '2020-02-17', '+507 6000-0002', 15)
  const eduardo = E('EMP-0001', 'Eduardo', 'Thomas', 'Software Engineer', 'Tecnología', 3500, 'employee', laura, '2023-03-01', '+507 6123-4567', 30)
  const diego = E('EMP-0004', 'Diego', 'Pérez', 'Frontend Developer', 'Tecnología', 2800, 'employee', laura, '2024-01-15', '+507 6000-0004', 16)
  const sofia = E('EMP-0005', 'Sofía', 'Herrera', 'QA Analyst', 'Tecnología', 2200, 'employee', laura, '2024-07-01', '+507 6000-0005', 11)
  const maria = E('EMP-0006', 'María', 'González', 'Analista de Planilla', 'Recursos Humanos', 2400, 'hrAdmin', ana, '2022-09-12', '+507 6000-0006', 20)
  const javier = E('EMP-0007', 'Javier', 'Ruiz', 'Contador', 'Finanzas', 3000, 'employee', ricardo, '2021-04-05', '+507 6000-0007', 22)
  Object.assign(eduardo, {
    personalEmail: 'eduardo.thomas@example.com', address: 'Costa del Este, Ciudad de Panamá', nationalId: '8-912-1234',
    emergencyContactName: 'Carmen Thomas', emergencyContactPhone: '+507 6987-6543', emergencyContactRelationship: 'Madre',
  })
  const ded = (e: Emp, code: string, description: string, amount: number) =>
    db.deductions.push({ id: uid(), employeeId: e.id, code, description, amountPerPeriod: amount, isActive: true })
  ded(eduardo, 'SEGURO', 'Seguro médico', 42.5); ded(eduardo, 'PRESTAMO', 'Préstamo personal', 125)
  ded(diego, 'SEGURO', 'Seguro médico', 42.5); ded(javier, 'SEGURO', 'Seguro médico', 42.5)

  const types: [string, string, string, number, Partial<LeaveT>][] = [
    ['personal', 'Personal', '👤', 1, { maxDaysPerYear: 3 }], ['medico', 'Cita médica', '🩺', 2, { requiresAttachment: true }],
    ['calamidad', 'Calamidad doméstica', '🕯️', 3, {}], ['estudios', 'Estudios', '🎓', 4, { isPaid: false }],
    ['maternidad', 'Maternidad / Paternidad', '👶', 5, {}], ['otros', 'Otros', '📝', 9, {}],
  ]
  for (const [code, name, icon, sortOrder, extra] of types)
    db.leaveTypes.push({ id: uid(), code, name, icon, isPaid: true, requiresAttachment: false, maxDaysPerYear: null, isActive: true, sortOrder, ...extra })

  // Payroll history: last 16 quincenas + last 3 décimos
  const payDates: string[] = []
  for (let d = nextPayDate(t); payDates.length < 16; d = previousPayDate(d)) if (d < t) payDates.unshift(d)
  for (const payDate of payDates) {
    const [start, end] = periodFor(payDate)
    const run: Run = { id: uid(), kind: 'regular', periodStart: start, periodEnd: end, payDate, status: 'published', createdAt: `${addDays(payDate, -3)}T15:00:00Z`, publishedAt: `${addDays(payDate, -1)}T15:00:00Z` }
    db.runs.push(run)
    const latest = payDate === payDates[payDates.length - 1]
    for (const e of db.employees.filter((x) => x.hireDate <= end)) {
      const isEd = e === eduardo
      const overtime = isEd && Number(payDate.slice(8)) > 15 ? (latest ? 150 : 60 * (Number(payDate.slice(5, 7)) % 3)) : 0
      const bonus = isEd && latest ? 200 : 0
      const extras = db.deductions.filter((d) => d.employeeId === e.id).map((d) => ({ code: d.code, description: d.description, amount: d.amountPerPeriod }))
      db.slips.push({ id: uid(), employeeId: e.id, runId: run.id, kind: 'regular', periodStart: start, periodEnd: end, payDate, isPublished: true, lines: calculateRegular(e.monthlySalary, bonus, overtime, extras) })
    }
  }
  const year = Number(t.slice(0, 4))
  const decimos = [year - 1, year].flatMap((y) => ['04', '08', '12'].map((m) => `${y}-${m}-15`)).filter((d) => d < t).slice(-3)
  for (const payDate of decimos) {
    const p = decimoPeriod(payDate)
    const run: Run = { id: uid(), kind: 'decimo', periodStart: p.start, periodEnd: p.end, payDate, status: 'published', createdAt: `${payDate}T12:00:00Z`, publishedAt: `${payDate}T12:00:00Z` }
    db.runs.push(run)
    for (const e of db.employees.filter((x) => x.hireDate <= p.end))
      db.slips.push({ id: uid(), employeeId: e.id, runId: run.id, kind: 'decimo', periodStart: p.start, periodEnd: p.end, payDate, isPublished: true, lines: calculateDecimo(e.monthlySalary * 4) })
  }

  // Vacations
  const req = (e: Emp, number: string, start: string, end: string, comment: string | null, approver: Emp | null, createdDaysAgo: number): Vac => ({
    id: uid(), employeeId: e.id, number, startDate: start, endDate: end, days: workingDays(start, end), comment,
    status: approver ? 'approved' : 'pending', createdAt: new Date(Date.now() - createdDaysAgo * 86_400_000).toISOString(),
    reviewedById: approver?.id ?? null, reviewedAt: approver ? new Date(Date.now() - (createdDaysAgo - 1) * 86_400_000).toISOString() : null, reviewComment: null,
  })
  const pastStart = nextWorkingDay(addDays(t, -120))
  db.vacations.push(req(eduardo, `VAC-${pastStart.slice(0, 4)}-00118`, pastStart, addWorkingDays(pastStart, 8), 'Viaje familiar', laura, 150))
  if (`${year}-12-15` > t) db.vacations.push(req(eduardo, `VAC-${year}-00142`, `${year}-12-15`, `${year}-12-29`, 'Vacaciones de fin de año', null, 2))
  const dStart = nextWorkingDay(addDays(t, 21))
  db.vacations.push(req(diego, `VAC-${dStart.slice(0, 4)}-00143`, dStart, addWorkingDays(dStart, 5), 'Boda de mi hermano', null, 1))
  const jStart = nextWorkingDay(addDays(t, -2))
  db.vacations.push(req(javier, `VAC-${jStart.slice(0, 4)}-00139`, jStart, addWorkingDays(jStart, 5), null, ricardo, 20))

  // Leave
  const lt = (code: string) => db.leaveTypes.find((x) => x.code === code)!.id
  const leave = (e: Emp, type: string, number: string, date: string, hours: number | null, reason: string, approver: Emp | null): Leave => ({
    id: uid(), employeeId: e.id, leaveTypeId: lt(type), number, startDate: date, endDate: date, hours, reason,
    status: approver ? 'approved' : 'pending', createdAt: `${addDays(date, -5)}T14:00:00Z`, reviewedById: approver?.id ?? null,
    reviewedAt: approver ? `${addDays(date, -4)}T14:00:00Z` : null, reviewComment: null,
  })
  db.leaves.push(
    leave(eduardo, 'medico', `PER-${year}-00201`, nextWorkingDay(addDays(t, -35)), 3, 'Control anual', laura),
    leave(eduardo, 'personal', `PER-${year}-00187`, nextWorkingDay(addDays(t, -50)), null, 'Trámite personal', laura),
    leave(eduardo, 'personal', `PER-${year}-00215`, nextWorkingDay(addDays(t, 3)), 2, 'Cita personal en el banco', null),
    leave(sofia, 'medico', `PER-${year}-00216`, nextWorkingDay(addDays(t, 5)), 4, 'Cita con especialista', null),
  )

  db.changes.push({
    id: uid(), employeeId: diego.id, field: 'jobTitle', currentValue: diego.jobTitle, requestedValue: 'Senior Frontend Developer',
    reason: 'Promoción aprobada en la evaluación de desempeño.', status: 'pending', createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    reviewedById: null, reviewedAt: null, reviewComment: null,
  })

  const doc = (e: Emp | null, category: Doc['category'], title: string, fileName: string, paragraphs: string[], daysAgo: number) =>
    db.documents.push({ id: uid(), employeeId: e?.id ?? null, category, title, fileName, contentType: 'application/pdf', sizeBytes: 1500 + paragraphs.join('').length,
      uploadedAt: new Date(Date.now() - daysAgo * 86_400_000).toISOString(), letter: { title, paragraphs } })
  doc(eduardo, 'employment', 'Contrato de trabajo', 'contrato-eduardo-thomas.pdf', [
    `Entre Employee Portal S.A. (EL EMPLEADOR) y Eduardo Thomas, con cédula ${eduardo.nationalId} (EL TRABAJADOR), se celebra el presente contrato de trabajo por tiempo indefinido.`,
    `EL TRABAJADOR desempeñará el cargo de ${eduardo.jobTitle} en el departamento de ${eduardo.department}, a partir del 01/03/2023.`,
    'El salario será pagado en dos quincenas, los días 15 y último de cada mes, mediante transferencia bancaria.',
    'Las partes se sujetan a lo dispuesto en el Código de Trabajo de la República de Panamá.',
  ], 900)
  doc(eduardo, 'employment', 'Carta de trabajo', 'carta-de-trabajo.pdf', [
    'A quien pueda interesar:',
    `Por medio de la presente certificamos que Eduardo Thomas labora en Employee Portal S.A. desde el 01/03/2023, ocupando el cargo de ${eduardo.jobTitle}, con un salario mensual de B/. 3,500.00.`,
    'Se expide la presente a solicitud del interesado.', 'Ana Castillo — Gerente de Recursos Humanos',
  ], 12)
  doc(eduardo, 'employment', 'Certificado laboral', 'certificado-laboral.pdf', [
    'Certificamos que Eduardo Thomas es colaborador activo de Employee Portal S.A. en el departamento de Tecnología.', 'Ana Castillo — Gerente de Recursos Humanos',
  ], 60)
  doc(null, 'other', 'Reglamento interno', 'reglamento-interno.pdf', [
    '1. Horario: lunes a viernes de 8:00 a.m. a 5:00 p.m., con una hora de almuerzo.',
    '2. Vacaciones: 30 días por cada 11 meses de trabajo continuo, solicitados con al menos 15 días de anticipación a través del Employee Portal.',
    '3. Permisos: deben solicitarse por el portal. Los permisos médicos requieren constancia.',
    '4. Confidencialidad: la información de clientes y colaboradores es estrictamente confidencial.',
  ], 200)

  const lastPay = payDates[payDates.length - 1]
  const n = (e: Emp, type: string, title: string, body: string, link: string | null, at: string, read = false) =>
    db.notifications.push({ id: uid(), employeeId: e.id, type, title, body, link, createdAt: at, readAt: read ? at : null })
  n(eduardo, 'payslip', 'Comprobante disponible', `Tu comprobante del ${Number(lastPay.slice(8))} de ${MONTH_NAMES[Number(lastPay.slice(5, 7)) - 1].toLowerCase()} está disponible.`, '/payroll', `${lastPay}T14:00:00Z`)
  n(eduardo, 'document', 'Nuevo documento', 'RRHH publicó «Carta de trabajo».', '/me/documents', new Date(Date.now() - 12 * 86_400_000).toISOString())
  n(eduardo, 'leave', 'Permiso aprobado', 'Tu permiso Cita médica fue aprobado.', '/time/leave', new Date(Date.now() - 36 * 86_400_000).toISOString(), true)
  n(eduardo, 'announcement', 'Bienvenido al demo 👋', 'Esta es una versión de demostración con datos ficticios. Tus cambios se guardan solo en este navegador.', null, new Date(Date.now() - 3600_000).toISOString())
  n(laura, 'general', 'Nueva solicitud de vacaciones', 'Diego Pérez solicitó vacaciones.', '/approvals', new Date(Date.now() - 86_400_000).toISOString())

  db.audit.push({ id: 1, at: nowIso(), actorId: null, actorName: 'system', action: 'system.seeded', entityType: 'Database', entityId: null, subjectEmployeeId: null, details: null })
  void maria
  return db
}

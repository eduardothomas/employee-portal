/**
 * In-browser implementation of the Employee Portal API, used when the apps are built in demo mode
 * (GitHub Pages has no server). It mirrors the ASP.NET Core endpoints and their rules closely enough
 * to click through every screen. State lives in localStorage, shared by both apps on the same origin.
 */
import { toIsoDate } from '../format'
import { seed, uid, nowIso, type DemoDb, type Emp, type Slip, type Status } from './db'
import { letterPdf, payslipPdf } from './pdf'
import {
  MONTH_NAMES, calculateDecimo, calculateRegular, decimoPeriod, estimateDecimoGross, nextPayDate, panamaHolidays,
  periodFor, round, totals, workingDays,
} from './rules'

const KEY = 'ep.demo.db.v1'

function load(): DemoDb {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DemoDb
  } catch { /* fall through */ }
  const db = seed()
  save(db)
  return db
}

function save(db: DemoDb) {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* quota exceeded — keep in memory */ }
}

/** Wipes demo data (used by the "Reiniciar demo" button). */
export function resetDemo() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

class HttpError extends Error {
  constructor(public status: number, message: string, public errors?: Record<string, string[]>) { super(message) }
}
const bad = (field: string, msg: string) => new HttpError(400, 'Uno o más campos no son válidos.', { [field]: [msg] })
const notFound = (msg = 'Recurso no encontrado.') => new HttpError(404, msg)

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
const noContent = () => new Response(null, { status: 204 })
const today = () => toIsoDate(new Date())

const fullName = (e: Emp) => `${e.firstName} ${e.lastName}`
const displayName = (e: Emp) => e.preferredName || e.firstName
const mask = (s: string | null) => (!s ? null : s.length <= 4 ? s : `•••• ${s.slice(-4)}`)
const maskId = (s: string) => (s.length <= 3 ? s : '•'.repeat(s.length - 3) + s.slice(-3))
const icons: Record<string, string> = { payslip: '💰', vacation: '🏖️', leave: '📝', document: '📄', profile: '👤', announcement: '📣' }
const FIELD_LABELS: Record<string, string> = {
  firstName: 'Nombre', lastName: 'Apellido', jobTitle: 'Cargo', department: 'Departamento', monthlySalary: 'Salario',
  hireDate: 'Fecha de ingreso', manager: 'Supervisor', bankAccount: 'Cuenta bancaria', nationalId: 'Cédula',
}

type Ctx = { db: DemoDb; me: Emp | null; body: any; query: URLSearchParams }
type Handler = (ctx: Ctx, ...params: string[]) => Response | Promise<Response>

export function createDemoFetch(prefix: string): typeof fetch {
  const routes: [string, RegExp, Handler, 'public' | 'auth' | 'manager' | 'hr'][] = []
  const on = (method: string, pattern: string, access: 'public' | 'auth' | 'manager' | 'hr', h: Handler) =>
    routes.push([method, new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$'), h, access])

  // ── helpers bound to db ──
  const emp = (db: DemoDb, id: string) => db.employees.find((e) => e.id === id) ?? null
  const nameOf = (db: DemoDb, id: string | null) => (id ? (emp(db, id) ? fullName(emp(db, id)!) : null) : null)
  const audit = (c: Ctx, action: string, entityType: string, entityId: string | null, subject: string | null, details?: unknown) =>
    c.db.audit.push({ id: (c.db.audit.at(-1)?.id ?? 0) + 1, at: nowIso(), actorId: c.me?.id ?? null, actorName: c.me ? fullName(c.me) : 'anonymous',
      action, entityType, entityId, subjectEmployeeId: subject, details: details === undefined ? null : typeof details === 'string' ? details : JSON.stringify(details) })
  const notify = (db: DemoDb, employeeId: string, type: string, title: string, body: string, link: string | null = null) =>
    db.notifications.push({ id: uid(), employeeId, type, title, body, link, createdAt: nowIso(), readAt: null })

  const slipSummary = (s: Slip) => {
    const t = totals(s.lines)
    return { id: s.id, number: `${s.kind === 'decimo' ? 'DEC' : 'PAY'}-${s.payDate.replace(/-/g, '')}`, kind: s.kind, periodStart: s.periodStart, periodEnd: s.periodEnd, payDate: s.payDate, gross: t.gross, deductions: t.deductions, net: t.net }
  }
  const lineDto = (l: { code: string; description: string; amount: number }) => ({ code: l.code, description: l.description, amount: l.amount })
  const mySlips = (c: Ctx) => c.db.slips.filter((s) => s.employeeId === c.me!.id && s.isPublished)
  const balance = (db: DemoDb, id: string) => {
    const e = emp(db, id)!
    const reqs = db.vacations.filter((v) => v.employeeId === id)
    const used = reqs.filter((v) => v.status === 'approved').reduce((s, v) => s + v.days, 0)
    const pending = reqs.filter((v) => v.status === 'pending').reduce((s, v) => s + v.days, 0)
    return { accrued: e.vacationAccruedDays, used, pending, available: round(e.vacationAccruedDays - used - pending) }
  }
  const vacDto = (db: DemoDb, v: DemoDb['vacations'][number]) => ({ ...v, employeeName: nameOf(db, v.employeeId) ?? '', reviewerName: nameOf(db, v.reviewedById), reviewedById: undefined })
  const leaveDto = (db: DemoDb, l: DemoDb['leaves'][number]) => {
    const t = db.leaveTypes.find((x) => x.id === l.leaveTypeId)
    return { ...l, employeeName: nameOf(db, l.employeeId) ?? '', leaveTypeName: t?.name ?? '', leaveTypeIcon: t?.icon ?? '📝', reviewerName: nameOf(db, l.reviewedById), reviewedById: undefined }
  }
  const changeDto = (db: DemoDb, ch: DemoDb['changes'][number]) => ({ ...ch, employeeName: nameOf(db, ch.employeeId) ?? '', reviewerName: nameOf(db, ch.reviewedById), reviewedById: undefined })
  const estimateNet = (db: DemoDb, e: Emp) =>
    totals(calculateRegular(e.monthlySalary, 0, 0, db.deductions.filter((d) => d.employeeId === e.id && d.isActive).map((d) => ({ code: d.code, description: d.description, amount: d.amountPerPeriod })))).net
  const userSummary = (e: Emp) => ({ id: e.id, employeeCode: e.employeeCode, displayName: displayName(e), fullName: fullName(e), jobTitle: e.jobTitle, role: e.role, photoUrl: e.photoUrl })
  const tokens = (e: Emp) => ({ accessToken: `demo.${e.id}`, accessTokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(), refreshToken: `demo-refresh.${e.id}`, user: userSummary(e) })
  const scope = (c: Ctx) => c.db.employees.filter((e) => c.me!.role === 'hrAdmin' || e.managerId === c.me!.id).map((e) => e.id)
  const nextNumber = (existing: string[], prefix: string, year: string) => {
    const head = `${prefix}-${year}-`
    const max = Math.max(100, ...existing.filter((n) => n.startsWith(head)).map((n) => Number(n.slice(head.length)) || 0))
    return `${head}${String(max + 1).padStart(5, '0')}`
  }
  const me = (c: Ctx) => {
    const e = c.me!
    return {
      id: e.id, displayName: displayName(e), fullName: fullName(e), role: e.role, photoUrl: e.photoUrl,
      personal: { firstName: e.firstName, lastName: e.lastName, preferredName: e.preferredName, nationalIdMasked: maskId(e.nationalId), birthDate: e.birthDate,
        personalEmail: e.personalEmail, phone: e.phone, address: e.address, emergencyContactName: e.emergencyContactName,
        emergencyContactPhone: e.emergencyContactPhone, emergencyContactRelationship: e.emergencyContactRelationship, photoUrl: e.photoUrl },
      employment: { employeeCode: e.employeeCode, jobTitle: e.jobTitle, department: e.department, hireDate: e.hireDate, employmentType: e.employmentType,
        managerName: nameOf(c.db, e.managerId), monthlySalary: e.monthlySalary, workEmail: e.workEmail },
      bank: { bankName: e.bankName, accountType: e.bankAccountType, maskedAccount: mask(e.bankAccountNumber) },
      biometricEnabled: e.biometricEnabled, unreadNotifications: c.db.notifications.filter((n) => n.employeeId === e.id && !n.readAt).length,
    }
  }
  const pendingApprovals = (c: Ctx) => {
    if (c.me!.role === 'employee') return 0
    const s = scope(c)
    return c.db.vacations.filter((v) => v.status === 'pending' && v.employeeId !== c.me!.id && s.includes(v.employeeId)).length
      + c.db.leaves.filter((l) => l.status === 'pending' && l.employeeId !== c.me!.id && s.includes(l.employeeId)).length
  }
  const decide = (c: Ctx, r: { employeeId: string; status: Status; reviewedById: string | null; reviewedAt: string | null; reviewComment: string | null }, approve: boolean, requireScope = true) => {
    if (r.status !== 'pending') throw new HttpError(400, 'La solicitud ya fue procesada.')
    if (r.employeeId === c.me!.id) throw new HttpError(403, 'No puedes aprobar tus propias solicitudes.')
    if (requireScope && c.me!.role !== 'hrAdmin' && emp(c.db, r.employeeId)?.managerId !== c.me!.id) throw new HttpError(403, 'Solo puedes gestionar solicitudes de tu equipo.')
    r.status = approve ? 'approved' : 'rejected'
    r.reviewedById = c.me!.id
    r.reviewedAt = nowIso()
    r.reviewComment = c.body?.comment || null
  }
  const payslipPdfBlob = (c: Ctx, s: Slip) => {
    const e = emp(c.db, s.employeeId)!
    const t = totals(s.lines)
    const d = new Date(s.payDate + 'T00:00')
    return payslipPdf({
      number: slipSummary(s).number, kind: s.kind, id: s.id, employeeName: fullName(e), employeeCode: e.employeeCode, jobTitle: e.jobTitle,
      payDateLong: `${d.getDate()} de ${MONTH_NAMES[d.getMonth()].toLowerCase()} ${d.getFullYear()}`,
      period: `${s.periodStart.split('-').reverse().join('/')} - ${s.periodEnd.split('-').reverse().join('/')}`,
      earnings: s.lines.filter((l) => l.type === 'earning'), deductions: s.lines.filter((l) => l.type === 'deduction'),
      gross: t.gross, totalDeductions: t.deductions, net: t.net,
    })
  }
  const holidaysFor = (y: number) => [...panamaHolidays(y), ...panamaHolidays(y + 1)]
  const vacationError = (c: Ctx, start: string, end: string, available: number) => {
    if (!start || !end) return 'Selecciona las fechas.'
    if (end < start) return 'La fecha final debe ser posterior a la inicial.'
    if (start < today()) return 'No puedes solicitar vacaciones en fechas pasadas.'
    const days = workingDays(start, end)
    if (days === 0) return 'El rango seleccionado no incluye días laborables.'
    if (days > available) return `Solo tienes ${available} días disponibles.`
    const overlap = c.db.vacations.some((v) => v.employeeId === c.me!.id && (v.status === 'pending' || v.status === 'approved') && v.startDate <= end && v.endDate >= start)
    return overlap ? 'Ya tienes vacaciones solicitadas en esas fechas.' : null
  }

  // ── Auth ──
  on('POST', '/auth/login', 'public', (c) => {
    const login = String(c.body?.login ?? '').trim().toLowerCase()
    const e = c.db.employees.find((x) => x.workEmail === login || x.employeeCode.toLowerCase() === login)
    if (!e || !e.isActive || e.password !== c.body?.password) throw new HttpError(401, 'Usuario o contraseña incorrectos.')
    const challengeId = uid()
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
    c.db.mfa[challengeId] = { employeeId: e.id, code }
    return json({ challengeId, maskedDestination: e.phone ? `•••• ${e.phone.slice(-4)}` : 'tu teléfono', expiresAt: new Date(Date.now() + 300_000).toISOString(), devCode: code })
  })
  on('POST', '/auth/mfa/verify', 'public', (c) => {
    const ch = c.db.mfa[c.body?.challengeId]
    if (!ch) throw new HttpError(401, 'El código expiró. Inicia sesión nuevamente.')
    if (ch.code !== String(c.body?.code ?? '').trim()) throw new HttpError(401, 'Código incorrecto.')
    delete c.db.mfa[c.body.challengeId]
    const e = emp(c.db, ch.employeeId)!
    c.me = e
    audit(c, 'auth.login', 'Employee', e.id, e.id, 'demo')
    return json(tokens(e))
  })
  on('POST', '/auth/refresh', 'public', (c) => {
    const id = String(c.body?.refreshToken ?? '').replace('demo-refresh.', '')
    const e = emp(c.db, id)
    if (!e) throw new HttpError(401, 'Sesión inválida.')
    return json(tokens(e))
  })
  on('POST', '/auth/logout', 'public', () => noContent())
  on('POST', '/auth/forgot-password', 'public', () => new Response(null, { status: 202 }))
  on('POST', '/auth/change-password', 'auth', (c) => {
    if (c.body?.currentPassword !== c.me!.password) throw bad('currentPassword', 'La contraseña actual no es correcta.')
    const p = String(c.body?.newPassword ?? '')
    if (p.length < 8 || !/\d/.test(p) || !/[a-z]/i.test(p)) throw bad('newPassword', 'Mínimo 8 caracteres, con letras y números.')
    c.me!.password = p
    audit(c, 'auth.password_changed', 'Employee', c.me!.id, c.me!.id)
    return noContent()
  })

  // ── Me ──
  on('GET', '/me', 'auth', (c) => json(me(c)))
  on('GET', '/me/dashboard', 'auth', (c) => {
    const e = c.me!
    const recent = c.db.notifications.filter((n) => n.employeeId === e.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
    return json({
      displayName: displayName(e), nextPay: { date: nextPayDate(today()), estimatedNet: estimateNet(c.db, e) }, vacation: balance(c.db, e.id),
      pendingRequests: c.db.vacations.filter((v) => v.employeeId === e.id && v.status === 'pending').length + c.db.leaves.filter((l) => l.employeeId === e.id && l.status === 'pending').length,
      unreadNotifications: c.db.notifications.filter((n) => n.employeeId === e.id && !n.readAt).length, isManager: e.role !== 'employee', pendingApprovals: pendingApprovals(c),
      recentActivity: recent.map((n) => ({ type: n.type, icon: icons[n.type] ?? '🔔', title: n.title, subtitle: n.body, date: n.createdAt, link: n.link })),
    })
  })
  on('PATCH', '/me/profile', 'auth', (c) => {
    const fields = ['preferredName', 'personalEmail', 'phone', 'address', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship', 'photoUrl'] as const
    if (c.body?.personalEmail && !String(c.body.personalEmail).includes('@')) throw bad('personalEmail', 'Email inválido.')
    const changed: string[] = []
    for (const f of fields) {
      const v = c.body?.[f]
      if (v === undefined || v === null) continue
      const norm = String(v).trim() || null
      if (norm !== c.me![f]) { (c.me as any)[f] = norm; changed.push(f) }
    }
    if (changed.length) audit(c, 'profile.updated', 'Employee', c.me!.id, c.me!.id, { fields: changed })
    return json(me(c))
  })
  on('PUT', '/me/security', 'auth', (c) => { c.me!.biometricEnabled = !!c.body?.biometricEnabled; return noContent() })
  on('GET', '/me/change-requests', 'auth', (c) => json(c.db.changes.filter((x) => x.employeeId === c.me!.id).map((x) => changeDto(c.db, x)).reverse()))
  on('POST', '/me/change-requests', 'auth', (c) => {
    const field = c.body?.field
    if (!FIELD_LABELS[field]) throw bad('field', 'Campo no válido para solicitud de cambio.')
    if (!String(c.body?.requestedValue ?? '').trim()) throw bad('requestedValue', 'Este campo es obligatorio.')
    if (c.db.changes.some((x) => x.employeeId === c.me!.id && x.field === field && x.status === 'pending')) throw bad('field', 'Ya tienes una solicitud pendiente para este campo.')
    const e = c.me!
    const current: Record<string, string | null> = { firstName: e.firstName, lastName: e.lastName, jobTitle: e.jobTitle, department: e.department,
      monthlySalary: e.monthlySalary.toFixed(2), hireDate: e.hireDate, manager: nameOf(c.db, e.managerId), bankAccount: mask(e.bankAccountNumber), nationalId: maskId(e.nationalId) }
    const ch = { id: uid(), employeeId: e.id, field, currentValue: current[field], requestedValue: String(c.body.requestedValue).trim(), reason: c.body?.reason || null,
      status: 'pending' as Status, createdAt: nowIso(), reviewedById: null, reviewedAt: null, reviewComment: null }
    c.db.changes.push(ch)
    audit(c, 'profile.change_requested', 'ChangeRequest', ch.id, e.id, { field })
    return json(changeDto(c.db, ch))
  })

  // ── Payroll ──
  on('GET', '/me/payroll', 'auth', (c) => {
    const slips = mySlips(c).filter((s) => s.kind === 'regular').sort((a, b) => b.payDate.localeCompare(a.payDate))
    const byMonth = new Map<string, Slip[]>()
    for (const s of slips) byMonth.set(s.payDate.slice(0, 7), [...(byMonth.get(s.payDate.slice(0, 7)) ?? []), s])
    const history = [...byMonth].slice(0, 12).map(([k, list]) => {
      const t = list.map((s) => totals(s.lines)).reduce((a, b) => ({ gross: a.gross + b.gross, deductions: a.deductions + b.deductions, net: a.net + b.net }))
      return { year: Number(k.slice(0, 4)), month: Number(k.slice(5)), gross: round(t.gross), deductions: round(t.deductions), net: round(t.net) }
    })
    return json({ monthlySalary: c.me!.monthlySalary, nextPayDate: nextPayDate(today()), nextPayEstimatedNet: estimateNet(c.db, c.me!), latestPayslip: slips[0] ? slipSummary(slips[0]) : null, history })
  })
  on('GET', '/me/payroll/months/:y/:m', 'auth', (c, y, m) => {
    const key = `${y}-${m.padStart(2, '0')}`
    const slips = mySlips(c).filter((s) => s.kind === 'regular' && s.payDate.startsWith(key)).sort((a, b) => a.payDate.localeCompare(b.payDate))
    if (!slips.length) throw notFound('No hay pagos para ese mes.')
    const agg = (type: 'earning' | 'deduction') => {
      const map = new Map<string, { code: string; description: string; amount: number }>()
      for (const l of slips.flatMap((s) => s.lines).filter((l) => l.type === type)) {
        const cur = map.get(l.code) ?? { code: l.code, description: l.description, amount: 0 }
        cur.amount = round(cur.amount + l.amount)
        map.set(l.code, cur)
      }
      return [...map.values()]
    }
    const earnings = agg('earning'), deductionLines = agg('deduction')
    const gross = round(earnings.reduce((s, l) => s + l.amount, 0)), deductions = round(deductionLines.reduce((s, l) => s + l.amount, 0))
    return json({ year: Number(y), month: Number(m), earnings, deductionLines, gross, deductions, net: round(gross - deductions), payslips: slips.map(slipSummary) })
  })
  on('GET', '/me/payslips', 'auth', (c) => {
    const y = c.query.get('year')
    return json(mySlips(c).filter((s) => !y || s.payDate.startsWith(y)).sort((a, b) => b.payDate.localeCompare(a.payDate)).map(slipSummary))
  })
  on('GET', '/me/payslips/:id', 'auth', (c, id) => {
    const s = mySlips(c).find((x) => x.id === id)
    if (!s) throw notFound('Comprobante no encontrado.')
    audit(c, 'payslip.viewed', 'Payslip', s.id, c.me!.id)
    return json({ summary: slipSummary(s), earnings: s.lines.filter((l) => l.type === 'earning').map(lineDto), deductionLines: s.lines.filter((l) => l.type === 'deduction').map(lineDto),
      employeeName: fullName(c.me!), employeeCode: c.me!.employeeCode, jobTitle: c.me!.jobTitle })
  })
  on('GET', '/me/payslips/:id/pdf', 'auth', (c, id) => {
    const s = mySlips(c).find((x) => x.id === id)
    if (!s) throw notFound('Comprobante no encontrado.')
    audit(c, 'payslip.downloaded', 'Payslip', s.id, c.me!.id)
    return new Response(payslipPdfBlob(c, s), { headers: { 'content-type': 'application/pdf' } })
  })
  on('GET', '/me/deductions', 'auth', (c) => {
    const slips = mySlips(c).filter((s) => s.kind === 'regular').sort((a, b) => b.payDate.localeCompare(a.payDate))
    const y = Number(c.query.get('year') ?? slips[0]?.payDate.slice(0, 4) ?? today().slice(0, 4))
    const m = Number(c.query.get('month') ?? slips[0]?.payDate.slice(5, 7) ?? today().slice(5, 7))
    const sum = (list: Slip[]) => {
      const map = new Map<string, { code: string; description: string; amount: number }>()
      for (const l of list.flatMap((s) => s.lines).filter((l) => l.type === 'deduction')) {
        const cur = map.get(l.code) ?? { code: l.code, description: l.description, amount: 0 }
        cur.amount = round(cur.amount + l.amount)
        map.set(l.code, cur)
      }
      return [...map.values()]
    }
    const ym = (s: Slip) => [Number(s.payDate.slice(0, 4)), Number(s.payDate.slice(5, 7))]
    const items = sum(slips.filter((s) => ym(s)[0] === y && ym(s)[1] === m))
    const ytd = sum(slips.filter((s) => ym(s)[0] === y && ym(s)[1] <= m))
    const months = [...new Set(slips.map((s) => s.payDate.slice(0, 7)))].slice(0, 12)
    const history = months.map((k) => {
      const list = sum(slips.filter((s) => s.payDate.startsWith(k)))
      return { year: Number(k.slice(0, 4)), month: Number(k.slice(5)), total: round(list.reduce((s, i) => s + i.amount, 0)), byCode: Object.fromEntries(list.map((i) => [i.code, i.amount])) }
    })
    return json({ year: y, month: m, items, total: round(items.reduce((s, i) => s + i.amount, 0)), yearToDate: ytd, history })
  })
  on('GET', '/me/decimo', 'auth', (c) => {
    const p = decimoPeriod(today())
    const gross = estimateDecimoGross(c.me!.monthlySalary, p, c.me!.hireDate)
    return json({ nextPayDate: p.payDate, periodStart: p.start, periodEnd: p.end, estimatedGross: gross, estimatedNet: round(gross - round(gross * 0.0725)),
      history: mySlips(c).filter((s) => s.kind === 'decimo').sort((a, b) => b.payDate.localeCompare(a.payDate)).map(slipSummary) })
  })

  // ── Time off ──
  on('GET', '/me/vacations', 'auth', (c) => {
    const reqs = c.db.vacations.filter((v) => v.employeeId === c.me!.id).sort((a, b) => b.startDate.localeCompare(a.startDate))
    const upcoming = [...reqs].filter((v) => v.endDate >= today() && (v.status === 'approved' || v.status === 'pending')).sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    return json({ balance: balance(c.db, c.me!.id), upcoming: upcoming ? vacDto(c.db, upcoming) : null, requests: reqs.map((v) => vacDto(c.db, v)), holidays: holidaysFor(Number(today().slice(0, 4))) })
  })
  on('GET', '/me/vacations/preview', 'auth', (c) => {
    const from = c.query.get('from') ?? '', to = c.query.get('to') ?? ''
    const b = balance(c.db, c.me!.id)
    const error = vacationError(c, from, to, b.available)
    const days = from && to ? workingDays(from, to) : 0
    const hol = from && to ? holidaysFor(Number(from.slice(0, 4))).filter((h) => h.date >= from && h.date <= to) : []
    return json({ startDate: from, endDate: to, days, available: b.available, remainingAfter: b.available - days, holidaysInRange: hol, isValid: !error, error })
  })
  on('POST', '/me/vacations', 'auth', (c) => {
    const { startDate, endDate, comment } = c.body ?? {}
    const err = vacationError(c, startDate, endDate, balance(c.db, c.me!.id).available)
    if (err) throw bad('startDate', err)
    const v = { id: uid(), employeeId: c.me!.id, number: nextNumber(c.db.vacations.map((x) => x.number), 'VAC', startDate.slice(0, 4)), startDate, endDate,
      days: workingDays(startDate, endDate), comment: comment || null, status: 'pending' as Status, createdAt: nowIso(), reviewedById: null, reviewedAt: null, reviewComment: null }
    c.db.vacations.push(v)
    audit(c, 'vacation.requested', 'VacationRequest', v.id, c.me!.id, { number: v.number, days: v.days })
    if (c.me!.managerId) notify(c.db, c.me!.managerId, 'general', 'Nueva solicitud de vacaciones', `${fullName(c.me!)} solicitó ${v.days} días.`, '/approvals')
    return json(vacDto(c.db, v), 201)
  })
  on('POST', '/me/vacations/:id/cancel', 'auth', (c, id) => {
    const v = c.db.vacations.find((x) => x.id === id && x.employeeId === c.me!.id)
    if (!v) throw notFound()
    if (v.status !== 'pending') throw new HttpError(400, 'Solo se pueden cancelar solicitudes pendientes.')
    v.status = 'cancelled'
    audit(c, 'vacation.cancelled', 'VacationRequest', v.id, c.me!.id)
    return noContent()
  })
  on('GET', '/leave-types', 'auth', (c) => json(c.db.leaveTypes.filter((t) => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder)))
  on('GET', '/me/leave-requests', 'auth', (c) =>
    json(c.db.leaves.filter((l) => l.employeeId === c.me!.id).sort((a, b) => b.startDate.localeCompare(a.startDate)).map((l) => leaveDto(c.db, l))))
  on('POST', '/me/leave-requests', 'auth', (c) => {
    const { leaveTypeId, startDate, endDate, hours, reason } = c.body ?? {}
    const type = c.db.leaveTypes.find((t) => t.id === leaveTypeId && t.isActive)
    if (!type) throw bad('leaveTypeId', 'Selecciona un tipo de permiso válido.')
    if (endDate < startDate) throw bad('endDate', 'La fecha final debe ser posterior a la inicial.')
    if (!String(reason ?? '').trim()) throw bad('reason', 'Describe brevemente el motivo.')
    if (type.maxDaysPerYear) {
      const used = c.db.leaves.filter((l) => l.employeeId === c.me!.id && l.leaveTypeId === type.id && l.status !== 'rejected' && l.status !== 'cancelled' && l.startDate.startsWith(startDate.slice(0, 4)))
        .reduce((s, l) => s + workingDays(l.startDate, l.endDate), 0)
      if (used + workingDays(startDate, endDate) > type.maxDaysPerYear) throw bad('endDate', `Este tipo de permiso permite ${type.maxDaysPerYear} días por año (ya usaste ${used}).`)
    }
    const l = { id: uid(), employeeId: c.me!.id, number: nextNumber(c.db.leaves.map((x) => x.number), 'PER', startDate.slice(0, 4)), leaveTypeId, startDate, endDate,
      hours: hours ?? null, reason: String(reason).trim(), status: 'pending' as Status, createdAt: nowIso(), reviewedById: null, reviewedAt: null, reviewComment: null }
    c.db.leaves.push(l)
    audit(c, 'leave.requested', 'LeaveRequest', l.id, c.me!.id, { number: l.number })
    if (c.me!.managerId) notify(c.db, c.me!.managerId, 'general', 'Nueva solicitud de permiso', `${fullName(c.me!)} solicitó un permiso (${type.name}).`, '/approvals')
    return json(leaveDto(c.db, l), 201)
  })
  on('POST', '/me/leave-requests/:id/cancel', 'auth', (c, id) => {
    const l = c.db.leaves.find((x) => x.id === id && x.employeeId === c.me!.id)
    if (!l) throw notFound()
    if (l.status !== 'pending') throw new HttpError(400, 'Solo se pueden cancelar solicitudes pendientes.')
    l.status = 'cancelled'
    return noContent()
  })

  // ── Documents & notifications ──
  const docDto = (db: DemoDb, d: DemoDb['documents'][number], admin = false) => ({
    id: d.id, category: d.category, title: d.title, fileName: d.fileName, contentType: d.contentType, sizeBytes: d.sizeBytes, uploadedAt: d.uploadedAt,
    source: 'document', downloadUrl: admin ? `/admin/documents/${d.id}` : `/me/documents/${d.id}`, employeeId: d.employeeId, employeeName: nameOf(db, d.employeeId),
  })
  const docBlob = (d: DemoDb['documents'][number]) => {
    if (d.letter) return letterPdf(d.letter.title, d.letter.paragraphs)
    const bin = atob(d.dataBase64 ?? '')
    return new Blob([Uint8Array.from(bin, (ch) => ch.charCodeAt(0))], { type: d.contentType })
  }
  on('GET', '/me/documents', 'auth', (c) => {
    const docs = c.db.documents.filter((d) => d.employeeId === c.me!.id || d.employeeId === null).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).map((d) => docDto(c.db, d))
    const slips = mySlips(c).sort((a, b) => b.payDate.localeCompare(a.payDate)).slice(0, 24).map((s) => {
      const d = new Date(s.payDate + 'T00:00')
      return { id: s.id, category: 'payroll', title: s.kind === 'decimo' ? `Décimo ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` : `Comprobante ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
        fileName: `comprobante-${s.payDate}.pdf`, contentType: 'application/pdf', sizeBytes: 0, uploadedAt: `${s.payDate}T12:00:00Z`, source: 'payslip',
        downloadUrl: `/me/payslips/${s.id}/pdf`, employeeId: c.me!.id, employeeName: null }
    })
    return json([...docs, ...slips])
  })
  const download = (c: Ctx, id: string) => {
    const d = c.db.documents.find((x) => x.id === id)
    if (!d || (d.employeeId && d.employeeId !== c.me!.id && c.me!.role !== 'hrAdmin')) throw notFound()
    audit(c, 'document.downloaded', 'Document', d.id, d.employeeId, { title: d.title })
    return new Response(docBlob(d), { headers: { 'content-type': d.contentType } })
  }
  on('GET', '/me/documents/:id', 'auth', (c, id) => download(c, id))
  on('GET', '/notifications', 'auth', (c) =>
    json(c.db.notifications.filter((n) => n.employeeId === c.me!.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100)))
  on('POST', '/notifications/:id/read', 'auth', (c, id) => {
    const n = c.db.notifications.find((x) => x.id === id && x.employeeId === c.me!.id)
    if (n && !n.readAt) n.readAt = nowIso()
    return noContent()
  })
  on('POST', '/notifications/read-all', 'auth', (c) => {
    for (const n of c.db.notifications) if (n.employeeId === c.me!.id && !n.readAt) n.readAt = nowIso()
    return noContent()
  })
  on('POST', '/devices', 'auth', () => noContent())

  // ── Manager ──
  on('GET', '/manager/team', 'manager', (c) => {
    const t = today()
    return json(c.db.employees.filter((e) => e.managerId === c.me!.id && e.isActive).sort((a, b) => a.firstName.localeCompare(b.firstName)).map((e) => {
      const onVac = c.db.vacations.some((v) => v.employeeId === e.id && v.status === 'approved' && v.startDate <= t && v.endDate >= t)
      const onLeave = c.db.leaves.find((l) => l.employeeId === e.id && l.status === 'approved' && l.startDate <= t && l.endDate >= t)
      return { id: e.id, employeeCode: e.employeeCode, fullName: fullName(e), jobTitle: e.jobTitle, department: e.department, photoUrl: e.photoUrl,
        vacationAvailable: balance(c.db, e.id).available, awayToday: onVac ? 'Vacaciones' : onLeave ? leaveDto(c.db, onLeave).leaveTypeName : null,
        pendingRequests: c.db.vacations.filter((v) => v.employeeId === e.id && v.status === 'pending').length + c.db.leaves.filter((l) => l.employeeId === e.id && l.status === 'pending').length }
    }))
  })
  on('GET', '/manager/approvals', 'manager', (c) => {
    const s = scope(c)
    return json({
      vacations: c.db.vacations.filter((v) => v.status === 'pending' && v.employeeId !== c.me!.id && s.includes(v.employeeId)).sort((a, b) => a.startDate.localeCompare(b.startDate)).map((v) => vacDto(c.db, v)),
      leaves: c.db.leaves.filter((l) => l.status === 'pending' && l.employeeId !== c.me!.id && s.includes(l.employeeId)).sort((a, b) => a.startDate.localeCompare(b.startDate)).map((l) => leaveDto(c.db, l)),
    })
  })
  on('GET', '/manager/vacations', 'manager', (c) => {
    const s = scope(c), st = c.query.get('status')
    return json(c.db.vacations.filter((v) => s.includes(v.employeeId) && (!st || v.status === st)).sort((a, b) => b.startDate.localeCompare(a.startDate)).map((v) => vacDto(c.db, v)))
  })
  on('GET', '/manager/leave-requests', 'manager', (c) => {
    const s = scope(c), st = c.query.get('status')
    return json(c.db.leaves.filter((l) => s.includes(l.employeeId) && (!st || l.status === st)).sort((a, b) => b.startDate.localeCompare(a.startDate)).map((l) => leaveDto(c.db, l)))
  })
  on('POST', '/manager/vacations/:id/:action', 'manager', (c, id, action) => {
    const v = c.db.vacations.find((x) => x.id === id)
    if (!v) throw notFound()
    const approve = action === 'approve'
    decide(c, v, approve)
    audit(c, approve ? 'vacation.approved' : 'vacation.rejected', 'VacationRequest', v.id, v.employeeId, { number: v.number, comment: v.reviewComment })
    notify(c.db, v.employeeId, 'vacation', approve ? 'Vacaciones aprobadas' : 'Vacaciones rechazadas', `Tu solicitud ${v.number} fue ${approve ? 'aprobada' : 'rechazada'}.${v.reviewComment ? ` Comentario: ${v.reviewComment}` : ''}`, '/time/vacations')
    return noContent()
  })
  on('POST', '/manager/leave-requests/:id/:action', 'manager', (c, id, action) => {
    const l = c.db.leaves.find((x) => x.id === id)
    if (!l) throw notFound()
    const approve = action === 'approve'
    decide(c, l, approve)
    audit(c, approve ? 'leave.approved' : 'leave.rejected', 'LeaveRequest', l.id, l.employeeId, { number: l.number })
    notify(c.db, l.employeeId, 'leave', approve ? 'Permiso aprobado' : 'Permiso rechazado', `Tu permiso ${leaveDto(c.db, l).leaveTypeName} fue ${approve ? 'aprobado' : 'rechazado'}.`, '/time/leave')
    return noContent()
  })

  // ── HR / Admin ──
  const empListItem = (db: DemoDb, e: Emp) => ({ id: e.id, employeeCode: e.employeeCode, fullName: fullName(e), workEmail: e.workEmail, jobTitle: e.jobTitle,
    department: e.department, role: e.role, managerName: nameOf(db, e.managerId), isActive: e.isActive, hireDate: e.hireDate, monthlySalary: e.monthlySalary })
  const empDetail = (db: DemoDb, e: Emp) => {
    const { password: _p, biometricEnabled: _b, photoUrl: _ph, ...rest } = e
    return { ...rest, managerName: nameOf(db, e.managerId), vacationBalance: balance(db, e.id), recurringDeductions: db.deductions.filter((d) => d.employeeId === e.id) }
  }
  const runDto = (db: DemoDb, r: DemoDb['runs'][number]) => {
    const t = db.slips.filter((s) => s.runId === r.id).map((s) => totals(s.lines))
    return { ...r, employeeCount: t.length, totalGross: round(t.reduce((s, x) => s + x.gross, 0)), totalDeductions: round(t.reduce((s, x) => s + x.deductions, 0)), totalNet: round(t.reduce((s, x) => s + x.net, 0)) }
  }
  const runDetail = (db: DemoDb, id: string) => {
    const r = db.runs.find((x) => x.id === id)
    if (!r) throw notFound('Planilla no encontrada.')
    return { run: runDto(db, r), payslips: db.slips.filter((s) => s.runId === id).map((s) => {
      const e = emp(db, s.employeeId)!
      const t = totals(s.lines)
      return { payslipId: s.id, employeeId: e.id, employeeName: fullName(e), department: e.department, gross: t.gross, deductions: t.deductions, net: t.net }
    }).sort((a, b) => a.employeeName.localeCompare(b.employeeName)) }
  }
  const auditDto = (db: DemoDb, a: DemoDb['audit'][number]) => ({ id: a.id, at: a.at, actorName: a.actorName, action: a.action, entityType: a.entityType, entityId: a.entityId,
    subjectEmployeeName: nameOf(db, a.subjectEmployeeId), details: a.details, ipAddress: 'demo' })

  on('GET', '/admin/dashboard', 'hr', (c) => {
    const t = today()
    const active = c.db.employees.filter((e) => e.isActive)
    const away = new Set([...c.db.vacations.filter((v) => v.status === 'approved' && v.startDate <= t && v.endDate >= t).map((v) => v.employeeId),
      ...c.db.leaves.filter((l) => l.status === 'approved' && l.startDate <= t && l.endDate >= t).map((l) => l.employeeId)])
    const lastRun = c.db.runs.filter((r) => r.status === 'published' && r.kind === 'regular').sort((a, b) => b.payDate.localeCompare(a.payDate))[0]
    const depts = new Map<string, number>()
    for (const e of active) depts.set(e.department, (depts.get(e.department) ?? 0) + 1)
    return json({
      activeEmployees: active.length, pendingVacations: c.db.vacations.filter((v) => v.status === 'pending').length, pendingLeaves: c.db.leaves.filter((l) => l.status === 'pending').length,
      pendingChangeRequests: c.db.changes.filter((x) => x.status === 'pending').length, awayToday: away.size, nextPayDate: nextPayDate(t),
      lastPayrollNet: lastRun ? runDto(c.db, lastRun).totalNet : 0, monthlyPayrollCost: active.reduce((s, e) => s + e.monthlySalary, 0),
      headcountByDepartment: [...depts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
      upcomingVacations: c.db.vacations.filter((v) => v.status === 'approved' && v.endDate >= t).sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 6).map((v) => vacDto(c.db, v)),
      recentAudit: [...c.db.audit].reverse().slice(0, 8).map((a) => auditDto(c.db, a)),
    })
  })
  on('GET', '/admin/employees', 'hr', (c) => {
    const s = (c.query.get('search') ?? '').toLowerCase(), dept = c.query.get('department'), active = c.query.get('active')
    const items = c.db.employees.filter((e) => (!s || `${fullName(e)} ${e.employeeCode} ${e.workEmail} ${e.jobTitle}`.toLowerCase().includes(s))
      && (!dept || e.department === dept) && (!active || String(e.isActive) === active)).sort((a, b) => fullName(a).localeCompare(fullName(b)))
    return json({ items: items.map((e) => empListItem(c.db, e)), total: items.length, page: 1, pageSize: 200 })
  })
  on('GET', '/admin/departments', 'hr', (c) => json([...new Set(c.db.employees.map((e) => e.department))].sort()))
  on('GET', '/admin/employees/:id', 'hr', (c, id) => {
    const e = emp(c.db, id)
    if (!e) throw notFound('Empleado no encontrado.')
    return json(empDetail(c.db, e))
  })
  const saveEmployee = (c: Ctx, e: Emp | null) => {
    const b = c.body ?? {}
    for (const f of ['employeeCode', 'firstName', 'lastName', 'nationalId', 'workEmail', 'jobTitle', 'department'])
      if (!String(b[f] ?? '').trim()) throw bad(f, 'Este campo es obligatorio.')
    if (c.db.employees.some((x) => x.id !== e?.id && x.employeeCode === b.employeeCode)) throw bad('employeeCode', 'Código ya existe.')
    if (c.db.employees.some((x) => x.id !== e?.id && x.workEmail === String(b.workEmail).toLowerCase())) throw bad('workEmail', 'Email ya registrado.')
    if (!e) {
      const p = String(b.initialPassword ?? '')
      if (p.length < 8 || !/\d/.test(p)) throw bad('newPassword', 'Mínimo 8 caracteres, con letras y números.')
    }
    const target: Emp = e ?? ({ id: uid(), biometricEnabled: false, photoUrl: null, emergencyContactName: null, emergencyContactPhone: null, emergencyContactRelationship: null } as Emp)
    const oldSalary = e?.monthlySalary
    Object.assign(target, {
      employeeCode: b.employeeCode.trim(), firstName: b.firstName.trim(), lastName: b.lastName.trim(), preferredName: b.preferredName || null, nationalId: b.nationalId,
      birthDate: b.birthDate || null, workEmail: String(b.workEmail).toLowerCase(), personalEmail: b.personalEmail || null, phone: b.phone || null, address: b.address || null,
      jobTitle: b.jobTitle, department: b.department, hireDate: b.hireDate, employmentType: b.employmentType, managerId: b.managerId || null,
      monthlySalary: round(Number(b.monthlySalary)), isActive: !!b.isActive, bankName: b.bankName || null, bankAccountType: b.bankAccountType || null,
      bankAccountNumber: b.bankAccountNumber || null, role: b.role, vacationAccruedDays: Number(b.vacationAccruedDays),
    })
    if (b.initialPassword) target.password = b.initialPassword
    if (!e) { c.db.employees.push(target); audit(c, 'employee.created', 'Employee', target.id, target.id, { code: target.employeeCode }) }
    else {
      if (oldSalary !== target.monthlySalary) audit(c, 'employee.salary_changed', 'Employee', target.id, target.id, { from: oldSalary?.toFixed(2), to: target.monthlySalary.toFixed(2) })
      audit(c, 'employee.updated', 'Employee', target.id, target.id)
    }
    return json(empDetail(c.db, target), e ? 200 : 201)
  }
  on('POST', '/admin/employees', 'hr', (c) => saveEmployee(c, null))
  on('PUT', '/admin/employees/:id', 'hr', (c, id) => {
    const e = emp(c.db, id)
    if (!e) throw notFound()
    return saveEmployee(c, e)
  })
  on('POST', '/admin/employees/:id/deductions', 'hr', (c, id) => {
    if (!c.body?.code || !(c.body.amountPerPeriod > 0)) throw bad('amountPerPeriod', 'Completa código y un monto mayor a cero.')
    const d = { id: uid(), employeeId: id, code: String(c.body.code).toUpperCase(), description: c.body.description, amountPerPeriod: Number(c.body.amountPerPeriod), isActive: !!c.body.isActive }
    c.db.deductions.push(d)
    audit(c, 'deduction.created', 'RecurringDeduction', d.id, id, c.body)
    return json(d)
  })
  on('PUT', '/admin/employees/:id/deductions/:did', 'hr', (c, id, did) => {
    const d = c.db.deductions.find((x) => x.id === did && x.employeeId === id)
    if (!d) throw notFound()
    Object.assign(d, { code: String(c.body.code).toUpperCase(), description: c.body.description, amountPerPeriod: Number(c.body.amountPerPeriod), isActive: !!c.body.isActive })
    audit(c, 'deduction.updated', 'RecurringDeduction', d.id, id, c.body)
    return json(d)
  })
  on('POST', '/admin/vacations/accrue', 'hr', (c) => {
    const active = c.db.employees.filter((e) => e.isActive)
    for (const e of active) e.vacationAccruedDays = round(e.vacationAccruedDays + 2.73)
    audit(c, 'vacation.monthly_accrual', 'Vacation', null, null, { employees: active.length })
    return json({ employees: active.length })
  })
  on('GET', '/admin/leave-types', 'hr', (c) => json([...c.db.leaveTypes].sort((a, b) => a.sortOrder - b.sortOrder)))
  const saveType = (c: Ctx, id: string | null) => {
    const b = c.body ?? {}
    if (!String(b.code ?? '').trim() || !String(b.name ?? '').trim()) throw bad('name', 'Nombre y código son obligatorios.')
    const code = String(b.code).trim().toLowerCase()
    if (c.db.leaveTypes.some((t) => t.code === code && t.id !== id)) throw bad('code', 'Ya existe un tipo con ese código.')
    let t = id ? c.db.leaveTypes.find((x) => x.id === id) : undefined
    if (id && !t) throw notFound()
    if (!t) { t = { id: uid() } as DemoDb['leaveTypes'][number]; c.db.leaveTypes.push(t) }
    Object.assign(t, { code, name: b.name.trim(), icon: b.icon || '📝', isPaid: !!b.isPaid, requiresAttachment: !!b.requiresAttachment, maxDaysPerYear: b.maxDaysPerYear ?? null, isActive: !!b.isActive, sortOrder: Number(b.sortOrder) || 0 })
    audit(c, 'leave_type.saved', 'LeaveType', t.id, null, b)
    return json(t)
  }
  on('POST', '/admin/leave-types', 'hr', (c) => saveType(c, null))
  on('PUT', '/admin/leave-types/:id', 'hr', (c, id) => saveType(c, id))
  on('GET', '/admin/documents', 'hr', (c) => json([...c.db.documents].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).map((d) => docDto(c.db, d, true))))
  on('GET', '/admin/documents/:id', 'hr', (c, id) => download(c, id))
  on('POST', '/admin/documents', 'hr', async (c) => {
    const form = c.body as FormData
    const file = form.get('file') as File | null
    const title = String(form.get('title') ?? '').trim()
    if (!file || !title) throw bad('file', 'Selecciona un archivo y un título.')
    if (file.size > 2 * 1024 * 1024) throw bad('file', 'En el demo el máximo es 2 MB (se guarda en tu navegador).')
    const bytes = new Uint8Array(await file.arrayBuffer())
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    const employeeId = (form.get('employeeId') as string) || null
    const d = { id: uid(), employeeId, category: String(form.get('category') ?? 'other') as 'other', title, fileName: file.name, contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size, uploadedAt: nowIso(), dataBase64: btoa(bin) }
    c.db.documents.push(d)
    audit(c, 'document.uploaded', 'Document', d.id, employeeId, { title })
    for (const e of c.db.employees.filter((x) => x.isActive && (!employeeId || x.id === employeeId)))
      notify(c.db, e.id, 'document', 'Nuevo documento', `RRHH publicó «${title}».`, '/me/documents')
    return json(docDto(c.db, d, true))
  })
  on('DELETE', '/admin/documents/:id', 'hr', (c, id) => {
    const i = c.db.documents.findIndex((d) => d.id === id)
    if (i < 0) throw notFound()
    audit(c, 'document.deleted', 'Document', id, c.db.documents[i].employeeId, { title: c.db.documents[i].title })
    c.db.documents.splice(i, 1)
    return noContent()
  })
  on('GET', '/admin/payroll-runs', 'hr', (c) => json([...c.db.runs].sort((a, b) => b.payDate.localeCompare(a.payDate)).map((r) => runDto(c.db, r))))
  on('POST', '/admin/payroll-runs', 'hr', (c) => {
    const kind = c.body?.kind as 'regular' | 'decimo', payDate = String(c.body?.payDate ?? '')
    if (!payDate) throw bad('payDate', 'Selecciona la fecha de pago.')
    const d = new Date(payDate + 'T00:00')
    let start: string, end: string
    if (kind === 'regular') {
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      if (d.getDate() !== 15 && d.getDate() !== last) throw bad('payDate', 'Las planillas regulares se pagan el 15 y el último día del mes.')
      ;[start, end] = periodFor(payDate)
    } else {
      if (d.getDate() !== 15 || ![3, 7, 11].includes(d.getMonth())) throw bad('payDate', 'El décimo se paga el 15 de abril, agosto y diciembre.')
      const p = decimoPeriod(payDate)
      ;[start, end] = [p.start, p.end]
    }
    if (c.db.runs.some((r) => r.kind === kind && r.payDate === payDate)) throw bad('payDate', 'Ya existe una planilla para esa fecha.')
    const run = { id: uid(), kind, periodStart: start, periodEnd: end, payDate, status: 'draft' as const, createdAt: nowIso(), publishedAt: null }
    c.db.runs.push(run)
    for (const e of c.db.employees.filter((x) => x.isActive && x.hireDate <= end)) {
      const lines = kind === 'regular'
        ? calculateRegular(e.monthlySalary, 0, 0, c.db.deductions.filter((x) => x.employeeId === e.id && x.isActive).map((x) => ({ code: x.code, description: x.description, amount: x.amountPerPeriod })))
        : calculateDecimo((() => {
            const paid = c.db.slips.filter((s) => s.employeeId === e.id && s.kind === 'regular' && s.payDate >= start && s.payDate <= end).reduce((sum, s) => sum + totals(s.lines).gross, 0)
            return paid > 0 ? paid : estimateDecimoGross(e.monthlySalary, { start, end }, e.hireDate) * 12
          })())
      c.db.slips.push({ id: uid(), employeeId: e.id, runId: run.id, kind, periodStart: start, periodEnd: end, payDate, isPublished: false, lines })
    }
    audit(c, 'payroll.run_created', 'PayrollRun', run.id, null, { kind, payDate })
    return json(runDetail(c.db, run.id))
  })
  on('GET', '/admin/payroll-runs/:id', 'hr', (c, id) => json(runDetail(c.db, id)))
  on('POST', '/admin/payroll-runs/:id/publish', 'hr', (c, id) => {
    const r = c.db.runs.find((x) => x.id === id)
    if (!r) throw notFound()
    if (r.status === 'published') throw new HttpError(400, 'La planilla ya fue publicada.')
    r.status = 'published'
    r.publishedAt = nowIso()
    for (const s of c.db.slips.filter((x) => x.runId === id)) {
      s.isPublished = true
      notify(c.db, s.employeeId, 'payslip', 'Comprobante disponible', `Tu comprobante del ${Number(r.payDate.slice(8))} de ${MONTH_NAMES[Number(r.payDate.slice(5, 7)) - 1].toLowerCase()} está disponible. Neto: $${totals(s.lines).net.toFixed(2)}.`, `/payroll/payslips/${s.id}`)
    }
    audit(c, 'payroll.run_published', 'PayrollRun', id, null, { payDate: r.payDate })
    return json(runDetail(c.db, id))
  })
  on('DELETE', '/admin/payroll-runs/:id', 'hr', (c, id) => {
    const r = c.db.runs.find((x) => x.id === id)
    if (!r) throw notFound()
    if (r.status !== 'draft') throw new HttpError(400, 'Solo se pueden eliminar planillas en borrador.')
    c.db.runs = c.db.runs.filter((x) => x.id !== id)
    c.db.slips = c.db.slips.filter((s) => s.runId !== id)
    return noContent()
  })
  on('GET', '/admin/change-requests', 'hr', (c) => {
    const st = c.query.get('status')
    return json(c.db.changes.filter((x) => !st || x.status === st).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((x) => changeDto(c.db, x)))
  })
  on('POST', '/admin/change-requests/:id/:action', 'hr', (c, id, action) => {
    const ch = c.db.changes.find((x) => x.id === id)
    if (!ch) throw notFound()
    const approve = action === 'approve'
    decide(c, ch, approve, false)
    audit(c, approve ? 'profile.change_approved' : 'profile.change_rejected', 'ChangeRequest', ch.id, ch.employeeId, { field: ch.field })
    notify(c.db, ch.employeeId, 'profile', approve ? 'Solicitud de cambio aprobada' : 'Solicitud de cambio rechazada', `Tu solicitud para modificar «${FIELD_LABELS[ch.field]}» fue ${approve ? 'aprobada' : 'rechazada'}.`, '/me')
    return noContent()
  })
  on('POST', '/admin/announcements', 'hr', (c) => {
    const { title, body, department } = c.body ?? {}
    if (!String(title ?? '').trim() || !String(body ?? '').trim()) throw bad('title', 'Título y mensaje son obligatorios.')
    const targets = c.db.employees.filter((e) => e.isActive && (!department || e.department === department))
    for (const e of targets) notify(c.db, e.id, 'announcement', title.trim(), body.trim())
    audit(c, 'announcement.sent', 'Announcement', null, null, { title, recipients: targets.length })
    return json({ recipients: targets.length })
  })
  on('GET', '/admin/audit', 'hr', (c) => {
    const action = c.query.get('action'), employeeId = c.query.get('employeeId'), from = c.query.get('from'), to = c.query.get('to')
    const page = Number(c.query.get('page') ?? 1), pageSize = Number(c.query.get('pageSize') ?? 50)
    const items = [...c.db.audit].reverse().filter((a) => (!action || a.action.startsWith(action)) && (!employeeId || a.subjectEmployeeId === employeeId || a.actorId === employeeId)
      && (!from || a.at.slice(0, 10) >= from) && (!to || a.at.slice(0, 10) <= to))
    return json({ items: items.slice((page - 1) * pageSize, page * pageSize).map((a) => auditDto(c.db, a)), total: items.length, page, pageSize })
  })

  // ── dispatcher ──
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin)
    const path = url.pathname.slice(url.pathname.indexOf(prefix) + prefix.length) || '/'
    const method = (init?.method ?? 'GET').toUpperCase()
    await new Promise((r) => setTimeout(r, 120)) // feel like a network
    const db = load()
    try {
      for (const [m, re, handler, access] of routes) {
        const match = method === m && path.match(re)
        if (!match) continue
        const auth = new Headers(init?.headers).get('authorization')?.replace('Bearer demo.', '')
        const user = auth ? emp(db, auth) : null
        if (access !== 'public' && !user) throw new HttpError(401, 'No autenticado.')
        if (access === 'manager' && user!.role === 'employee') throw new HttpError(403, 'No tienes permiso para realizar esta acción.')
        if (access === 'hr' && user!.role !== 'hrAdmin') throw new HttpError(403, 'No tienes permiso para realizar esta acción.')
        const body = init?.body instanceof FormData ? init.body : typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
        const res = await handler({ db, me: user, body, query: url.searchParams }, ...match.slice(1).map(decodeURIComponent))
        save(db)
        return res
      }
      throw notFound(`Ruta no disponible en el demo: ${method} ${path}`)
    } catch (e) {
      if (e instanceof HttpError) return json({ title: e.message, status: e.status, errors: e.errors }, e.status)
      console.error(e)
      return json({ title: 'Ocurrió un error inesperado.', status: 500 }, 500)
    }
  }
}

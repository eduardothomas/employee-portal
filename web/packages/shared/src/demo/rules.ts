// TypeScript port of EmployeePortal.Domain rules, used by the in-browser demo backend.
// Source of truth remains backend/src/EmployeePortal.Domain — keep both in sync.
import { toIsoDate, parseDate } from '../format'

export interface Line {
  type: 'earning' | 'deduction'
  code: string
  description: string
  amount: number
}

export const round = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100

export function annualIncomeTax(income: number): number {
  if (income <= 11_000) return 0
  if (income <= 50_000) return (income - 11_000) * 0.15
  return 5_850 + (income - 50_000) * 0.25
}

export function calculateRegular(monthly: number, bonus = 0, overtime = 0, extras: { code: string; description: string; amount: number }[] = []): Line[] {
  const lines: Line[] = [{ type: 'earning', code: 'BASE', description: 'Salario base', amount: round(monthly / 2) }]
  if (bonus > 0) lines.push({ type: 'earning', code: 'BONUS', description: 'Bonificación', amount: round(bonus) })
  if (overtime > 0) lines.push({ type: 'earning', code: 'OT', description: 'Horas extra', amount: round(overtime) })
  const gross = lines.reduce((s, l) => s + l.amount, 0)
  lines.push({ type: 'deduction', code: 'CSS', description: 'CSS', amount: round(gross * 0.0975) })
  lines.push({ type: 'deduction', code: 'SE', description: 'Seguro Educativo', amount: round(gross * 0.0125) })
  const isr = round(annualIncomeTax(monthly * 13 + (bonus + overtime) * 2) / 26)
  if (isr > 0) lines.push({ type: 'deduction', code: 'ISR', description: 'ISR', amount: isr })
  for (const e of extras) lines.push({ type: 'deduction', code: e.code, description: e.description, amount: round(e.amount) })
  return lines
}

export function calculateDecimo(earnings: number): Line[] {
  const gross = round(earnings / 12)
  return [
    { type: 'earning', code: 'DECIMO', description: 'Décimo tercer mes', amount: gross },
    { type: 'deduction', code: 'CSS', description: 'CSS (7.25%)', amount: round(gross * 0.0725) },
  ]
}

export const totals = (lines: Line[]) => {
  const gross = round(lines.filter((l) => l.type === 'earning').reduce((s, l) => s + l.amount, 0))
  const deductions = round(lines.filter((l) => l.type === 'deduction').reduce((s, l) => s + l.amount, 0))
  return { gross, deductions, net: round(gross - deductions) }
}

const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate() // m: 1-12
const iso = (y: number, m: number, d: number) => toIsoDate(new Date(y, m - 1, d))

export function nextPayDate(today: string): string {
  const d = parseDate(today)
  const y = d.getFullYear(), m = d.getMonth() + 1
  return d.getDate() <= 15 ? iso(y, m, 15) : iso(y, m, daysInMonth(y, m))
}

export function previousPayDate(payDate: string): string {
  const d = parseDate(payDate)
  if (d.getDate() > 15) return iso(d.getFullYear(), d.getMonth() + 1, 15)
  const prev = new Date(d.getFullYear(), d.getMonth(), 0)
  return toIsoDate(prev)
}

export function periodFor(payDate: string): [string, string] {
  const d = parseDate(payDate)
  const y = d.getFullYear(), m = d.getMonth() + 1
  return d.getDate() <= 15 ? [iso(y, m, 1), iso(y, m, 15)] : [iso(y, m, 16), iso(y, m, daysInMonth(y, m))]
}

export function decimoPeriod(today: string): { start: string; end: string; payDate: string } {
  const y = parseDate(today).getFullYear()
  const apr = iso(y, 4, 15), aug = iso(y, 8, 15), dec = iso(y, 12, 15)
  if (today <= apr) return { start: iso(y - 1, 12, 16), end: apr, payDate: apr }
  if (today <= aug) return { start: iso(y, 4, 16), end: aug, payDate: aug }
  if (today <= dec) return { start: iso(y, 8, 16), end: dec, payDate: dec }
  return { start: iso(y, 12, 16), end: iso(y + 1, 4, 15), payDate: iso(y + 1, 4, 15) }
}

const dayNumber = (s: string) => Math.round(parseDate(s).getTime() / 86_400_000)

export function estimateDecimoGross(monthly: number, p: { start: string; end: string }, hireDate: string): number {
  const start = hireDate > p.start ? hireDate : p.start
  if (start > p.end) return 0
  const days = dayNumber(p.end) - dayNumber(start) + 1
  const total = dayNumber(p.end) - dayNumber(p.start) + 1
  return round((monthly * 4 * days) / total / 12)
}

function easter(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

const holidayCache = new Map<number, { date: string; name: string }[]>()

export function panamaHolidays(year: number): { date: string; name: string }[] {
  const cached = holidayCache.get(year)
  if (cached) return cached
  const e = easter(year)
  const shift = (n: number) => toIsoDate(new Date(e.getFullYear(), e.getMonth(), e.getDate() + n))
  const list = [
    [iso(year, 1, 1), 'Año Nuevo'], [iso(year, 1, 9), 'Día de los Mártires'], [shift(-48), 'Carnaval'], [shift(-47), 'Carnaval'],
    [shift(-2), 'Viernes Santo'], [iso(year, 5, 1), 'Día del Trabajo'], [iso(year, 11, 3), 'Separación de Colombia'],
    [iso(year, 11, 5), 'Día de Colón'], [iso(year, 11, 10), 'Grito de La Villa'], [iso(year, 11, 28), 'Independencia de España'],
    [iso(year, 12, 8), 'Día de las Madres'], [iso(year, 12, 20), 'Día de Duelo Nacional'], [iso(year, 12, 25), 'Navidad'],
  ].map(([date, name]) => {
    const d = parseDate(date)
    return { date: d.getDay() === 0 ? addDays(date, 1) : date, name }
  }).sort((a, b) => a.date.localeCompare(b.date))
  holidayCache.set(year, list)
  return list
}

export function addDays(date: string, n: number): string {
  const d = parseDate(date)
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n))
}

export const isHoliday = (date: string) => panamaHolidays(parseDate(date).getFullYear()).some((h) => h.date === date)

export function isWorkingDay(date: string): boolean {
  const dow = parseDate(date).getDay()
  return dow !== 0 && dow !== 6 && !isHoliday(date)
}

export function workingDays(from: string, to: string): number {
  let n = 0
  for (let d = from; d <= to; d = addDays(d, 1)) if (isWorkingDay(d)) n++
  return n
}

export function nextWorkingDay(d: string): string {
  while (!isWorkingDay(d)) d = addDays(d, 1)
  return d
}

export function addWorkingDays(start: string, days: number): string {
  let d = start, count = 1
  while (count < days) {
    d = addDays(d, 1)
    if (isWorkingDay(d)) count++
  }
  return d
}

export const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
export const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export const formatMoney = (value: number) => money.format(value)

/** Parses "yyyy-MM-dd" as a local date (avoids the UTC off-by-one of `new Date(string)`). */
export function parseDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toIsoDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const monthName = (month: number) => capitalize(MONTHS[month - 1])

/** "15 de septiembre" */
export const formatLongDate = (value: string) => {
  const d = parseDate(value)
  return `${d.getDate()} de ${MONTHS[d.getMonth()]}`
}

/** "15 sep 2026" */
export const formatDate = (value: string) => {
  const d = parseDate(value)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()].toLowerCase()} ${d.getFullYear()}`
}

/** "15 Sep" */
export const formatShortDate = (value: string) => {
  const d = parseDate(value)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-PA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function formatRelative(iso: string): string {
  const date = new Date(iso)
  const days = Math.floor((startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / 86_400_000)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export function formatDays(n: number): string {
  const v = Number.isInteger(n) ? n.toString() : n.toFixed(1)
  return `${v} ${n === 1 ? 'día' : 'días'}`
}

export function formatBytes(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  draft: 'Borrador',
  published: 'Publicada',
}

export const ROLE_LABEL: Record<string, string> = {
  employee: 'Empleado',
  manager: 'Manager',
  hrAdmin: 'RRHH / Admin',
}

export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

/** Opens a blob in a new tab or triggers a download. */
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

import { useState } from 'react'
import { MONTHS, WEEKDAYS_SHORT, capitalize, parseDate, toIsoDate } from '@ep/shared'
import type { Holiday } from '@ep/shared'
import { ChevronLeft, ChevronRight } from './icons'

export interface CalendarRange {
  start: string
  end: string
  kind: 'vacation' | 'leave'
  pending?: boolean
}

interface Props {
  initialMonth?: Date
  ranges: CalendarRange[]
  holidays: Holiday[]
}

/** Month calendar (Monday-first) highlighting vacations, leave and Panamanian holidays. */
export function Calendar({ initialMonth, ranges, holidays }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = initialMonth ?? new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const offset = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayIso = toIsoDate(new Date())
  const holidayMap = new Map(holidays.map((h) => [h.date, h.name]))
  const monthHolidays = holidays.filter((h) => {
    const d = parseDate(h.date)
    return d.getFullYear() === year && d.getMonth() === month
  })

  const cells = []
  for (let i = 0; i < offset; i++) cells.push(<span key={`e${i}`} />)
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = toIsoDate(new Date(year, month, day))
    const dow = (offset + day - 1) % 7
    const range = ranges.find((r) => iso >= r.start && iso <= r.end)
    const cls = ['day']
    if (dow >= 5) cls.push('weekend')
    if (iso === todayIso) cls.push('today')
    if (holidayMap.has(iso)) cls.push('holiday')
    if (range) {
      cls.push(range.kind)
      if (range.pending) cls.push('pending')
      if (iso === range.start || dow === 0 || day === 1) cls.push('range-start')
      if (iso === range.end || dow === 6 || day === daysInMonth) cls.push('range-end')
    }
    cells.push(
      <span key={iso} className={cls.join(' ')} title={holidayMap.get(iso)}>
        {day}
      </span>,
    )
  }

  return (
    <div>
      <div className="calendar-head">
        <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Mes anterior">
          <ChevronLeft width={9} height={15} />
        </button>
        <h3>{capitalize(MONTHS[month])} {year}</h3>
        <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Mes siguiente">
          <ChevronRight style={{ width: 8, height: 14 }} />
        </button>
      </div>
      <div className="calendar-grid">
        {WEEKDAYS_SHORT.map((d, i) => (
          <span key={i} className="dow">{d}</span>
        ))}
        {cells}
      </div>
      <div className="legend">
        <span><i style={{ background: 'var(--accent-soft)' }} />Vacaciones</span>
        <span><i style={{ background: 'var(--warning-soft)' }} />Pendiente</span>
        <span><i style={{ background: 'var(--success-soft)' }} />Permiso</span>
        <span><i style={{ background: '#ff9f0a', borderRadius: '50%' }} />Feriado</span>
      </div>
      {monthHolidays.length > 0 && (
        <p className="small muted" style={{ marginTop: 10 }}>
          {monthHolidays.map((h) => `${parseDate(h.date).getDate()} · ${h.name}`).join('   ')}
        </p>
      )}
    </div>
  )
}

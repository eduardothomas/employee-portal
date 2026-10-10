package com.employeeportal.data.demo

import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.Month
import kotlinx.datetime.minus
import kotlinx.datetime.number
import kotlinx.datetime.plus
import kotlin.math.roundToLong

/** Kotlin port of EmployeePortal.Domain payroll and calendar rules (source of truth: the backend). */
internal object PanamaRules {
    data class Line(val earning: Boolean, val code: String, val description: String, val amount: Double)

    fun round(v: Double) = (v * 100).roundToLong() / 100.0

    fun annualIncomeTax(income: Double) = when {
        income <= 11_000 -> 0.0
        income <= 50_000 -> (income - 11_000) * 0.15
        else -> 5_850 + (income - 50_000) * 0.25
    }

    fun regular(monthly: Double, bonus: Double = 0.0, overtime: Double = 0.0, extras: List<Triple<String, String, Double>> = emptyList()): List<Line> {
        val lines = mutableListOf(Line(true, "BASE", "Salario base", round(monthly / 2)))
        if (bonus > 0) lines += Line(true, "BONUS", "Bonificación", round(bonus))
        if (overtime > 0) lines += Line(true, "OT", "Horas extra", round(overtime))
        val gross = lines.sumOf { it.amount }
        lines += Line(false, "CSS", "CSS", round(gross * 0.0975))
        lines += Line(false, "SE", "Seguro Educativo", round(gross * 0.0125))
        val isr = round(annualIncomeTax(monthly * 13 + (bonus + overtime) * 2) / 26)
        if (isr > 0) lines += Line(false, "ISR", "ISR", isr)
        extras.forEach { (code, desc, amount) -> lines += Line(false, code, desc, round(amount)) }
        return lines
    }

    fun decimo(earnings: Double): List<Line> {
        val gross = round(earnings / 12)
        return listOf(Line(true, "DECIMO", "Décimo tercer mes", gross), Line(false, "CSS", "CSS (7.25%)", round(gross * 0.0725)))
    }

    private fun LocalDate.lastDayOfMonth() = LocalDate(year, month, 1).plus(1, DateTimeUnit.MONTH).minus(1, DateTimeUnit.DAY)

    fun nextPayDate(today: LocalDate) = if (today.day <= 15) LocalDate(today.year, today.month, 15) else today.lastDayOfMonth()

    fun previousPayDate(payDate: LocalDate) =
        if (payDate.day > 15) LocalDate(payDate.year, payDate.month, 15) else LocalDate(payDate.year, payDate.month, 1).minus(1, DateTimeUnit.DAY)

    fun periodFor(payDate: LocalDate) =
        if (payDate.day <= 15) LocalDate(payDate.year, payDate.month, 1) to LocalDate(payDate.year, payDate.month, 15)
        else LocalDate(payDate.year, payDate.month, 16) to payDate.lastDayOfMonth()

    data class DecimoPeriod(val start: LocalDate, val end: LocalDate, val payDate: LocalDate)

    fun decimoPeriod(today: LocalDate): DecimoPeriod {
        val y = today.year
        val apr = LocalDate(y, 4, 15); val aug = LocalDate(y, 8, 15); val dec = LocalDate(y, 12, 15)
        return when {
            today <= apr -> DecimoPeriod(LocalDate(y - 1, 12, 16), apr, apr)
            today <= aug -> DecimoPeriod(LocalDate(y, 4, 16), aug, aug)
            today <= dec -> DecimoPeriod(LocalDate(y, 8, 16), dec, dec)
            else -> DecimoPeriod(LocalDate(y, 12, 16), LocalDate(y + 1, 4, 15), LocalDate(y + 1, 4, 15))
        }
    }

    fun estimateDecimoGross(monthly: Double, p: DecimoPeriod, hire: LocalDate): Double {
        val start = maxOf(hire, p.start)
        if (start > p.end) return 0.0
        val days = p.end.toEpochDays() - start.toEpochDays() + 1
        val total = p.end.toEpochDays() - p.start.toEpochDays() + 1
        return round(monthly * 4 * days / total / 12)
    }

    private fun easter(year: Int): LocalDate {
        val a = year % 19; val b = year / 100; val c = year % 100; val d = b / 4; val e = b % 4
        val f = (b + 8) / 25; val g = (b - f + 1) / 3; val h = (19 * a + b - d - g + 15) % 30
        val i = c / 4; val k = c % 4; val l = (32 + 2 * e + 2 * i - h - k) % 7; val m = (a + 11 * h + 22 * l) / 451
        return LocalDate(year, (h + l - 7 * m + 114) / 31, (h + l - 7 * m + 114) % 31 + 1)
    }

    private val holidayCache = mutableMapOf<Int, List<Pair<LocalDate, String>>>()

    fun holidays(year: Int): List<Pair<LocalDate, String>> = holidayCache.getOrPut(year) {
        val e = easter(year)
        listOf(
            LocalDate(year, 1, 1) to "Año Nuevo", LocalDate(year, 1, 9) to "Día de los Mártires",
            e.minus(48, DateTimeUnit.DAY) to "Carnaval", e.minus(47, DateTimeUnit.DAY) to "Carnaval", e.minus(2, DateTimeUnit.DAY) to "Viernes Santo",
            LocalDate(year, 5, 1) to "Día del Trabajo", LocalDate(year, 11, 3) to "Separación de Colombia", LocalDate(year, 11, 5) to "Día de Colón",
            LocalDate(year, 11, 10) to "Grito de La Villa", LocalDate(year, 11, 28) to "Independencia de España",
            LocalDate(year, 12, 8) to "Día de las Madres", LocalDate(year, 12, 20) to "Día de Duelo Nacional", LocalDate(year, 12, 25) to "Navidad",
        ).map { (d, n) -> (if (d.dayOfWeek == DayOfWeek.SUNDAY) d.plus(1, DateTimeUnit.DAY) else d) to n }.sortedBy { it.first }
    }

    fun isWorkingDay(d: LocalDate) =
        d.dayOfWeek != DayOfWeek.SATURDAY && d.dayOfWeek != DayOfWeek.SUNDAY && holidays(d.year).none { it.first == d }

    fun workingDays(from: LocalDate, to: LocalDate): Int {
        var n = 0
        var d = from
        while (d <= to) { if (isWorkingDay(d)) n++; d = d.plus(1, DateTimeUnit.DAY) }
        return n
    }

    fun nextWorkingDay(start: LocalDate): LocalDate {
        var d = start
        while (!isWorkingDay(d)) d = d.plus(1, DateTimeUnit.DAY)
        return d
    }

    fun addWorkingDays(start: LocalDate, days: Int): LocalDate {
        var d = start; var count = 1
        while (count < days) { d = d.plus(1, DateTimeUnit.DAY); if (isWorkingDay(d)) count++ }
        return d
    }

    val MONTH_NAMES = Month.entries.map { listOf("Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre")[it.number - 1] }
}

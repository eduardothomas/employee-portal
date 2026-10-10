package com.employeeportal.core.format

import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.number
import kotlinx.datetime.toLocalDateTime
import kotlinx.datetime.todayIn
import kotlin.math.abs
import kotlin.math.roundToLong
import kotlin.time.Clock
import kotlin.time.Instant

val MONTHS = listOf("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre")
val MONTHS_SHORT = listOf("Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic")

fun today(): LocalDate = Clock.System.todayIn(TimeZone.currentSystemDefault())

fun String.cap() = replaceFirstChar { it.uppercase() }

fun monthName(month: Int) = MONTHS[month - 1].cap()

/** $1,234.56 — formatted by hand because common code has no java.text. */
fun money(value: Double): String {
    val cents = (abs(value) * 100).roundToLong()
    val whole = (cents / 100).toString().reversed().chunked(3).joinToString(",").reversed()
    val frac = (cents % 100).toString().padStart(2, '0')
    return "${if (value < 0) "-" else ""}$$whole.$frac"
}

fun days(n: Double): String {
    val v = if (n % 1.0 == 0.0) n.toLong().toString() else ((n * 10).roundToLong() / 10.0).toString()
    return "$v ${if (n == 1.0) "día" else "días"}"
}

fun date(iso: String): LocalDate = LocalDate.parse(iso.take(10))

/** "15 de septiembre" */
fun longDate(iso: String) = date(iso).let { "${it.day} de ${MONTHS[it.month.number - 1]}" }

/** "15 sep 2026" */
fun mediumDate(iso: String) = date(iso).let { "${it.day} ${MONTHS_SHORT[it.month.number - 1].lowercase()} ${it.year}" }

/** "15 Sep" */
fun shortDate(iso: String) = date(iso).let { "${it.day} ${MONTHS_SHORT[it.month.number - 1]}" }

fun relative(isoInstant: String): String {
    val d = runCatching { Instant.parse(isoInstant).toLocalDateTime(TimeZone.currentSystemDefault()).date }.getOrElse { date(isoInstant) }
    val diff = d.daysUntilToday()
    return when {
        diff == 0 -> "Hoy"
        diff == 1 -> "Ayer"
        diff in 2..6 -> "Hace $diff días"
        else -> "${d.day} ${MONTHS_SHORT[d.month.number - 1]}"
    }
}

private fun LocalDate.daysUntilToday(): Int = (today().toEpochDays() - toEpochDays()).toInt()

fun greeting(): String {
    val hour = Clock.System.now().toLocalDateTime(TimeZone.currentSystemDefault()).hour
    return when {
        hour < 12 -> "Buenos días"
        hour < 19 -> "Buenas tardes"
        else -> "Buenas noches"
    }
}

fun initials(name: String) = name.split(" ").filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }

val STATUS_LABEL = mapOf("pending" to "Pendiente", "approved" to "Aprobado", "rejected" to "Rechazado", "cancelled" to "Cancelado")

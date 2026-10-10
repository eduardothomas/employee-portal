package com.employeeportal.features.time

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.employeeportal.core.format.MONTHS
import com.employeeportal.core.format.cap
import com.employeeportal.core.format.today
import com.employeeportal.designsystem.*
import com.employeeportal.domain.Holiday
import kotlinx.datetime.*

data class CalendarRange(val start: LocalDate, val end: LocalDate, val leave: Boolean, val pending: Boolean)

/** Monday-first month calendar with vacations, leave and Panamanian holidays. */
@Composable
fun MonthCalendar(initial: LocalDate, ranges: List<CalendarRange>, holidays: List<Holiday>) {
    val c = Portal.colors
    var cursor by remember { mutableStateOf(LocalDate(initial.year, initial.month, 1)) }
    val first = cursor
    val daysInMonth = first.plus(1, DateTimeUnit.MONTH).minus(1, DateTimeUnit.DAY).day
    val offset = first.dayOfWeek.isoDayNumber - 1
    val holidayMap = holidays.associate { LocalDate.parse(it.date) to it.name }
    val t = today()

    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Icon(PortalIcons.ChevronLeft, "Mes anterior", tint = c.accent, modifier = Modifier.size(28.dp).clickableNoRipple { cursor = cursor.minus(1, DateTimeUnit.MONTH) })
        T("${MONTHS[first.month.number - 1].cap()} ${first.year}", 17.sp, FontWeight.SemiBold, modifier = Modifier.weight(1f), align = androidx.compose.ui.text.style.TextAlign.Center)
        Icon(PortalIcons.ChevronRight, "Mes siguiente", tint = c.accent, modifier = Modifier.size(28.dp).clickableNoRipple { cursor = cursor.plus(1, DateTimeUnit.MONTH) })
    }
    Spacer(Modifier.height(12.dp))
    Row(Modifier.fillMaxWidth()) { listOf("L", "M", "M", "J", "V", "S", "D").forEach { T(it, 12.sp, FontWeight.SemiBold, c.text2, Modifier.weight(1f), align = androidx.compose.ui.text.style.TextAlign.Center) } }
    val cells = List(offset) { null } + (1..daysInMonth).map { LocalDate(first.year, first.month, it) }
    cells.chunked(7).forEach { week ->
        Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
            week.forEach { day ->
                Box(Modifier.weight(1f).aspectRatio(1f), contentAlignment = Alignment.Center) {
                    if (day != null) {
                        val range = ranges.firstOrNull { day in it.start..it.end }
                        val weekend = day.dayOfWeek == DayOfWeek.SATURDAY || day.dayOfWeek == DayOfWeek.SUNDAY
                        val bg = when { range == null -> Color.Transparent; range.pending -> c.warningSoft; range.leave -> c.successSoft; else -> c.accentSoft }
                        val fg = when { range == null && day == t -> c.accent; range == null && weekend -> c.text3; range == null -> c.text; range.pending -> c.warning; range.leave -> c.success; else -> c.accent }
                        Box(Modifier.fillMaxSize(0.9f).clip(CircleShape).background(bg), contentAlignment = Alignment.Center) {
                            T("${day.day}", 16.sp, if (range != null || day == t) FontWeight.SemiBold else FontWeight.Normal, fg)
                        }
                        if (holidayMap.containsKey(day)) Box(Modifier.align(Alignment.BottomCenter).padding(bottom = 3.dp).size(5.dp).clip(CircleShape).background(Color(0xFFFF9F0A)))
                    }
                }
            }
            repeat(7 - week.size) { Spacer(Modifier.weight(1f)) }
        }
    }
    Spacer(Modifier.height(10.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Legend(c.accentSoft, "Vacaciones"); Legend(c.warningSoft, "Pendiente"); Legend(c.successSoft, "Permiso"); Legend(Color(0xFFFF9F0A), "Feriado")
    }
    val monthHolidays = holidayMap.filterKeys { it.year == first.year && it.month == first.month }
    if (monthHolidays.isNotEmpty()) Muted(monthHolidays.entries.joinToString("   ") { "${it.key.day} · ${it.value}" }, 13.sp, Modifier.padding(top = 10.dp))
}

@Composable
private fun Legend(color: Color, label: String) = Row(verticalAlignment = Alignment.CenterVertically) {
    Box(Modifier.size(10.dp).clip(RoundedCornerShape(3.dp)).background(color))
    Spacer(Modifier.width(5.dp))
    T(label, 12.sp, color = Portal.colors.text2)
}

package com.employeeportal.features.time

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.employeeportal.LocalNav
import com.employeeportal.core.config.LocalApp
import com.employeeportal.core.format.*
import com.employeeportal.designsystem.*
import com.employeeportal.designsystem.T
import com.employeeportal.designsystem.Card
import com.employeeportal.domain.*
import com.employeeportal.navigation.Routes
import kotlinx.coroutines.launch
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.atStartOfDayIn
import kotlinx.datetime.toLocalDateTime
import kotlin.time.Instant

@Composable
fun TimeScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val toast = LocalToast.current
    val scope = rememberCoroutineScope()
    val vacations = rememberResource { vacations() }
    val leaves = rememberResource { leaveRequests() }
    var tab by remember { mutableIntStateOf(0) }
    var selected by remember { mutableStateOf<VacationRequest?>(null) }

    Screen(Modifier.statusBarsPadding()) {
        LargeTitle("Tiempo")
        Segmented(listOf("Vacaciones", "Calendario"), tab) { tab = it }
        Spacer(Modifier.height(20.dp))
        Load(vacations) { v ->
            if (tab == 1) {
                Card {
                    MonthCalendar(
                        initial = v.upcoming?.let { date(it.startDate) } ?: today(),
                        holidays = v.holidays,
                        ranges = v.requests.filter { it.status == "approved" || it.status == "pending" }.map { CalendarRange(date(it.startDate), date(it.endDate), false, it.status == "pending") } +
                            (leaves.data ?: emptyList()).filter { it.status == "approved" || it.status == "pending" }.map { CalendarRange(date(it.startDate), date(it.endDate), true, it.status == "pending") },
                    )
                }
                return@Load
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Stat(days(v.balance.available).substringBefore(" "), "Disponibles", Modifier.weight(1f), accent = true)
                Stat(days(v.balance.used).substringBefore(" "), "Utilizados", Modifier.weight(1f))
                Stat(days(v.balance.accrued).substringBefore(" "), "Acumulados", Modifier.weight(1f))
            }
            if (v.balance.pending > 0) Muted("${days(v.balance.pending)} en solicitudes pendientes de aprobación.", 13.sp, Modifier.padding(8.dp))
            v.upcoming?.let { u ->
                SectionTitle("Próximas vacaciones")
                Card(onClick = { selected = u }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            T("${shortDate(u.startDate)} — ${shortDate(u.endDate)}".uppercase(), 22.sp, FontWeight.Bold)
                            Muted("${days(u.days)} laborables")
                        }
                        StatusBadge(u.status)
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
            PortalButton("Solicitar vacaciones", { nav.navigate(Routes.VacationNew) })
            SectionTitle("Solicitudes")
            ListGroup {
                if (v.requests.isEmpty()) Empty("🏝️", "Aún no has solicitado vacaciones")
                v.requests.forEachIndexed { i, r ->
                    ListRow("${shortDate(r.startDate)} – ${shortDate(r.endDate)}", "${r.number} · ${days(r.days)}", divider = i > 0,
                        trailing = { StatusBadge(r.status) }, onClick = { selected = r })
                }
            }
            SectionTitle("Permisos") { T("Ver todos", 15.sp, color = Portal.colors.accent, modifier = Modifier.clickable { nav.navigate(Routes.Leave) }) }
            ListGroup {
                ListRow("Nuevo permiso", icon = "📝", divider = false, onClick = { nav.navigate(Routes.LeaveNew) })
                leaves.data.orEmpty().filter { it.status == "pending" }.take(3).forEach { l ->
                    ListRow(l.leaveTypeName, shortDate(l.startDate), icon = l.leaveTypeIcon, trailing = { StatusBadge(l.status) }, onClick = { nav.navigate(Routes.Leave) })
                }
            }
        }
    }

    selected?.let { r ->
        Sheet(r.number, { selected = null }) {
            ListGroup {
                ListRow("Desde", value = shortDate(r.startDate), divider = false)
                ListRow("Hasta", value = shortDate(r.endDate))
                ListRow("Días laborables", value = r.days.toInt().toString())
                ListRow("Estado", trailing = { StatusBadge(r.status) })
                r.reviewerName?.let { ListRow("Revisado por", value = it) }
                r.comment?.let { ListRow("Comentario", it) }
                r.reviewComment?.let { ListRow("Respuesta", it) }
            }
            if (r.status == "pending") {
                Spacer(Modifier.height(16.dp))
                PortalButton("Cancelar solicitud", {
                    scope.launch {
                        runCatching { app.repository.cancelVacation(r.id) }.onSuccess { toast.show("Solicitud cancelada"); selected = null; vacations.reload() }.onFailure { toast.show(it.userMessage()) }
                    }
                }, kind = ButtonKind.Danger)
            }
        }
    }
}

private fun Long.toLocalDate(): LocalDate = Instant.fromEpochMilliseconds(this).toLocalDateTime(TimeZone.UTC).date
private fun LocalDate.toMillis(): Long = atStartOfDayIn(TimeZone.UTC).toEpochMilliseconds()

private object FutureDates : SelectableDates {
    override fun isSelectableDate(utcTimeMillis: Long) = utcTimeMillis.toLocalDate() >= today()
}

@Composable
fun VacationRequestScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    var range by remember { mutableStateOf<Pair<LocalDate, LocalDate>?>(null) }
    var picking by remember { mutableStateOf(false) }
    var comment by remember { mutableStateOf("") }
    var preview by remember { mutableStateOf<VacationPreview?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var sent by remember { mutableStateOf<VacationRequest?>(null) }

    LaunchedEffect(range) {
        preview = null
        range?.let { (s, e) -> runCatching { app.repository.previewVacation(s.toString(), e.toString()) }.onSuccess { preview = it }.onFailure { error = it.userMessage() } }
    }

    sent?.let { s ->
        StackScreen("Solicitud enviada", { nav.popBackStack() }) {
            Column(Modifier.fillMaxWidth().padding(top = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(76.dp).clip(CircleShape).background(Portal.colors.success), contentAlignment = Alignment.Center) { T("✓", 40.sp, color = Color.White) }
                T("Solicitud enviada", 28.sp, FontWeight.Bold, modifier = Modifier.padding(top = 16.dp))
                Muted(s.number, modifier = Modifier.padding(top = 4.dp, bottom = 24.dp))
            }
            Card {
                T("ESTADO", 13.sp, FontWeight.SemiBold, Portal.colors.text2)
                TimelineStep("Enviada", done = true)
                TimelineStep("Pendiente de aprobación", current = true)
                TimelineStep("Aprobada")
            }
            Muted("${shortDate(s.startDate)} – ${shortDate(s.endDate)} · ${days(s.days)}. Te avisaremos cuando tu supervisor responda.", 13.sp, Modifier.fillMaxWidth().padding(16.dp))
            PortalButton("Listo", { nav.popBackStack() })
        }
        return
    }

    StackScreen("Nueva solicitud", { nav.popBackStack() }) {
        LargeTitle("Vacaciones")
        ListGroup {
            ListRow("Desde", value = range?.first?.let { shortDate(it.toString()) } ?: "Elegir", divider = false, onClick = { picking = true })
            ListRow("Hasta", value = range?.second?.let { shortDate(it.toString()) } ?: "Elegir", onClick = { picking = true })
        }
        preview?.let { p ->
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Stat("${p.days}", "Días laborables", Modifier.weight(1f), accent = true)
                Stat(days(p.available).substringBefore(" "), "Disponibles", Modifier.weight(1f))
            }
            if (p.holidaysInRange.isNotEmpty()) Muted("No se descuentan feriados: " + p.holidaysInRange.joinToString { "${shortDate(it.date)} (${it.name})" }, 13.sp, Modifier.padding(8.dp))
            p.error?.let { Spacer(Modifier.height(12.dp)); Alert(it, "warn") }
        }
        Spacer(Modifier.height(16.dp))
        ListGroup { FormField("Comentario", comment, { comment = it }, divider = false, singleLine = false) }
        error?.let { Spacer(Modifier.height(12.dp)); Alert(it) }
        Spacer(Modifier.height(20.dp))
        PortalButton("Solicitar", enabled = preview?.isValid == true, loading = busy, onClick = {
            val (s, e) = range ?: return@PortalButton
            scope.launch {
                busy = true; error = null
                runCatching { app.repository.requestVacation(s.toString(), e.toString(), comment) }.onSuccess { sent = it }.onFailure { error = it.userMessage() }
                busy = false
            }
        })
    }

    if (picking) {
        val state = rememberDateRangePickerState(range?.first?.toMillis(), range?.second?.toMillis(), selectableDates = FutureDates)
        DatePickerDialog(
            onDismissRequest = { picking = false },
            confirmButton = {
                TextButton(enabled = state.selectedStartDateMillis != null, onClick = {
                    val s = state.selectedStartDateMillis!!.toLocalDate()
                    range = s to (state.selectedEndDateMillis?.toLocalDate() ?: s)
                    picking = false
                }) { Text("Listo") }
            },
            dismissButton = { TextButton({ picking = false }) { Text("Cancelar") } },
        ) {
            DateRangePicker(state, Modifier.weight(1f), title = { Text("Fechas de vacaciones", Modifier.padding(start = 24.dp, top = 16.dp)) })
        }
    }
}

@Composable
private fun TimelineStep(label: String, done: Boolean = false, current: Boolean = false) {
    val c = Portal.colors
    Row(Modifier.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(22.dp).clip(CircleShape).background(if (done) c.success else if (current) c.warningSoft else Color.Transparent)
                .border(2.dp, if (done) c.success else if (current) c.warning else c.text3, CircleShape),
            contentAlignment = Alignment.Center,
        ) { if (done) T("✓", 12.sp, color = Color.White) }
        Spacer(Modifier.width(12.dp))
        T(label, color = if (!done && !current) c.text3 else c.text)
    }
}

@Composable
fun LeaveScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val toast = LocalToast.current
    val scope = rememberCoroutineScope()
    val res = rememberResource { leaveRequests() }
    var selected by remember { mutableStateOf<LeaveRequest?>(null) }

    StackScreen("Permisos", { nav.popBackStack() }) {
        LargeTitle("Permisos")
        PortalButton("+ Nuevo permiso", { nav.navigate(Routes.LeaveNew) })
        Load(res) { list ->
            listOf("Pendientes" to list.filter { it.status == "pending" }, "Historial" to list.filter { it.status != "pending" }).forEach { (title, items) ->
                SectionTitle(title)
                ListGroup {
                    if (items.isEmpty()) Empty(if (title == "Pendientes") "👌" else "🗂️", if (title == "Pendientes") "Sin permisos pendientes" else "Sin historial")
                    items.forEachIndexed { i, l ->
                        ListRow(l.leaveTypeName, shortDate(l.startDate) + (l.hours?.let { " · ${it.toInt()} h" } ?: ""), icon = l.leaveTypeIcon, divider = i > 0,
                            trailing = { StatusBadge(l.status) }, onClick = { selected = l })
                    }
                }
            }
        }
    }

    selected?.let { l ->
        Sheet("${l.leaveTypeIcon} ${l.leaveTypeName}", { selected = null }) {
            ListGroup {
                ListRow("Número", value = l.number, divider = false)
                ListRow("Fecha", value = shortDate(l.startDate))
                l.hours?.let { ListRow("Horas", value = it.toInt().toString()) }
                ListRow("Estado", trailing = { StatusBadge(l.status) })
                ListRow("Motivo", l.reason)
                l.reviewerName?.let { ListRow("Revisado por", value = it) }
            }
            if (l.status == "pending") {
                Spacer(Modifier.height(16.dp))
                PortalButton("Cancelar permiso", {
                    scope.launch { runCatching { app.repository.cancelLeave(l.id) }.onSuccess { toast.show("Permiso cancelado"); selected = null; res.reload() }.onFailure { toast.show(it.userMessage()) } }
                }, kind = ButtonKind.Danger)
            }
        }
    }
}

@Composable
fun LeaveRequestScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val toast = LocalToast.current
    val scope = rememberCoroutineScope()
    val types = rememberResource { leaveTypes() }
    var typeId by remember { mutableStateOf<String?>(null) }
    var day by remember { mutableStateOf(today()) }
    var partial by remember { mutableStateOf(false) }
    var hours by remember { mutableIntStateOf(2) }
    var reason by remember { mutableStateOf("") }
    var picking by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    StackScreen("Nuevo permiso", { nav.popBackStack() }) {
        LargeTitle("Permiso")
        Load(types) { list ->
            list.chunked(3).forEach { row ->
                Row(Modifier.fillMaxWidth().padding(bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    row.forEach { t ->
                        Column(
                            Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).background(Portal.colors.surface)
                                .border(2.dp, if (t.id == typeId) Portal.colors.accent else Color.Transparent, RoundedCornerShape(16.dp))
                                .clickable { typeId = t.id }.padding(vertical = 14.dp, horizontal = 6.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) { T(t.icon, 26.sp); T(t.name, 13.sp, align = TextAlign.Center, maxLines = 2) }
                    }
                    repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
            list.firstOrNull { it.id == typeId }?.let { t ->
                if (t.requiresAttachment) Alert("Este permiso requiere presentar constancia a RRHH.", "info")
                t.maxDaysPerYear?.let { Muted("Máximo $it días por año.", 13.sp, Modifier.padding(8.dp)) }
            }
        }
        Spacer(Modifier.height(12.dp))
        ListGroup {
            ListRow("Por horas", divider = false, trailing = { Switch(partial, { partial = it }) }, chevron = false)
            ListRow("Fecha", value = shortDate(day.toString()), onClick = { picking = true })
            if (partial) ListRow("Horas", value = "$hours h", trailing = {
                Row {
                    PortalButton("−", { if (hours > 1) hours-- }, Modifier.width(44.dp), ButtonKind.Secondary)
                    Spacer(Modifier.width(6.dp))
                    PortalButton("+", { if (hours < 8) hours++ }, Modifier.width(44.dp), ButtonKind.Secondary)
                }
            }, chevron = false)
            FormField("Motivo", reason, { reason = it }, singleLine = false)
        }
        error?.let { Spacer(Modifier.height(12.dp)); Alert(it) }
        Spacer(Modifier.height(20.dp))
        PortalButton("Solicitar permiso", enabled = typeId != null && reason.isNotBlank(), loading = busy, onClick = {
            scope.launch {
                busy = true; error = null
                runCatching { app.repository.requestLeave(CreateLeave(typeId!!, day.toString(), day.toString(), if (partial) hours.toDouble() else null, reason)) }
                    .onSuccess { toast.show("Permiso solicitado"); nav.popBackStack() }
                    .onFailure { error = it.userMessage() }
                busy = false
            }
        })
    }

    if (picking) {
        val state = rememberDatePickerState(day.toMillis())
        DatePickerDialog(
            onDismissRequest = { picking = false },
            confirmButton = { TextButton({ state.selectedDateMillis?.let { day = it.toLocalDate() }; picking = false }) { Text("Listo") } },
            dismissButton = { TextButton({ picking = false }) { Text("Cancelar") } },
        ) { DatePicker(state) }
    }
}

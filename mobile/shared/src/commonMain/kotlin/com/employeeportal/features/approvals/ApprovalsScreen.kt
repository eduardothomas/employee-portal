package com.employeeportal.features.approvals

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.employeeportal.LocalNav
import com.employeeportal.core.config.LocalApp
import com.employeeportal.core.format.days
import com.employeeportal.core.format.shortDate
import com.employeeportal.designsystem.*
import kotlinx.coroutines.launch

private data class Pending(val kind: String, val id: String, val title: String, val detail: String)

/** Managers approve their team's requests from the phone. */
@Composable
fun ApprovalsScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val toast = LocalToast.current
    val scope = rememberCoroutineScope()
    val approvals = rememberResource { approvals() }
    val team = rememberResource { team() }
    var selected by remember { mutableStateOf<Pending?>(null) }
    var comment by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    StackScreen("Aprobaciones", { nav.popBackStack() }) {
        Load(approvals) { a ->
            if (a.vacations.isEmpty() && a.leaves.isEmpty()) Empty("🎉", "No hay solicitudes pendientes")
            else {
                SectionTitle("Pendientes")
                ListGroup {
                    a.vacations.forEachIndexed { i, v ->
                        ListRow(v.employeeName, "Vacaciones · ${shortDate(v.startDate)} – ${shortDate(v.endDate)} · ${days(v.days)}", icon = "🏖️", divider = i > 0,
                            onClick = { selected = Pending("vacations", v.id, "Vacaciones de ${v.employeeName}", "${shortDate(v.startDate)} – ${shortDate(v.endDate)} (${days(v.days)})${v.comment?.let { " · “$it”" } ?: ""}") })
                    }
                    a.leaves.forEachIndexed { i, l ->
                        ListRow(l.employeeName, "${l.leaveTypeName} · ${shortDate(l.startDate)}${l.hours?.let { " · ${it.toInt()} h" } ?: ""}", icon = l.leaveTypeIcon, divider = i > 0 || a.vacations.isNotEmpty(),
                            onClick = { selected = Pending("leave-requests", l.id, "${l.leaveTypeName} — ${l.employeeName}", "${shortDate(l.startDate)} · “${l.reason}”") })
                    }
                }
            }
        }
        Load(team) { members ->
            if (members.isNotEmpty()) {
                SectionTitle("Mi equipo")
                ListGroup {
                    members.forEachIndexed { i, m ->
                        ListRow(m.fullName, m.awayToday?.let { "Hoy: $it" } ?: m.jobTitle, icon = "👤", value = days(m.vacationAvailable), divider = i > 0, chevron = false)
                    }
                }
            }
        }
    }

    selected?.let { p ->
        fun decide(approve: Boolean) = scope.launch {
            busy = true
            runCatching { app.repository.decide(p.kind, p.id, approve, comment) }
                .onSuccess { toast.show(if (approve) "Solicitud aprobada" else "Solicitud rechazada"); selected = null; comment = ""; approvals.reload(); team.reload() }
                .onFailure { toast.show(it.userMessage()) }
            busy = false
        }
        Sheet(p.title, { selected = null }) {
            Muted(p.detail, modifier = Modifier.padding(bottom = 16.dp))
            ListGroup { FormField("Comentario (opcional)", comment, { comment = it }, divider = false, singleLine = false) }
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PortalButton("Rechazar", { decide(false) }, Modifier.weight(1f), ButtonKind.Danger, loading = busy)
                PortalButton("Aprobar", { decide(true) }, Modifier.weight(1f), loading = busy)
            }
        }
    }
}

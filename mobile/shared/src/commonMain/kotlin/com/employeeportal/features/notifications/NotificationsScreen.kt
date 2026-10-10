package com.employeeportal.features.notifications

import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.employeeportal.LocalNav
import com.employeeportal.core.config.LocalApp
import com.employeeportal.core.format.relative
import com.employeeportal.designsystem.*
import com.employeeportal.openLink
import kotlinx.coroutines.launch

private val ICONS = mapOf("payslip" to "💰", "vacation" to "🏖️", "leave" to "📝", "document" to "📄", "profile" to "👤", "announcement" to "📣")

@Composable
fun NotificationsScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val scope = rememberCoroutineScope()
    val res = rememberResource { notifications() }

    StackScreen("Notificaciones", { nav.popBackStack() }, action = {
        T("Leer todo", 15.sp, FontWeight.Medium, Portal.colors.accent, androidx.compose.ui.Modifier.then(
            androidx.compose.ui.Modifier.clickableNoRipple { scope.launch { app.repository.markAllRead(); res.reload() } }))
    }) {
        Load(res) { items ->
            if (items.isEmpty()) Empty("🔕", "No tienes notificaciones")
            items.groupBy { relative(it.createdAt) }.forEach { (label, list) ->
                SectionTitle(label)
                ListGroup {
                    list.forEachIndexed { i, n ->
                        ListRow(n.title, n.body, icon = ICONS[n.type] ?: "🔔", divider = i > 0, chevron = false,
                            value = if (n.readAt == null) "●" else null,
                            onClick = { scope.launch { runCatching { app.repository.markRead(n.id) }; if (n.link != null) nav.openLink(n.link) else res.reload() } })
                    }
                }
            }
        }
    }
}

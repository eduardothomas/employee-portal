package com.employeeportal.features.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import com.employeeportal.LocalNav
import com.employeeportal.core.config.LocalApp
import com.employeeportal.core.format.*
import com.employeeportal.designsystem.*
import com.employeeportal.navigation.Routes
import com.employeeportal.openLink

@Composable
fun HomeScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val res = rememberResource { dashboard() }
    var hidden by remember { mutableStateOf(app.hideAmounts) }

    Screen(Modifier.statusBarsPadding()) {
        Load(res) { d ->
            Row(Modifier.fillMaxWidth().padding(top = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    T("Hola, ${d.displayName} 👋", 28.sp, FontWeight.Bold)
                    Muted(greeting(), 17.sp)
                }
                Box(Modifier.size(42.dp).clip(CircleShape).background(Portal.colors.surface).clickable { nav.navigate(Routes.Notifications) }, contentAlignment = Alignment.Center) {
                    Icon(PortalIcons.Bell, "Notificaciones", tint = Portal.colors.text, modifier = Modifier.size(22.dp))
                    if (d.unreadNotifications > 0) Box(Modifier.align(Alignment.TopEnd).padding(4.dp).size(18.dp).clip(CircleShape).background(Color(0xFFFF3B30)), contentAlignment = Alignment.Center) {
                        T("${d.unreadNotifications}", 10.sp, FontWeight.Bold, Color.White)
                    }
                }
            }
            Spacer(Modifier.height(24.dp))

            WalletCard(WalletStyle.Blue) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) { WalletLabel("Próximo pago") }
                    Icon(if (hidden) PortalIcons.EyeOff else PortalIcons.Eye, "Ocultar montos", tint = Color.White.copy(alpha = 0.8f),
                        modifier = Modifier.size(22.dp).clickable { hidden = !hidden; app.hideAmounts = hidden })
                }
                WalletAmount(if (hidden) "$ •••••" else money(d.nextPay.estimatedNet))
                WalletMeta("${longDate(d.nextPay.date)} · estimado")
                Row(Modifier.fillMaxWidth().padding(top = 16.dp)) {
                    WalletMeta("Depósito quincenal", Modifier.weight(1f))
                    T("Ver detalles →", 15.sp, FontWeight.SemiBold, Color.White, Modifier.clickable { nav.navigate(Routes.Payroll) })
                }
            }

            if (d.isManager && d.pendingApprovals > 0) {
                Spacer(Modifier.height(16.dp))
                ListGroup { ListRow("${d.pendingApprovals} solicitudes de tu equipo", "Esperan tu aprobación", icon = "✅", divider = false, onClick = { nav.navigate(Routes.Approvals) }) }
            }

            Spacer(Modifier.height(24.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                QuickAction("🏖️", "Vacaciones") { nav.navigate(Routes.VacationNew) }
                QuickAction("📝", "Permiso") { nav.navigate(Routes.LeaveNew) }
                QuickAction("💵", "Comprobantes") { nav.navigate(Routes.Payslips) }
                QuickAction("📄", "Documentos") { nav.navigate(Routes.Documents) }
            }

            SectionTitle("Vacaciones")
            Card {
                Row(verticalAlignment = Alignment.Bottom) {
                    T(days(d.vacation.available), 28.sp, FontWeight.Bold, modifier = Modifier.weight(1f))
                    Muted("disponibles")
                }
                ProgressBar((d.vacation.available / d.vacation.accrued.coerceAtLeast(1.0)).toFloat(), Modifier.padding(vertical = 14.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Muted("${d.vacation.used.toInt()} usados", 13.sp)
                    if (d.vacation.pending > 0) Muted("${d.vacation.pending.toInt()} pendientes", 13.sp)
                    Muted("${d.vacation.accrued.toInt()} acumulados", 13.sp)
                }
                Spacer(Modifier.height(16.dp))
                PortalButton("Ver vacaciones", { nav.navigate(Routes.Time) }, kind = ButtonKind.Secondary)
            }

            SectionTitle("Actividad reciente") { T("Ver todo", 15.sp, color = Portal.colors.accent, modifier = Modifier.clickable { nav.navigate(Routes.Notifications) }) }
            ListGroup {
                if (d.recentActivity.isEmpty()) Empty("✨", "Sin actividad todavía")
                d.recentActivity.forEachIndexed { i, a ->
                    ListRow(a.title, a.subtitle, icon = a.icon, value = relative(a.date), divider = i > 0, chevron = false, onClick = { nav.openLink(a.link) })
                }
            }
        }
    }
}

@Composable
private fun QuickAction(emoji: String, label: String, onClick: () -> Unit) {
    Column(Modifier.width(84.dp).clickable(onClick = onClick), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(56.dp).clip(RoundedCornerShape(18.dp)).background(Portal.colors.surface), contentAlignment = Alignment.Center) { T(emoji, 24.sp) }
        Spacer(Modifier.height(8.dp))
        T(label, 11.sp, FontWeight.Medium, maxLines = 1)
    }
}

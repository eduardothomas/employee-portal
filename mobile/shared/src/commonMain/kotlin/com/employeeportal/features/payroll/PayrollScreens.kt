package com.employeeportal.features.payroll

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
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
import com.employeeportal.domain.PayslipLine
import com.employeeportal.navigation.Routes
import kotlinx.datetime.number

@Composable
fun PayrollScreen() {
    val nav = LocalNav.current
    val res = rememberResource { payroll() }
    Screen(Modifier.statusBarsPadding()) {
        LargeTitle("Payroll")
        Load(res) { p ->
            WalletCard {
                WalletLabel("Salario mensual")
                WalletAmount(money(p.monthlySalary))
                Row(Modifier.fillMaxWidth().padding(top = 18.dp)) {
                    Column(Modifier.weight(1f)) { WalletMeta("Próximo pago"); T(longDate(p.nextPayDate), 16.sp, FontWeight.SemiBold, Color.White) }
                    Column(horizontalAlignment = Alignment.End) { WalletMeta("Neto estimado"); T(money(p.nextPayEstimatedNet), 16.sp, FontWeight.SemiBold, Color.White) }
                }
            }
            p.latestPayslip?.let { slip ->
                SectionTitle("Comprobante más reciente")
                Card {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) { Muted(mediumDate(slip.payDate)); T(money(slip.net), 28.sp, FontWeight.Bold) }
                        StatusBadge("approved", "Pagado")
                    }
                    Spacer(Modifier.height(16.dp))
                    PortalButton("Ver comprobante", { nav.navigate(Routes.Payslip(slip.id)) }, kind = ButtonKind.Secondary)
                }
            }
            SectionTitle("Explorar")
            ListGroup {
                ListRow("Comprobantes", icon = "💵", divider = false, onClick = { nav.navigate(Routes.Payslips) })
                ListRow("Descuentos", icon = "📊", onClick = { nav.navigate(Routes.Deductions) })
                ListRow("Décimo tercer mes", icon = "🎁", onClick = { nav.navigate(Routes.Decimo) })
            }
            SectionTitle("Historial")
            ListGroup {
                p.history.forEachIndexed { i, h ->
                    ListRow("${monthName(h.month)} ${h.year}", "Bruto ${money(h.gross)}", value = money(h.net), valueStrong = true, divider = i > 0,
                        onClick = { nav.navigate(Routes.Month(h.year, h.month)) })
                }
            }
        }
    }
}

@Composable
fun Breakdown(earnings: List<PayslipLine>, deductions: List<PayslipLine>, gross: Double, totalDeductions: Double, net: Double) {
    SectionTitle("Ingresos")
    Card {
        earnings.forEach { AmountLine(it.description, money(it.amount)) }
        AmountLine("Total", money(gross), bold = true)
    }
    SectionTitle("Descuentos")
    Card {
        deductions.forEach { AmountLine(it.description, "−${money(it.amount)}") }
        AmountLine("Total", "−${money(totalDeductions)}", bold = true)
    }
    Spacer(Modifier.height(24.dp))
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Portal.colors.accentSoft).padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
        T("NETO", 17.sp, FontWeight.SemiBold, Portal.colors.accent, Modifier.weight(1f))
        T(money(net), 28.sp, FontWeight.Bold, Portal.colors.accent)
    }
}

@Composable
fun MonthScreen(route: Routes.Month) {
    val nav = LocalNav.current
    val title = "${monthName(route.month)} ${route.year}"
    val res = rememberResource(route) { month(route.year, route.month) }
    StackScreen(title, { nav.popBackStack() }) {
        LargeTitle(title)
        Load(res) { m ->
            Breakdown(m.earnings, m.deductionLines, m.gross, m.deductions, m.net)
            SectionTitle("Pagos del mes")
            ListGroup {
                m.payslips.forEachIndexed { i, p -> ListRow(mediumDate(p.payDate), value = money(p.net), divider = i > 0, onClick = { nav.navigate(Routes.Payslip(p.id)) }) }
            }
        }
    }
}

@Composable
fun PayslipsScreen() {
    val nav = LocalNav.current
    val res = rememberResource { payslips() }
    StackScreen("Comprobantes", { nav.popBackStack() }) {
        LargeTitle("Comprobantes")
        Load(res) { list ->
            if (list.isEmpty()) Empty("🧾", "Aún no tienes comprobantes")
            list.groupBy { date(it.payDate).year }.forEach { (year, slips) ->
                T("$year", 22.sp, FontWeight.Bold, modifier = Modifier.padding(start = 4.dp, top = 8.dp))
                slips.groupBy { date(it.payDate).month.number }.forEach { (month, inMonth) ->
                    SectionTitle(monthName(month))
                    ListGroup {
                        inMonth.forEachIndexed { i, p ->
                            ListRow(shortDate(p.payDate), if (p.kind == "decimo") "Décimo tercer mes" else "Quincena", icon = if (p.kind == "decimo") "🎁" else "💵",
                                value = money(p.net), valueStrong = true, divider = i > 0, onClick = { nav.navigate(Routes.Payslip(p.id)) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PayslipScreen(id: String) {
    val app = LocalApp.current
    val nav = LocalNav.current
    val res = rememberResource(id) { payslip(id) }
    StackScreen("Comprobante", { nav.popBackStack() }) {
        Load(res) { p ->
            val d = date(p.summary.payDate)
            Column(Modifier.fillMaxWidth().padding(vertical = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Muted("${if (p.summary.kind == "decimo") "Décimo tercer mes" else "Comprobante"} · ${p.summary.number}")
                T("${d.day} ${MONTHS[d.month.number - 1]} ${d.year}", 22.sp, FontWeight.SemiBold, modifier = Modifier.padding(vertical = 8.dp))
                Muted("Neto", 13.sp)
                T(money(p.summary.net), 40.sp, FontWeight.Bold)
                Muted("Período ${mediumDate(p.summary.periodStart)} – ${mediumDate(p.summary.periodEnd)}", 13.sp, Modifier.padding(top = 6.dp))
            }
            val protected = app.biometricEnabled
            PortalButton(if (protected) "🔒  Ver PDF" else "Ver PDF", {
                nav.navigate(Routes.Pdf("Comprobante ${shortDate(p.summary.payDate)}", p.summary.id, "payslip", "/me/payslips/${p.summary.id}/pdf", "comprobante-${p.summary.payDate}.pdf", protected))
            })
            if (protected) Muted("Protegido con ${app.biometric.availableLabel() ?: "biometría"}", 13.sp, Modifier.fillMaxWidth().padding(top = 8.dp))
            Breakdown(p.earnings, p.deductionLines, p.summary.gross, p.summary.deductions, p.summary.net)
        }
    }
}

@Composable
fun DeductionsScreen() {
    val nav = LocalNav.current
    var period by remember { mutableStateOf<Pair<Int, Int>?>(null) }
    var tab by remember { mutableIntStateOf(0) }
    val res = rememberResource(period) { deductions(period?.first, period?.second) }
    StackScreen("Descuentos", { nav.popBackStack() }) {
        LargeTitle("Descuentos")
        Load(res) { d ->
            val history = d.history.reversed()
            val max = (history.maxOfOrNull { it.total } ?: 1.0).coerceAtLeast(1.0)
            Card {
                Muted("Historial · toca un mes", 13.sp)
                Row(Modifier.fillMaxWidth().height(130.dp).padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
                    history.forEach { h ->
                        val current = h.year == d.year && h.month == d.month
                        Column(Modifier.weight(1f).fillMaxHeight().clickable { period = h.year to h.month }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
                            Box(Modifier.fillMaxWidth().fillMaxHeight((h.total / max).toFloat() * 0.82f).clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                                .background(Portal.colors.accent.copy(alpha = if (current) 1f else 0.35f)))
                            T(MONTHS_SHORT[h.month - 1], 10.sp, color = Portal.colors.text2, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }
            }
            Spacer(Modifier.height(20.dp))
            Segmented(listOf("${monthName(d.month)} ${d.year}", "Acumulado ${d.year}"), tab) { tab = it }
            Spacer(Modifier.height(16.dp))
            val items = if (tab == 0) d.items else d.yearToDate
            Card {
                items.forEach { AmountLine(it.description, money(it.amount)) }
                AmountLine("Total", money(items.sumOf { it.amount }), bold = true)
            }
            Muted("CSS 9.75% · Seguro Educativo 1.25% · ISR según tabla progresiva de la DGI.", 13.sp, Modifier.padding(8.dp))
        }
    }
}

@Composable
fun DecimoScreen() {
    val nav = LocalNav.current
    val res = rememberResource { decimo() }
    StackScreen("Décimo", { nav.popBackStack() }) {
        LargeTitle("Décimo")
        Load(res) { d ->
            WalletCard(WalletStyle.Green) {
                WalletLabel("Próximo pago · estimado")
                WalletAmount(money(d.estimatedNet))
                Row(Modifier.fillMaxWidth().padding(top = 16.dp)) {
                    WalletMeta(longDate(d.nextPayDate), Modifier.weight(1f))
                    WalletMeta("Bruto ${money(d.estimatedGross)}")
                }
            }
            Muted("Período ${mediumDate(d.periodStart)} – ${mediumDate(d.periodEnd)}. Se paga en tres partidas (15 de abril, agosto y diciembre), cada una equivale a 1/12 de lo devengado, menos 7.25% de CSS.",
                13.sp, Modifier.padding(8.dp))
            SectionTitle("Historial")
            ListGroup {
                if (d.history.isEmpty()) Empty("🎁", "Sin pagos anteriores")
                d.history.forEachIndexed { i, p -> ListRow(mediumDate(p.payDate), value = money(p.net), valueStrong = true, divider = i > 0, onClick = { nav.navigate(Routes.Payslip(p.id)) }) }
            }
        }
    }
}

/** Full-screen document viewer with native PDF rendering and share sheet. */
@Composable
fun PdfScreen(route: Routes.Pdf) {
    val app = LocalApp.current
    val nav = LocalNav.current
    var bytes by remember { mutableStateOf<ByteArray?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(route) {
        if (route.protect && !app.biometric.authenticate("Ver ${route.title}")) {
            error = "Verificación cancelada."
            return@LaunchedEffect
        }
        runCatching {
            if (route.source == "payslip") app.repository.payslipPdf(route.id)
            else app.repository.download(com.employeeportal.domain.DocumentItem(route.id, "", route.title, route.fileName, "application/pdf", 0, "", route.source, route.downloadUrl))
        }.onSuccess { bytes = it }.onFailure { error = it.userMessage() }
    }

    Column(Modifier.fillMaxSize().background(Portal.colors.bg)) {
        NavBar(route.title, { nav.popBackStack() }) {
            T("Compartir", 15.sp, FontWeight.Medium, if (bytes != null) Portal.colors.accent else Portal.colors.text3,
                Modifier.padding(8.dp).clickableNoRipple { bytes?.let { com.employeeportal.core.platform.shareFile(it, route.fileName, "application/pdf") } })
        }
        when {
            error != null -> Column(Modifier.fillMaxWidth().padding(40.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                T("🔒", 40.sp); Muted(error!!, modifier = Modifier.padding(top = 8.dp))
            }
            bytes == null -> Loading()
            else -> com.employeeportal.core.platform.PdfView(bytes!!, Modifier.fillMaxSize())
        }
    }
}

@Suppress("unused") private val keepAlign = TextAlign.Center

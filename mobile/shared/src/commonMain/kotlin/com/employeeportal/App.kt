package com.employeeportal

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.employeeportal.core.config.AppContainer
import com.employeeportal.core.config.LocalApp
import com.employeeportal.designsystem.*
import com.employeeportal.domain.UserSummary
import com.employeeportal.features.approvals.ApprovalsScreen
import com.employeeportal.features.auth.*
import com.employeeportal.features.home.HomeScreen
import com.employeeportal.features.notifications.NotificationsScreen
import com.employeeportal.features.payroll.*
import com.employeeportal.features.profile.*
import com.employeeportal.features.time.*
import com.employeeportal.navigation.Routes

val LocalNav = staticCompositionLocalOf<NavHostController> { error("NavController not provided") }
val LocalSession = staticCompositionLocalOf<Session> { error("Session not provided") }
val LocalUser = staticCompositionLocalOf<UserSummary> { error("User not provided") }

/** Root composable shared by Android (MainActivity) and iOS (MainViewController). */
@Composable
fun App() {
    val app = remember { AppContainer() }
    val session = remember { Session(app) }
    val toast = remember { ToastState() }
    LaunchedEffect(app.mode) { session.start() }

    PortalTheme {
        CompositionLocalProvider(LocalApp provides app, LocalSession provides session, LocalToast provides toast) {
            Box(Modifier.fillMaxSize().background(Portal.colors.bg)) {
                AnimatedContent(session.state, contentKey = { it::class }) { state ->
                    when (state) {
                        SessionState.Loading -> Loading()
                        SessionState.SignedOut -> LoginScreen(session)
                        is SessionState.Verifying -> MfaScreen(session, state)
                        is SessionState.OfferBiometric -> BiometricOfferScreen(session, state)
                        SessionState.Locked -> LockedScreen(session)
                        is SessionState.SignedIn -> CompositionLocalProvider(LocalUser provides state.user) { MainNavigation() }
                    }
                }
                ToastHost(toast, Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 72.dp))
            }
        }
    }
}

private data class Tab(val route: Any, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab(Routes.Home, "Inicio", PortalIcons.Home),
    Tab(Routes.Payroll, "Payroll", PortalIcons.Wallet),
    Tab(Routes.Time, "Tiempo", PortalIcons.Calendar),
    Tab(Routes.Me, "Yo", PortalIcons.Person),
)

@Composable
private fun MainNavigation() {
    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    val destination = entry?.destination
    val currentTab = tabs.firstOrNull { tab -> destination?.hasRoute(tab.route::class) == true }

    CompositionLocalProvider(LocalNav provides nav) {
        Column(Modifier.fillMaxSize()) {
            NavHost(nav, startDestination = Routes.Home, modifier = Modifier.weight(1f)) {
                composable<Routes.Home> { HomeScreen() }
                composable<Routes.Payroll> { PayrollScreen() }
                composable<Routes.Time> { TimeScreen() }
                composable<Routes.Me> { MeScreen() }

                composable<Routes.Notifications> { NotificationsScreen() }
                composable<Routes.Approvals> { ApprovalsScreen() }
                composable<Routes.Month> { MonthScreen(it.toRoute<Routes.Month>()) }
                composable<Routes.Payslips> { PayslipsScreen() }
                composable<Routes.Payslip> { PayslipScreen(it.toRoute<Routes.Payslip>().id) }
                composable<Routes.Deductions> { DeductionsScreen() }
                composable<Routes.Decimo> { DecimoScreen() }
                composable<Routes.VacationNew> { VacationRequestScreen() }
                composable<Routes.Leave> { LeaveScreen() }
                composable<Routes.LeaveNew> { LeaveRequestScreen() }
                composable<Routes.Personal> { PersonalScreen() }
                composable<Routes.Employment> { EmploymentScreen() }
                composable<Routes.Bank> { BankScreen() }
                composable<Routes.Documents> { DocumentsScreen() }
                composable<Routes.Security> { SecurityScreen() }
                composable<Routes.Pdf> { PdfScreen(it.toRoute<Routes.Pdf>()) }
            }
            if (currentTab != null) TabBar(currentTab) { tab ->
                nav.navigate(tab.route) {
                    popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                    launchSingleTop = true
                    restoreState = true
                }
            }
        }
    }
}

@Composable
private fun TabBar(current: Tab, onSelect: (Tab) -> Unit) {
    val c = Portal.colors
    Column(Modifier.fillMaxWidth().background(c.surface.copy(alpha = 0.96f))) {
        HorizontalDivider(thickness = 0.5.dp, color = c.separator)
        Row(Modifier.fillMaxWidth().navigationBarsPadding().height(58.dp)) {
            tabs.forEach { tab ->
                val selected = tab == current
                Column(
                    Modifier.weight(1f).fillMaxHeight().clickable(remember { MutableInteractionSource() }, indication = null) { onSelect(tab) },
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
                ) {
                    Icon(tab.icon, tab.label, tint = if (selected) c.accent else c.text3, modifier = Modifier.size(26.dp))
                    T(tab.label, 10.5.sp, FontWeight.Medium, if (selected) c.accent else c.text3)
                }
            }
        }
    }
}

/** Maps notification/activity links (shared with the web app) to native routes. */
fun NavHostController.openLink(link: String?) {
    when {
        link == null -> Unit
        link.startsWith("/payroll/payslips/") -> navigate(Routes.Payslip(link.substringAfterLast('/')))
        link.contains("payroll") -> navigate(Routes.Payroll)
        link.contains("leave") -> navigate(Routes.Leave)
        link.contains("time") || link.contains("vacation") -> navigate(Routes.Time)
        link.contains("documents") -> navigate(Routes.Documents)
        link.contains("approvals") -> navigate(Routes.Approvals)
        link.contains("me") -> navigate(Routes.Me)
    }
}

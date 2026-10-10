package com.employeeportal.features.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.RadioButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.employeeportal.core.config.AppConfig
import com.employeeportal.core.config.BackendMode
import com.employeeportal.core.config.LocalApp
import com.employeeportal.designsystem.*
import kotlinx.coroutines.launch

@Composable
private fun AuthLayout(content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier.fillMaxSize().background(Portal.colors.bg).systemBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.Center, content = content,
    )
}

@Composable
private fun AppLogo() {
    Box(Modifier.size(72.dp).clip(RoundedCornerShape(20.dp)).background(Brush.linearGradient(listOf(Color(0xFF0A84FF), Color(0xFF5E5CE6)))), contentAlignment = Alignment.Center) {
        Box(Modifier.size(42.dp, 30.dp).clip(RoundedCornerShape(6.dp)).background(Color.White))
    }
}

@Composable
fun LoginScreen(session: Session) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var user by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var showServers by remember { mutableStateOf(false) }

    AuthLayout {
        AppLogo()
        Spacer(Modifier.height(24.dp))
        T("Bienvenido", 34.sp, FontWeight.Bold)
        Muted("Employee Portal", 17.sp, Modifier.padding(top = 6.dp, bottom = 32.dp))
        TextInput(user, { user = it }, "Email o ID de empleado", keyboardType = KeyboardType.Email)
        Spacer(Modifier.height(12.dp))
        TextInput(password, { password = it }, "Contraseña", password = true)
        error?.let { Spacer(Modifier.height(12.dp)); T(it, 15.sp, color = Portal.colors.danger, align = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
        Spacer(Modifier.height(16.dp))
        PortalButton("Iniciar sesión", enabled = user.isNotBlank() && password.isNotBlank(), loading = busy, onClick = {
            scope.launch {
                busy = true; error = null
                runCatching { session.login(user, password) }.onFailure { error = it.userMessage() }
                busy = false
            }
        })
        Spacer(Modifier.height(8.dp))
        PortalButton("⚙️  Servidor: ${app.mode.label}", { showServers = true }, kind = ButtonKind.Plain)
        Spacer(Modifier.height(24.dp))
        // Tap to fill the demo credentials (employee); long names are hard to type on a phone.
        Box(Modifier.clickableNoRipple { user = "EMP-0001"; password = "Portal2026!" }) {
            Alert("Demo: EMP-0001 (empleado) o laura.mendez@employeeportal.dev (manager) · contraseña Portal2026! — toca aquí para completar", "info")
        }
    }

    if (showServers) {
        Sheet("Servidor", { showServers = false }) {
            ListGroup {
                BackendMode.entries.forEachIndexed { i, mode ->
                    ListRow(
                        title = mode.label,
                        subtitle = AppConfig.urlFor(mode) ?: mode.description,
                        divider = i > 0,
                        trailing = { RadioButton(selected = app.mode == mode, onClick = null) },
                        onClick = { app.switchMode(mode); showServers = false; error = null },
                        chevron = false,
                    )
                }
            }
            Muted("La API real puede tardar hasta un minuto en responder si el servidor gratuito de Render estaba dormido.", 13.sp, Modifier.padding(top = 12.dp))
        }
    }
}

@Composable
fun MfaScreen(session: Session, state: SessionState.Verifying) {
    val scope = rememberCoroutineScope()
    var code by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }

    fun submit(value: String) = scope.launch {
        busy = true; error = null
        runCatching { session.verify(value) }.onFailure { error = it.userMessage(); code = "" }
        busy = false
    }

    AuthLayout {
        T("Verificación", 34.sp, FontWeight.Bold)
        Muted("Introduce el código de 6 dígitos enviado a ${state.challenge.maskedDestination}.", 17.sp, Modifier.padding(top = 6.dp, bottom = 28.dp))
        // One hidden-looking field rendered as six boxes, so paste and SMS autofill work.
        BasicTextField(
            value = code,
            onValueChange = { v -> val d = v.filter { it.isDigit() }.take(6); code = d; if (d.length == 6) submit(d) },
            modifier = Modifier.focusRequester(focus).fillMaxWidth(),
            enabled = !busy,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            textStyle = TextStyle(color = Color.Transparent),
            decorationBox = {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally)) {
                    repeat(6) { i ->
                        val active = i == code.length
                        Box(
                            Modifier.size(48.dp, 60.dp).clip(RoundedCornerShape(14.dp)).background(Portal.colors.surface)
                                .border(if (active) 2.dp else 1.dp, if (active) Portal.colors.accent else Portal.colors.separator, RoundedCornerShape(14.dp)),
                            contentAlignment = Alignment.Center,
                        ) { T(code.getOrNull(i)?.toString() ?: "", 26.sp, FontWeight.SemiBold) }
                    }
                }
            },
        )
        error?.let { T(it, 15.sp, color = Portal.colors.danger, align = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) }
        state.challenge.devCode?.let { Spacer(Modifier.height(20.dp)); Alert("Modo desarrollo — tu código es $it", "info") }
        Spacer(Modifier.height(16.dp))
        PortalButton("Volver", { session.backToLogin() }, kind = ButtonKind.Plain)
    }
}

@Composable
fun BiometricOfferScreen(session: Session, state: SessionState.OfferBiometric) {
    val scope = rememberCoroutineScope()
    AuthLayout {
        Icon(PortalIcons.FaceId, null, tint = Portal.colors.accent, modifier = Modifier.size(96.dp).align(Alignment.CenterHorizontally))
        Spacer(Modifier.height(24.dp))
        T("¿Quieres usar ${state.label} para iniciar sesión?", 28.sp, FontWeight.Bold, align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Muted("Accede más rápido y protege tus comprobantes de pago.", 17.sp, Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 32.dp))
        PortalButton("Activar", { scope.launch { session.enableBiometric(state.user, true) } })
        Spacer(Modifier.height(8.dp))
        PortalButton("Ahora no", { scope.launch { session.enableBiometric(state.user, false) } }, kind = ButtonKind.Plain)
    }
}

@Composable
fun LockedScreen(session: Session) {
    val app = LocalApp.current
    val scope = rememberCoroutineScope()
    var error by remember { mutableStateOf<String?>(null) }
    val label = app.biometric.availableLabel() ?: "biometría"
    fun unlock() = scope.launch { error = session.unlock() }
    LaunchedEffect(Unit) { unlock() }

    AuthLayout {
        Icon(PortalIcons.FaceId, null, tint = Portal.colors.accent, modifier = Modifier.size(96.dp).align(Alignment.CenterHorizontally))
        Spacer(Modifier.height(24.dp))
        T("Employee Portal", 28.sp, FontWeight.Bold, align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Muted("Desbloquea con $label para continuar.", 17.sp, Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 24.dp))
        error?.let { T(it, 15.sp, color = Portal.colors.danger, align = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)) }
        PortalButton("Usar $label", { unlock() })
        Spacer(Modifier.height(8.dp))
        PortalButton("Usar contraseña", { scope.launch { session.logout(forgetBiometric = true) } }, kind = ButtonKind.Plain)
    }
}

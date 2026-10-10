package com.employeeportal.designsystem

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.employeeportal.core.config.LocalApp
import com.employeeportal.data.PortalRepository
import com.employeeportal.domain.ApiException
import kotlinx.coroutines.delay

/** iOS-like navigation bar with back button and optional trailing action. */
@Composable
fun NavBar(title: String, onBack: (() -> Unit)?, action: (@Composable () -> Unit)? = null) {
    val c = Portal.colors
    Box(Modifier.fillMaxWidth().background(c.bg).statusBarsPadding().height(52.dp).padding(horizontal = 8.dp)) {
        if (onBack != null) {
            Row(Modifier.align(Alignment.CenterStart).clip(RoundedCornerShape(8.dp)).clickable(onClick = onBack).padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(PortalIcons.ChevronLeft, null, tint = c.accent, modifier = Modifier.size(22.dp))
                T("Atrás", 17.sp, color = c.accent)
            }
        }
        T(title, 17.sp, FontWeight.SemiBold, modifier = Modifier.align(Alignment.Center).widthIn(max = 220.dp), align = TextAlign.Center, maxLines = 1)
        if (action != null) Box(Modifier.align(Alignment.CenterEnd)) { action() }
    }
}

/** A pushed screen: nav bar + scrollable content. */
@Composable
fun StackScreen(title: String, onBack: () -> Unit, action: (@Composable () -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().background(Portal.colors.bg)) {
        NavBar(title, onBack, action)
        Screen(Modifier.weight(1f), content = content)
    }
}

// ── Loading helper (the mobile equivalent of the web's useResource) ─

class Resource<T>(val data: T?, val error: Throwable?, val reload: () -> Unit)

@Composable
fun <T> rememberResource(vararg keys: Any?, load: suspend PortalRepository.() -> T): Resource<T> {
    val app = LocalApp.current
    var version by remember { mutableIntStateOf(0) }
    var data by remember(*keys) { mutableStateOf<T?>(null) }
    var error by remember(*keys) { mutableStateOf<Throwable?>(null) }
    LaunchedEffect(app.repository, version, *keys) {
        error = null
        runCatching { app.repository.load() }.onSuccess { data = it }.onFailure { error = it }
    }
    return Resource(data, error) { version++ }
}

@Composable
fun <T> Load(res: Resource<T>, content: @Composable (T) -> Unit) {
    when {
        res.error != null -> Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            T("⚠️", 36.sp)
            Muted(res.error.userMessage(), modifier = Modifier.padding(vertical = 8.dp))
            PortalButton("Reintentar", res.reload, kind = ButtonKind.Plain)
        }
        res.data == null -> Loading()
        else -> content(res.data)
    }
}

fun Throwable.userMessage(): String = when (this) {
    is ApiException -> firstError
    else -> "Sin conexión con el servidor. Revisa tu red o el servidor seleccionado."
}

// ── Toasts ──────────────────────────────────────────────────────────

class ToastState { var message by mutableStateOf<String?>(null); fun show(text: String) { message = text } }

val LocalToast = staticCompositionLocalOf { ToastState() }

@Composable
fun ToastHost(state: ToastState, modifier: Modifier = Modifier) {
    val msg = state.message ?: return
    LaunchedEffect(msg) { delay(2600); state.message = null }
    Box(modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.BottomCenter) {
        Box(Modifier.clip(RoundedCornerShape(14.dp)).background(Color(0xEB1D1D1F)).padding(horizontal = 18.dp, vertical = 12.dp)) {
            T(msg, 15.sp, color = Color.White)
        }
    }
}

// ── Bottom sheet-like dialog ────────────────────────────────────────

@Composable
fun Sheet(title: String, onDismiss: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    androidx.compose.material3.ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Portal.colors.bg) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 32.dp).navigationBarsPadding()) {
            T(title, 20.sp, FontWeight.Bold, modifier = Modifier.padding(bottom = 16.dp))
            content()
        }
    }
}

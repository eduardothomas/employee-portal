package com.employeeportal.core.config

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import com.employeeportal.core.platform.BiometricAuthenticator
import com.employeeportal.core.platform.KeyValueStore
import com.employeeportal.core.platform.PlatformInfo
import com.employeeportal.data.PortalRepository
import com.employeeportal.data.api.ApiPortalRepository
import com.employeeportal.data.demo.DemoPortalRepository

/**
 * Which backend the app talks to. Chosen at runtime on the login screen ("Servidor")
 * and remembered between launches.
 */
enum class BackendMode(val label: String, val description: String) {
    Demo("Demo", "Datos ficticios dentro del app, sin servidor"),
    Local("API local", "API corriendo en tu Mac (puerto 5080)"),
    Remote("Render", "API desplegada en la nube"),
}

object AppConfig {
    /** Default backend on first launch. */
    val defaultMode = BackendMode.Demo

    /** Production API (Render). Change here if the API moves. */
    const val REMOTE_API_URL = "https://employee-portal-api.onrender.com"

    fun urlFor(mode: BackendMode) = when (mode) {
        BackendMode.Demo -> null
        BackendMode.Local -> PlatformInfo.localApiUrl
        BackendMode.Remote -> REMOTE_API_URL
    }
}

/** Manual dependency container — small enough that a DI framework would be overkill. */
class AppContainer {
    val store = KeyValueStore()
    val biometric = BiometricAuthenticator()

    var mode by mutableStateOf(store.get(MODE_KEY)?.let { runCatching { BackendMode.valueOf(it) }.getOrNull() } ?: AppConfig.defaultMode)
        private set

    var repository: PortalRepository = build(mode)
        private set

    fun switchMode(newMode: BackendMode) {
        store.set(MODE_KEY, newMode.name)
        mode = newMode
        repository = build(newMode)
    }

    /** Local unlock preference (per device), separate from the server-side flag. */
    var biometricEnabled: Boolean
        get() = store.get(BIOMETRIC_KEY) == "1"
        set(value) = if (value) store.set(BIOMETRIC_KEY, "1") else store.remove(BIOMETRIC_KEY)

    var hideAmounts: Boolean
        get() = store.get(HIDE_KEY) == "1"
        set(value) = if (value) store.set(HIDE_KEY, "1") else store.remove(HIDE_KEY)

    private fun build(mode: BackendMode): PortalRepository =
        AppConfig.urlFor(mode)?.let { ApiPortalRepository(it, store) } ?: DemoPortalRepository(store)

    private companion object {
        const val MODE_KEY = "app.backendMode"
        const val BIOMETRIC_KEY = "app.biometric"
        const val HIDE_KEY = "app.hideAmounts"
    }
}

val LocalApp = staticCompositionLocalOf<AppContainer> { error("AppContainer not provided") }

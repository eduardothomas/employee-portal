package com.employeeportal.features.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.employeeportal.core.config.AppContainer
import com.employeeportal.domain.LoginResponse
import com.employeeportal.domain.UserSummary

sealed interface SessionState {
    data object Loading : SessionState
    data object SignedOut : SessionState
    data class Verifying(val challenge: LoginResponse) : SessionState
    /** Remembered session protected by Face ID / fingerprint. */
    data object Locked : SessionState
    data class OfferBiometric(val user: UserSummary, val label: String) : SessionState
    data class SignedIn(val user: UserSummary) : SessionState
}

/** Owns the authentication state machine; screens only call these methods. */
class Session(private val app: AppContainer) {
    var state by mutableStateOf<SessionState>(SessionState.Loading)
        private set

    private val repo get() = app.repository

    suspend fun start() {
        state = when {
            !repo.hasRememberedSession() -> SessionState.SignedOut
            app.biometricEnabled -> SessionState.Locked
            else -> repo.restoreSession()?.let { SessionState.SignedIn(it) } ?: SessionState.SignedOut
        }
    }

    suspend fun login(login: String, password: String) {
        state = SessionState.Verifying(repo.login(login, password))
    }

    suspend fun verify(code: String) {
        val challenge = (state as? SessionState.Verifying)?.challenge ?: return
        val user = repo.verifyMfa(challenge.challengeId, code)
        val label = app.biometric.availableLabel()
        state = if (label != null && !app.biometricEnabled) SessionState.OfferBiometric(user, label) else SessionState.SignedIn(user)
    }

    suspend fun enableBiometric(user: UserSummary, enable: Boolean) {
        if (enable && app.biometric.authenticate("Activa el acceso rápido y protege tus comprobantes")) {
            app.biometricEnabled = true
            runCatching { repo.setBiometric(true) }
        }
        state = SessionState.SignedIn(user)
    }

    /** Returns an error message, or null on success. */
    suspend fun unlock(): String? {
        val label = app.biometric.availableLabel() ?: "biometría"
        if (!app.biometric.authenticate("Desbloquea Employee Portal")) return "No se pudo verificar con $label."
        val user = repo.restoreSession() ?: run { state = SessionState.SignedOut; return "Tu sesión expiró. Inicia sesión nuevamente." }
        state = SessionState.SignedIn(user)
        return null
    }

    fun backToLogin() { state = SessionState.SignedOut }

    suspend fun logout(forgetBiometric: Boolean = false) {
        runCatching { repo.logout() }
        if (forgetBiometric) app.biometricEnabled = false
        state = SessionState.SignedOut
    }
}

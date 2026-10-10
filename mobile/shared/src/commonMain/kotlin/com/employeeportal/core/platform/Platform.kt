package com.employeeportal.core.platform

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/** Small persistent key/value storage (SharedPreferences on Android, NSUserDefaults on iOS). */
expect class KeyValueStore() {
    fun get(key: String): String?
    fun set(key: String, value: String)
    fun remove(key: String)
}

/** Face ID / Touch ID on iOS (LocalAuthentication), BiometricPrompt on Android. */
expect class BiometricAuthenticator() {
    /** "Face ID", "Touch ID", "huella" … or null when the device has no usable biometrics. */
    fun availableLabel(): String?
    suspend fun authenticate(reason: String): Boolean
}

expect object PlatformInfo {
    val name: String
    /** URL of an API running on the developer's machine, as seen from the emulator/simulator. */
    val localApiUrl: String
}

/** Opens the system share sheet for a file (save to Files, AirDrop, email…). */
expect fun shareFile(bytes: ByteArray, fileName: String, mimeType: String)

/** Native PDF rendering: PDFKit on iOS, PdfRenderer on Android. */
@Composable
expect fun PdfView(bytes: ByteArray, modifier: Modifier)

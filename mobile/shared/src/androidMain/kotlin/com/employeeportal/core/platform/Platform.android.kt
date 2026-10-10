package com.employeeportal.core.platform

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.produceState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.File
import java.lang.ref.WeakReference
import kotlin.coroutines.resume

/** Holds the current activity (biometrics, share sheet) and app context (storage). */
object AndroidPlatform {
    private var activityRef = WeakReference<FragmentActivity>(null)
    lateinit var appContext: Context
        private set
    var fileProviderAuthority: String = ""
        private set

    val activity: FragmentActivity? get() = activityRef.get()

    fun attach(activity: FragmentActivity, fileProviderAuthority: String) {
        activityRef = WeakReference(activity)
        appContext = activity.applicationContext
        this.fileProviderAuthority = fileProviderAuthority
    }

    fun detach(activity: FragmentActivity) {
        if (activityRef.get() === activity) activityRef = WeakReference(null)
    }
}

actual class KeyValueStore actual constructor() {
    private val prefs by lazy { AndroidPlatform.appContext.getSharedPreferences("employee_portal", Context.MODE_PRIVATE) }
    actual fun get(key: String): String? = prefs.getString(key, null)
    actual fun set(key: String, value: String) = prefs.edit().putString(key, value).apply()
    actual fun remove(key: String) = prefs.edit().remove(key).apply()
}

actual class BiometricAuthenticator actual constructor() {
    private val allowed = BIOMETRIC_STRONG or BIOMETRIC_WEAK

    actual fun availableLabel(): String? {
        val activity = AndroidPlatform.activity ?: return null
        return if (BiometricManager.from(activity).canAuthenticate(allowed) == BiometricManager.BIOMETRIC_SUCCESS) "huella o rostro" else null
    }

    actual suspend fun authenticate(reason: String): Boolean {
        val activity = AndroidPlatform.activity ?: return false
        return suspendCancellableCoroutine { cont ->
            val prompt = BiometricPrompt(activity, ContextCompat.getMainExecutor(activity), object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { if (cont.isActive) cont.resume(true) }
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) { if (cont.isActive) cont.resume(false) }
            })
            val info = BiometricPrompt.PromptInfo.Builder()
                .setTitle("Employee Portal")
                .setSubtitle(reason)
                .setAllowedAuthenticators(allowed)
                .setNegativeButtonText("Cancelar")
                .build()
            prompt.authenticate(info)
            cont.invokeOnCancellation { prompt.cancelAuthentication() }
        }
    }
}

actual object PlatformInfo {
    actual val name: String = "Android"
    actual val localApiUrl: String = "http://10.0.2.2:5080"
}

private fun writeTemp(bytes: ByteArray, fileName: String): File {
    val dir = File(AndroidPlatform.appContext.cacheDir, "documents").apply { mkdirs() }
    return File(dir, fileName).apply { writeBytes(bytes) }
}

actual fun shareFile(bytes: ByteArray, fileName: String, mimeType: String) {
    val activity = AndroidPlatform.activity ?: return
    val uri = FileProvider.getUriForFile(activity, AndroidPlatform.fileProviderAuthority, writeTemp(bytes, fileName))
    val send = Intent(Intent.ACTION_SEND).apply {
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    activity.startActivity(Intent.createChooser(send, fileName))
}

@Composable
actual fun PdfView(bytes: ByteArray, modifier: Modifier) {
    val pages = produceState<List<ImageBitmap>>(emptyList(), bytes) {
        value = withContext(Dispatchers.IO) { renderPdf(bytes) }
    }
    LazyColumn(
        modifier = modifier.background(androidx.compose.ui.graphics.Color(0xFF3A3A3C)),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(pages.value) { page ->
            Image(bitmap = page, contentDescription = null, contentScale = ContentScale.FillWidth, modifier = Modifier.fillMaxWidth())
        }
    }
}

private fun renderPdf(bytes: ByteArray): List<ImageBitmap> {
    val file = writeTemp(bytes, "preview.pdf")
    ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { fd ->
        PdfRenderer(fd).use { renderer ->
            return (0 until renderer.pageCount).map { i ->
                renderer.openPage(i).use { page ->
                    val scale = 2
                    val bitmap = Bitmap.createBitmap(page.width * scale, page.height * scale, Bitmap.Config.ARGB_8888)
                    bitmap.eraseColor(Color.WHITE)
                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    bitmap.asImageBitmap()
                }
            }
        }
    }
}

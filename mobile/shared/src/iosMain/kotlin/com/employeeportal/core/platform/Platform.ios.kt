package com.employeeportal.core.platform

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.UIKitView
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.usePinned
import kotlinx.coroutines.suspendCancellableCoroutine
import platform.Foundation.NSData
import platform.Foundation.NSTemporaryDirectory
import platform.Foundation.NSURL
import platform.Foundation.NSUserDefaults
import platform.Foundation.create
import platform.Foundation.writeToURL
import platform.LocalAuthentication.LABiometryTypeFaceID
import platform.LocalAuthentication.LABiometryTypeOpticID
import platform.LocalAuthentication.LABiometryTypeTouchID
import platform.LocalAuthentication.LAContext
import platform.LocalAuthentication.LAPolicyDeviceOwnerAuthenticationWithBiometrics
import platform.PDFKit.PDFDocument
import platform.PDFKit.PDFView
import platform.UIKit.UIActivityViewController
import platform.UIKit.UIApplication
import platform.UIKit.UIColor
import platform.UIKit.UIViewController
import platform.UIKit.UIWindow
import platform.UIKit.UIWindowScene
import kotlin.coroutines.resume

actual class KeyValueStore actual constructor() {
    private val defaults = NSUserDefaults.standardUserDefaults
    actual fun get(key: String): String? = defaults.stringForKey(key)
    actual fun set(key: String, value: String) = defaults.setObject(value, forKey = key)
    actual fun remove(key: String) = defaults.removeObjectForKey(key)
}

@OptIn(ExperimentalForeignApi::class)
actual class BiometricAuthenticator actual constructor() {
    actual fun availableLabel(): String? {
        val context = LAContext()
        if (!context.canEvaluatePolicy(LAPolicyDeviceOwnerAuthenticationWithBiometrics, error = null)) return null
        return when (context.biometryType) {
            LABiometryTypeFaceID -> "Face ID"
            LABiometryTypeTouchID -> "Touch ID"
            LABiometryTypeOpticID -> "Optic ID"
            else -> null
        }
    }

    actual suspend fun authenticate(reason: String): Boolean = suspendCancellableCoroutine { cont ->
        LAContext().evaluatePolicy(LAPolicyDeviceOwnerAuthenticationWithBiometrics, localizedReason = reason) { success, _ ->
            if (cont.isActive) cont.resume(success)
        }
    }
}

actual object PlatformInfo {
    actual val name: String = "iOS"
    actual val localApiUrl: String = "http://127.0.0.1:5080"
}

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
private fun ByteArray.toNSData(): NSData = usePinned { NSData.create(bytes = it.addressOf(0), length = size.toULong()) }

private fun topViewController(): UIViewController? {
    val window = UIApplication.sharedApplication.connectedScenes
        .filterIsInstance<UIWindowScene>()
        .flatMap { scene -> scene.windows.filterIsInstance<UIWindow>() }
        .firstOrNull { it.isKeyWindow() }
    var top = window?.rootViewController
    while (top?.presentedViewController != null) top = top.presentedViewController
    return top
}

actual fun shareFile(bytes: ByteArray, fileName: String, mimeType: String) {
    val url = NSURL.fileURLWithPath(NSTemporaryDirectory() + fileName)
    bytes.toNSData().writeToURL(url, atomically = true)
    val sheet = UIActivityViewController(activityItems = listOf(url), applicationActivities = null)
    topViewController()?.presentViewController(sheet, animated = true, completion = null)
}

@OptIn(ExperimentalForeignApi::class)
@Composable
actual fun PdfView(bytes: ByteArray, modifier: Modifier) {
    UIKitView(
        factory = {
            PDFView().apply {
                autoScales = true
                backgroundColor = UIColor.colorWithRed(0.23, green = 0.23, blue = 0.24, alpha = 1.0)
                document = PDFDocument(data = bytes.toNSData())
            }
        },
        modifier = modifier,
    )
}

package com.employeeportal.android

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.fragment.app.FragmentActivity
import com.employeeportal.App
import com.employeeportal.core.platform.AndroidPlatform

/** FragmentActivity (not ComponentActivity) because BiometricPrompt requires it. */
class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        AndroidPlatform.attach(this, fileProviderAuthority = "$packageName.files")
        setContent { App() }
    }

    override fun onDestroy() {
        AndroidPlatform.detach(this)
        super.onDestroy()
    }
}

package com.employeeportal

import androidx.compose.ui.window.ComposeUIViewController
import platform.UIKit.UIViewController

/** Called from SwiftUI (iosApp/ContentView.swift). */
fun MainViewController(): UIViewController = ComposeUIViewController { App() }

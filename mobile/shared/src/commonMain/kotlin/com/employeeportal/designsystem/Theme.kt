package com.employeeportal.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/** Design tokens shared with the web app ("Apple / Premium"). */
@Immutable
data class PortalColors(
    val bg: Color,
    val surface: Color,
    val surface2: Color,
    val text: Color,
    val text2: Color,
    val text3: Color,
    val separator: Color,
    val accent: Color,
    val accentSoft: Color,
    val success: Color,
    val successSoft: Color,
    val warning: Color,
    val warningSoft: Color,
    val danger: Color,
    val dangerSoft: Color,
    val wallet1: Color,
    val wallet2: Color,
    val isDark: Boolean,
)

private val Light = PortalColors(
    bg = Color(0xFFF5F5F7), surface = Color.White, surface2 = Color(0xFFF2F2F7), text = Color(0xFF1D1D1F),
    text2 = Color(0xFF6E6E73), text3 = Color(0xFFAEAEB2), separator = Color(0x1F3C3C43), accent = Color(0xFF0071E3),
    accentSoft = Color(0x1A0071E3), success = Color(0xFF248A3D), successSoft = Color(0x2434C759), warning = Color(0xFFB25000),
    warningSoft = Color(0x29FF9F0A), danger = Color(0xFFD70015), dangerSoft = Color(0x1FFF3B30),
    wallet1 = Color(0xFF1D1D1F), wallet2 = Color(0xFF3A3A3C), isDark = false,
)

private val Dark = PortalColors(
    bg = Color.Black, surface = Color(0xFF1C1C1E), surface2 = Color(0xFF2C2C2E), text = Color(0xFFF5F5F7),
    text2 = Color(0xFF98989D), text3 = Color(0xFF636366), separator = Color(0x73545458), accent = Color(0xFF2997FF),
    accentSoft = Color(0x292997FF), success = Color(0xFF30D158), successSoft = Color(0x2930D158), warning = Color(0xFFFFB340),
    warningSoft = Color(0x29FFB340), danger = Color(0xFFFF6961), dangerSoft = Color(0x29FF453A),
    wallet1 = Color(0xFF2C2C2E), wallet2 = Color(0xFF48484A), isDark = true,
)

val LocalPortalColors = staticCompositionLocalOf { Light }

object Portal {
    val colors: PortalColors @Composable get() = LocalPortalColors.current
}

@Composable
fun PortalTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val c = if (dark) Dark else Light
    val material = if (dark) darkColorScheme(primary = c.accent, background = c.bg, surface = c.surface, onSurface = c.text, onBackground = c.text)
    else lightColorScheme(primary = c.accent, background = c.bg, surface = c.surface, onSurface = c.text, onBackground = c.text)
    CompositionLocalProvider(LocalPortalColors provides c) {
        MaterialTheme(colorScheme = material, content = content)
    }
}

package com.employeeportal.designsystem

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.runtime.remember
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.employeeportal.core.format.STATUS_LABEL
import com.employeeportal.core.format.initials

// ── Typography ──────────────────────────────────────────────────────

@Composable
fun T(
    text: String, size: TextUnit = 17.sp, weight: FontWeight = FontWeight.Normal, color: Color = Portal.colors.text,
    modifier: Modifier = Modifier, align: TextAlign? = null, maxLines: Int = Int.MAX_VALUE,
) = Text(text, modifier, color = color, fontSize = size, fontWeight = weight, textAlign = align, maxLines = maxLines, overflow = TextOverflow.Ellipsis)

@Composable fun LargeTitle(text: String) = T(text, 34.sp, FontWeight.Bold, modifier = Modifier.padding(top = 12.dp, bottom = 20.dp))
@Composable fun Muted(text: String, size: TextUnit = 15.sp, modifier: Modifier = Modifier) = T(text, size, color = Portal.colors.text2, modifier = modifier)

@Composable
fun SectionTitle(text: String, action: (@Composable () -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(start = 4.dp, end = 4.dp, top = 28.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        T(text.uppercase(), 13.sp, FontWeight.SemiBold, Portal.colors.text2, Modifier.weight(1f))
        action?.invoke()
    }
}

// ── Surfaces ────────────────────────────────────────────────────────

@Composable
fun Screen(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.fillMaxSize().background(Portal.colors.bg).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 32.dp), content = content)
}

private fun Modifier.cardShadow(dark: Boolean, radius: Dp) = if (dark) this else shadow(6.dp, RoundedCornerShape(radius), ambientColor = Color(0x14000000), spotColor = Color(0x14000000))

@Composable
fun Card(modifier: Modifier = Modifier, padding: Dp = 20.dp, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    val c = Portal.colors
    Column(
        modifier.fillMaxWidth().cardShadow(c.isDark, 20.dp).clip(RoundedCornerShape(20.dp)).background(c.surface)
            .let { if (onClick != null) it.clickable(onClick = onClick) else it }.padding(padding),
        content = content,
    )
}

@Composable
fun ListGroup(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val c = Portal.colors
    Column(modifier.fillMaxWidth().cardShadow(c.isDark, 20.dp).clip(RoundedCornerShape(20.dp)).background(c.surface), content = content)
}

/** iOS-style table row. Put several inside a [ListGroup]; pass divider=false for the first row. */
@Composable
fun ListRow(
    title: String, subtitle: String? = null, icon: String? = null, value: String? = null, valueStrong: Boolean = false,
    divider: Boolean = true, chevron: Boolean? = null, trailing: (@Composable () -> Unit)? = null, titleColor: Color? = null,
    onClick: (() -> Unit)? = null,
) {
    val c = Portal.colors
    Column {
        if (divider) HorizontalDivider(Modifier.padding(start = if (icon != null) 62.dp else 16.dp), thickness = 0.5.dp, color = c.separator)
        androidx.compose.foundation.layout.Row(
            Modifier.fillMaxWidth().let { if (onClick != null) it.clickable(onClick = onClick) else it }.heightIn(min = 52.dp).padding(horizontal = 16.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (icon != null) {
                Box(Modifier.size(32.dp).clip(RoundedCornerShape(9.dp)).background(c.surface2), contentAlignment = Alignment.Center) { T(icon, 17.sp) }
                Spacer(Modifier.width(14.dp))
            }
            Column(Modifier.weight(1f)) {
                T(title, color = titleColor ?: c.text, maxLines = 1)
                if (subtitle != null) T(subtitle, 14.sp, color = c.text2, maxLines = 2)
            }
            if (value != null) T(value, 16.sp, if (valueStrong) FontWeight.SemiBold else FontWeight.Normal, if (valueStrong) c.text else c.text2, Modifier.padding(start = 8.dp))
            trailing?.let { Spacer(Modifier.width(8.dp)); it() }
            if (chevron ?: (onClick != null)) {
                Spacer(Modifier.width(6.dp))
                Icon(PortalIcons.ChevronRight, null, tint = c.text3, modifier = Modifier.size(16.dp))
            }
        }
    }
}

/** Wallet-style gradient card for money. */
@Composable
fun WalletCard(style: WalletStyle = WalletStyle.Dark, content: @Composable ColumnScope.() -> Unit) {
    val c = Portal.colors
    val colors = when (style) {
        WalletStyle.Dark -> listOf(c.wallet1, c.wallet2)
        WalletStyle.Blue -> listOf(Color(0xFF0A63D6), Color(0xFF5E5CE6))
        WalletStyle.Green -> listOf(Color(0xFF0F7B3D), Color(0xFF30B360))
    }
    Column(
        Modifier.fillMaxWidth().shadow(16.dp, RoundedCornerShape(24.dp), spotColor = Color(0x66000000)).clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(colors)).padding(22.dp).heightIn(min = 150.dp),
        verticalArrangement = Arrangement.SpaceBetween, content = content,
    )
}

enum class WalletStyle { Dark, Blue, Green }

@Composable fun WalletLabel(text: String) = T(text.uppercase(), 12.sp, FontWeight.SemiBold, Color.White.copy(alpha = 0.7f))
@Composable fun WalletAmount(text: String) = T(text, 38.sp, FontWeight.Bold, Color.White, Modifier.padding(top = 4.dp))
@Composable fun WalletMeta(text: String, modifier: Modifier = Modifier) = T(text, 15.sp, color = Color.White.copy(alpha = 0.8f), modifier = modifier)

// ── Controls ────────────────────────────────────────────────────────

enum class ButtonKind { Primary, Secondary, Plain, Danger }

@Composable
fun PortalButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, kind: ButtonKind = ButtonKind.Primary, enabled: Boolean = true, loading: Boolean = false) {
    val c = Portal.colors
    val (bg, fg) = when (kind) {
        ButtonKind.Primary -> c.accent to Color.White
        ButtonKind.Secondary -> c.accentSoft to c.accent
        ButtonKind.Plain -> Color.Transparent to c.accent
        ButtonKind.Danger -> c.dangerSoft to c.danger
    }
    val alpha by animateFloatAsState(if (enabled && !loading) 1f else 0.4f)
    Box(
        modifier.fillMaxWidth().heightIn(min = 50.dp).clip(RoundedCornerShape(14.dp)).background(bg.copy(alpha = bg.alpha * alpha))
            .clickable(enabled = enabled && !loading, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (loading) CircularProgressIndicator(Modifier.size(20.dp), color = fg, strokeWidth = 2.dp)
        else T(text, 17.sp, FontWeight.SemiBold, fg.copy(alpha = alpha))
    }
}

@Composable
fun TextInput(
    value: String, onValueChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier,
    password: Boolean = false, keyboardType: KeyboardType = KeyboardType.Text, singleLine: Boolean = true,
) {
    val c = Portal.colors
    BasicTextField(
        value, onValueChange, modifier.fillMaxWidth(),
        textStyle = TextStyle(color = c.text, fontSize = 17.sp), singleLine = singleLine, cursorBrush = SolidColor(c.accent),
        visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboardType),
        decorationBox = { inner ->
            Box(Modifier.heightIn(min = 54.dp).clip(RoundedCornerShape(14.dp)).background(c.surface).border(1.dp, c.separator, RoundedCornerShape(14.dp)).padding(horizontal = 16.dp, vertical = 15.dp)) {
                if (value.isEmpty()) T(placeholder, color = c.text3)
                inner()
            }
        },
    )
}

/** Labeled field inside a grouped form (like iOS Settings). */
@Composable
fun FormField(label: String, value: String, onValueChange: (String) -> Unit, divider: Boolean = true, keyboardType: KeyboardType = KeyboardType.Text, singleLine: Boolean = true, error: String? = null) {
    val c = Portal.colors
    Column {
        if (divider) HorizontalDivider(Modifier.padding(start = 16.dp), thickness = 0.5.dp, color = c.separator)
        Column(Modifier.padding(horizontal = 16.dp, vertical = 10.dp)) {
            T(label, 13.sp, color = c.text2)
            BasicTextField(value, onValueChange, Modifier.fillMaxWidth().padding(top = 2.dp), textStyle = TextStyle(color = c.text, fontSize = 17.sp),
                singleLine = singleLine, cursorBrush = SolidColor(c.accent), keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                minLines = if (singleLine) 1 else 3)
            if (error != null) T(error, 13.sp, color = c.danger)
        }
    }
}

@Composable
fun Segmented(options: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    val c = Portal.colors
    androidx.compose.foundation.layout.Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(c.surface2).padding(2.dp)) {
        options.forEachIndexed { i, label ->
            Box(
                Modifier.weight(1f).clip(RoundedCornerShape(8.dp)).background(if (i == selected) c.surface else Color.Transparent).clickable { onSelect(i) }.padding(vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) { T(label, 14.sp, if (i == selected) FontWeight.SemiBold else FontWeight.Medium) }
        }
    }
}

// ── Status & misc ───────────────────────────────────────────────────

@Composable
fun StatusBadge(status: String, label: String? = null) {
    val c = Portal.colors
    val (bg, fg) = when (status) {
        "pending" -> c.warningSoft to c.warning
        "approved", "active" -> c.successSoft to c.success
        "rejected", "cancelled" -> c.dangerSoft to c.danger
        else -> c.surface2 to c.text2
    }
    Box(Modifier.clip(CircleShape).background(bg).padding(horizontal = 9.dp, vertical = 3.dp)) {
        T(label ?: STATUS_LABEL[status] ?: status, 12.sp, FontWeight.SemiBold, fg)
    }
}

@Composable
fun Avatar(name: String, size: Dp = 40.dp) {
    Box(Modifier.size(size).clip(CircleShape).background(Brush.linearGradient(listOf(Color(0xFF0A84FF), Color(0xFF5E5CE6)))), contentAlignment = Alignment.Center) {
        T(initials(name), (size.value * 0.38f).sp, FontWeight.SemiBold, Color.White)
    }
}

@Composable
fun ProgressBar(fraction: Float, modifier: Modifier = Modifier) {
    val animated by animateFloatAsState(fraction.coerceIn(0f, 1f))
    Box(modifier.fillMaxWidth().height(8.dp).clip(CircleShape).background(Portal.colors.surface2)) {
        Box(Modifier.fillMaxWidth(animated).fillMaxHeight().clip(CircleShape).background(Brush.horizontalGradient(listOf(Color(0xFF0A84FF), Color(0xFF5E5CE6)))))
    }
}

@Composable
fun Stat(value: String, label: String, modifier: Modifier = Modifier, accent: Boolean = false) {
    val c = Portal.colors
    Column(modifier.cardShadow(c.isDark, 16.dp).clip(RoundedCornerShape(16.dp)).background(c.surface).padding(14.dp)) {
        T(value, 28.sp, FontWeight.Bold, if (accent) c.accent else c.text)
        T(label, 13.sp, color = c.text2)
    }
}

@Composable
fun Empty(emoji: String, text: String) {
    Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        T(emoji, 40.sp)
        Spacer(Modifier.height(8.dp))
        Muted(text)
    }
}

@Composable
fun Loading() = Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) {
    CircularProgressIndicator(Modifier.size(28.dp), color = Portal.colors.accent, strokeWidth = 3.dp)
}

@Composable
fun Alert(text: String, kind: String = "error") {
    val c = Portal.colors
    val (bg, fg) = when (kind) { "info" -> c.accentSoft to c.accent; "warn" -> c.warningSoft to c.warning; else -> c.dangerSoft to c.danger }
    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(bg).padding(horizontal = 14.dp, vertical = 12.dp)) { T(text, 15.sp, color = fg) }
}

/** Two-column amounts table used by payslip/month breakdowns. */
@Composable
fun AmountLine(label: String, amount: String, bold: Boolean = false) {
    androidx.compose.foundation.layout.Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        T(label, 16.sp, if (bold) FontWeight.Bold else FontWeight.Normal, modifier = Modifier.weight(1f))
        T(amount, 16.sp, if (bold) FontWeight.Bold else FontWeight.Normal)
    }
}

fun Modifier.clickableNoRipple(onClick: () -> Unit): Modifier = composed {
    clickable(remember { androidx.compose.foundation.interaction.MutableInteractionSource() }, indication = null, onClick = onClick)
}

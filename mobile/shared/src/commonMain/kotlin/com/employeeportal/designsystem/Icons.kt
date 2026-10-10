package com.employeeportal.designsystem

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

/** Line icons drawn from the same SVG paths as the web app (no icon library needed). */
object PortalIcons {
    private fun icon(name: String, vararg paths: String, size: Float = 24f) =
        ImageVector.Builder(name, 24.dp, 24.dp, size, size).apply {
            paths.forEach {
                addPath(
                    pathData = addPathNodes(it), stroke = SolidColor(Color.Black), strokeLineWidth = 1.8f,
                    strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round,
                )
            }
        }.build()

    val Home = icon("home", "M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z")
    val Wallet = icon("wallet", "M6 6h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z", "M3 10h18M16 15h2", "M6 6V5a2 2 0 0 1 2-2h8")
    val Calendar = icon("calendar", "M6 5h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z", "M3 10h18M8 3v4M16 3v4")
    val Person = icon("person", "M12 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8z", "M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5")
    val Bell = icon("bell", "M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9M10 19a2 2 0 0 0 4 0")
    val ChevronRight = icon("chevronRight", "M9 5l7 7-7 7")
    val ChevronLeft = icon("chevronLeft", "M15 5l-7 7 7 7")
    val Eye = icon("eye", "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12", "M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6z")
    val EyeOff = icon("eyeOff", "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12", "M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6z", "M3 3l18 18")
    val FaceId = icon("faceId", "M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2", "M9 9v1.5M15 9v1.5M12 9v4h-1M9 15.5c1.7 1.3 4.3 1.3 6 0")
}

package seven.companion.ui.theme

import androidx.compose.foundation.shape.CornerBasedShape
import androidx.compose.foundation.shape.CornerSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily

private val square: CornerBasedShape = RoundedCornerShape(CornerSize(0))

private val colors = darkColorScheme(
    primary = Palette.accent,
    onPrimary = Palette.bg,
    secondary = Palette.cyan,
    onSecondary = Palette.bg,
    background = Palette.bg,
    onBackground = Palette.text,
    surface = Palette.panel,
    onSurface = Palette.text,
    surfaceVariant = Palette.card,
    onSurfaceVariant = Palette.dim,
    surfaceContainer = Palette.panel,
    surfaceContainerHigh = Palette.card,
    surfaceContainerHighest = Palette.card,
    outline = Palette.line,
    outlineVariant = Palette.faint,
    error = Palette.alert,
    onError = Palette.bg,
)

private fun TextStyle.mono(): TextStyle = copy(fontFamily = FontFamily.Monospace)

private val typography = Typography().run {
    Typography(
        displayLarge = displayLarge.mono(), displayMedium = displayMedium.mono(), displaySmall = displaySmall.mono(),
        headlineLarge = headlineLarge.mono(), headlineMedium = headlineMedium.mono(), headlineSmall = headlineSmall.mono(),
        titleLarge = titleLarge.mono(), titleMedium = titleMedium.mono(), titleSmall = titleSmall.mono(),
        bodyLarge = bodyLarge.mono(), bodyMedium = bodyMedium.mono(), bodySmall = bodySmall.mono(),
        labelLarge = labelLarge.mono(), labelMedium = labelMedium.mono(), labelSmall = labelSmall.mono(),
    )
}

@Composable
fun SevenTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = colors,
        typography = typography,
        shapes = Shapes(square, square, square, square, square),
        content = content,
    )
}

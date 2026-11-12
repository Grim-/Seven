package seven.companion.ui.theme

import androidx.compose.ui.graphics.Color

enum class Tone(val color: Color) {
    Plain(Palette.text),
    Dim(Palette.dim),
    Accent(Palette.accent),
    Info(Palette.cyan),
    Alert(Palette.alert),
    Ok(Palette.ok),
}

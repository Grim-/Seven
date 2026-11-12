package seven.companion.ui.components

import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import seven.companion.ui.theme.Palette

fun Modifier.topRule(color: Color = Palette.line, width: Dp = 1.dp): Modifier = drawBehind {
    drawLine(color, Offset(0f, 0f), Offset(size.width, 0f), width.toPx())
}

fun Modifier.bottomRule(color: Color = Palette.line, width: Dp = 1.dp): Modifier = drawBehind {
    drawLine(color, Offset(0f, size.height), Offset(size.width, size.height), width.toPx())
}

fun Modifier.leftRule(color: Color = Palette.accent, width: Dp = 2.dp): Modifier = drawBehind {
    drawLine(color, Offset(0f, 0f), Offset(0f, size.height), width.toPx())
}

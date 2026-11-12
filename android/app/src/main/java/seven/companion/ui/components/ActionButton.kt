package seven.companion.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import seven.companion.ui.theme.Palette

@Composable
fun ActionButton(action: Action, modifier: Modifier = Modifier) {
    val color = if (action.enabled) action.tone.color else Palette.faint
    OutlinedButton(
        onClick = action.run,
        modifier = modifier,
        enabled = action.enabled,
        border = BorderStroke(1.dp, color),
        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 10.dp),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = color, disabledContentColor = color),
    ) {
        Text(action.label.uppercase(), style = MaterialTheme.typography.labelLarge, textAlign = TextAlign.Center)
    }
}

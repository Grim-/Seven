package seven.companion.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import seven.companion.ui.theme.Tone

@Composable
fun Notice(text: String, tone: Tone = Tone.Dim, modifier: Modifier = Modifier) {
    Text(text, color = tone.color, style = MaterialTheme.typography.bodyMedium, modifier = modifier)
}

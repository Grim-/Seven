package seven.companion.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import seven.companion.ui.theme.Palette

@Composable
fun SectionLabel(text: String) {
    Text(text.uppercase(), color = Palette.dim, style = MaterialTheme.typography.labelMedium)
}

package seven.companion.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import seven.companion.ui.theme.Palette

@Composable
fun TitleBar(title: String, onBack: (() -> Unit)?) {
    Row(
        modifier = Modifier.fillMaxWidth().background(Palette.panel).bottomRule(Palette.lineStrong),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        onBack?.let {
            Text("<", color = Palette.accent, style = MaterialTheme.typography.titleLarge, modifier = Modifier.clickable(onClick = it).padding(16.dp))
        }
        Text(
            title.uppercase(),
            color = Palette.accent,
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(vertical = 16.dp, horizontal = if (onBack == null) 16.dp else 0.dp),
        )
    }
}

package seven.companion.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import seven.companion.store.PairedSeven
import seven.companion.ui.theme.Palette
import seven.companion.ui.theme.Tone

@Composable
fun PairedSevenRow(seven: PairedSeven, online: Boolean, actions: List<Action>, onTap: () -> Unit) {
    SevenRow(
        title = seven.label,
        detail = "${seven.candidates.firstOrNull().orEmpty()}:${seven.port}",
        note = seven.fingerprint.short,
        status = if (online) "ON NETWORK" to Tone.Ok else null,
        actions = actions,
        onTap = onTap,
    )
}

@Composable
fun SevenRow(title: String, detail: String, note: String?, status: Pair<String, Tone>?, actions: List<Action>, onTap: (() -> Unit)?) {
    ContextMenuArea(actions, onTap) {
        Column(
            modifier = Modifier.fillMaxWidth().background(Palette.card).leftRule().bottomRule().padding(horizontal = 14.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(title, color = Palette.accent, style = MaterialTheme.typography.titleSmall)
                status?.let { (text, tone) -> Text(text, color = tone.color, style = MaterialTheme.typography.labelSmall) }
            }
            Text(detail, color = Palette.dim, style = MaterialTheme.typography.bodySmall)
            note?.let { Text(it, color = Palette.faint, style = MaterialTheme.typography.labelSmall) }
        }
    }
}

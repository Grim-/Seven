package seven.companion.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import seven.companion.ui.theme.Palette

@Composable
fun ActionBar(actions: List<Action>) {
    Row(
        modifier = Modifier.fillMaxWidth().background(Palette.panel).topRule().padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        actions.forEach { ActionButton(it, Modifier.weight(1f)) }
    }
}

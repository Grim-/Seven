package seven.companion.ui.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import seven.companion.ui.theme.Palette

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ContextMenuArea(
    actions: List<Action>,
    onTap: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box(modifier.combinedClickable(onClick = { onTap?.invoke() ?: run { open = true } }, onLongClick = { open = true })) {
        content()
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            actions.forEach { action ->
                DropdownMenuItem(
                    text = { Text(action.label, color = if (action.enabled) action.tone.color else Palette.faint) },
                    enabled = action.enabled,
                    onClick = {
                        open = false
                        action.run()
                    },
                )
            }
        }
    }
}

package seven.companion.ui.components

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import seven.companion.ui.theme.Palette
import seven.companion.ui.theme.Tone

@Composable
fun ConfirmDialog(title: String, text: String, confirm: Action, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title.uppercase(), color = Palette.accent) },
        text = { Notice(text, Tone.Plain) },
        confirmButton = {
            ActionButton(confirm.copy(run = {
                onDismiss()
                confirm.run()
            }))
        },
        dismissButton = { ActionButton(Action("Cancel", Tone.Dim, run = onDismiss)) },
        containerColor = Palette.panel,
    )
}

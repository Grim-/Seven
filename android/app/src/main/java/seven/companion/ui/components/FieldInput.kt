package seven.companion.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import seven.companion.ui.theme.Palette

@Composable
fun FieldInput(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    error: String? = null,
    keyboard: KeyboardOptions = KeyboardOptions.Default,
    singleLine: Boolean = true,
    modifier: Modifier = Modifier,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        modifier = modifier.fillMaxWidth(),
        label = { Text(label) },
        isError = error != null,
        supportingText = error?.let { { Text(it) } },
        singleLine = singleLine,
        keyboardOptions = keyboard,
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Palette.accent,
            unfocusedBorderColor = Palette.line,
            focusedLabelColor = Palette.accent,
            unfocusedLabelColor = Palette.dim,
            cursorColor = Palette.accent,
        ),
    )
}

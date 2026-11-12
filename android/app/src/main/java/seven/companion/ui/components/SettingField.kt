package seven.companion.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import seven.companion.settings.AppSetting

@Composable
fun SettingField(
    setting: AppSetting,
    initial: String,
    accept: (String) -> Boolean,
    invalid: String,
    keyboard: KeyboardOptions,
) {
    var text by rememberSaveable(setting.key) { mutableStateOf(initial) }
    var valid by rememberSaveable(setting.key) { mutableStateOf(true) }
    Column {
        FieldInput(
            label = setting.label,
            value = text,
            onChange = { typed ->
                text = typed
                valid = accept(typed)
            },
            error = if (valid) null else invalid,
            keyboard = keyboard,
        )
        Notice(setting.help)
    }
}

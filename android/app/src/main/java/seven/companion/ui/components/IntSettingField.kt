package seven.companion.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.input.KeyboardType
import seven.companion.settings.IntSetting
import seven.companion.settings.SettingsStore

@Composable
fun IntSettingField(setting: IntSetting, store: SettingsStore) {
    var text by rememberSaveable(setting.key) { mutableStateOf(store.get(setting).toString()) }
    val valid = text.toIntOrNull()?.let { it in setting.range } == true
    Column {
        FieldInput(
            label = setting.label,
            value = text,
            onChange = { typed ->
                text = typed
                typed.toIntOrNull()?.takeIf { it in setting.range }?.let { store.set(setting, it) }
            },
            error = if (valid) null else "Between ${setting.range.first} and ${setting.range.last}.",
            keyboard = KeyboardOptions(keyboardType = KeyboardType.Number),
        )
        Notice(setting.help)
    }
}

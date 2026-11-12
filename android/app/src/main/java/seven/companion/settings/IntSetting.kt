package seven.companion.settings

import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.input.KeyboardType
import seven.companion.ui.components.SettingField

class IntSetting(
    override val key: String,
    override val label: String,
    override val help: String,
    val default: Int,
    val range: IntRange,
) : AppSetting {
    @Composable
    override fun Field(store: SettingsStore) {
        SettingField(
            setting = this,
            initial = store.get(this).toString(),
            accept = { typed -> typed.toIntOrNull()?.takeIf { it in range }?.also { store.set(this, it) } != null },
            invalid = "Between ${range.first} and ${range.last}.",
            keyboard = KeyboardOptions(keyboardType = KeyboardType.Number),
        )
    }
}

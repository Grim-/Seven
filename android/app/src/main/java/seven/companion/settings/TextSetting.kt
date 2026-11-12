package seven.companion.settings

import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import seven.companion.ui.components.SettingField

class TextSetting(
    override val key: String,
    override val label: String,
    override val help: String,
    val default: String,
    private val pattern: Regex,
    private val invalid: String,
) : AppSetting {
    fun valid(value: String): Boolean = pattern.matches(value)

    @Composable
    override fun Field(store: SettingsStore) {
        SettingField(
            setting = this,
            initial = store.get(this),
            accept = { typed -> valid(typed).also { ok -> if (ok) store.set(this, typed) } },
            invalid = invalid,
            keyboard = KeyboardOptions(autoCorrectEnabled = false),
        )
    }
}

package seven.companion.settings

import androidx.compose.runtime.Composable

interface AppSetting {
    val key: String
    val label: String
    val help: String

    @Composable
    fun Field(store: SettingsStore)
}

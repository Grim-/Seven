package seven.companion.settings

import android.content.Context

class SettingsStore(context: Context) {
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    fun get(setting: IntSetting): Int = prefs.getInt(setting.key, setting.default).coerceIn(setting.range)

    fun set(setting: IntSetting, value: Int) {
        prefs.edit().putInt(setting.key, value.coerceIn(setting.range)).apply()
    }

    fun get(setting: TextSetting): String =
        prefs.getString(setting.key, null)?.takeIf(setting::valid) ?: setting.default

    fun set(setting: TextSetting, value: String) {
        if (setting.valid(value)) prefs.edit().putString(setting.key, value).apply()
    }
}

package seven.companion.ui.screens

import androidx.compose.runtime.Composable
import seven.companion.LocalServices
import seven.companion.settings.AppSettings
import seven.companion.ui.components.ScreenFrame
import seven.companion.ui.nav.Navigator
import seven.companion.ui.nav.Screen

object SettingsScreen : Screen {
    @Composable
    override fun Content(nav: Navigator) {
        val store = LocalServices.current.settings
        ScreenFrame(title = "Settings", nav = nav) {
            AppSettings.all.forEach { it.Field(store) }
        }
    }
}

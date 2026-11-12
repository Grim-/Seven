package seven.companion

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import seven.companion.ui.nav.AppModel
import seven.companion.ui.theme.Palette
import seven.companion.ui.theme.SevenTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val nav = viewModel<AppModel>().navigator
            SevenTheme {
                CompositionLocalProvider(LocalServices provides services) {
                    BackHandler(nav.canGoBack) { nav.back() }
                    Box(Modifier.fillMaxSize().background(Palette.bg).safeDrawingPadding()) {
                        val screen = nav.current
                        key(screen) { screen.Content(nav) }
                    }
                }
            }
        }
    }
}

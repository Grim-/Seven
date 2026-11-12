package seven.companion.ui.nav

import androidx.compose.runtime.Composable

interface Screen {
    @Composable
    fun Content(nav: Navigator)

    fun dispose() {}
}

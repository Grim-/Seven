package seven.companion.ui.nav

import androidx.lifecycle.ViewModel
import seven.companion.ui.screens.HomeScreen

class AppModel : ViewModel() {
    val navigator = Navigator(HomeScreen)

    override fun onCleared() {
        navigator.disposeAll()
    }
}

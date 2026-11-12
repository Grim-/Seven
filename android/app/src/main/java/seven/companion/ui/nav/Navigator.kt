package seven.companion.ui.nav

import androidx.compose.runtime.mutableStateListOf

class Navigator(root: Screen) {
    private val stack = mutableStateListOf(root)

    val current: Screen get() = stack.last()
    val canGoBack: Boolean get() = stack.size > 1

    fun push(screen: Screen) {
        stack.add(screen)
    }

    fun replace(screen: Screen) {
        stack.removeAt(stack.lastIndex).dispose()
        stack.add(screen)
    }

    fun back() {
        if (canGoBack) stack.removeAt(stack.lastIndex).dispose()
    }

    fun home() {
        while (canGoBack) back()
    }

    fun disposeAll() {
        stack.forEach(Screen::dispose)
    }
}

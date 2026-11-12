package seven.companion.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import seven.companion.ui.components.Action
import seven.companion.ui.components.FieldInput
import seven.companion.ui.components.Notice
import seven.companion.ui.nav.Navigator
import seven.companion.ui.theme.Tone

sealed interface PairingState {
    fun actions(screen: PairingScreen, nav: Navigator): List<Action>

    @Composable
    fun Body(screen: PairingScreen)

    class Naming(initial: String) : PairingState {
        var name by mutableStateOf(initial)

        override fun actions(screen: PairingScreen, nav: Navigator) =
            listOf(Action("Send request", enabled = name.isNotBlank()) { screen.send(name.trim(), nav) })

        @Composable
        override fun Body(screen: PairingScreen) {
            Notice("Seven will ask on the PC whether to allow this phone. Name it so you recognise it there.")
            FieldInput(label = "Name for this phone", value = name, onChange = { name = it })
            screen.Summary()
        }
    }

    class Waiting(private val name: String) : PairingState {
        override fun actions(screen: PairingScreen, nav: Navigator) =
            listOf(Action("Cancel", Tone.Dim) { screen.cancel(name) })

        @Composable
        override fun Body(screen: PairingScreen) {
            Notice("On your PC, choose Allow \"$name\" in Seven's Network panel.", Tone.Accent)
            screen.Summary()
        }
    }

    class Failed(private val message: String, private val name: String) : PairingState {
        override fun actions(screen: PairingScreen, nav: Navigator) = listOf(
            Action("Try again") { screen.edit(name) },
            Action("Close", Tone.Dim) { nav.home() },
        )

        @Composable
        override fun Body(screen: PairingScreen) {
            Notice(message, Tone.Alert)
            screen.Summary()
        }
    }
}

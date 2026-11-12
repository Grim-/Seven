package seven.companion.ui.screens

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import seven.companion.Services
import seven.companion.net.explanation
import seven.companion.pairing.PairingTicket
import seven.companion.ui.components.ScreenFrame
import seven.companion.ui.nav.Navigator
import seven.companion.ui.nav.Screen
import seven.companion.ui.theme.Palette
import kotlin.coroutines.cancellation.CancellationException

class PairingScreen(private val ticket: PairingTicket, deviceName: String, private val services: Services) : Screen {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var state by mutableStateOf<PairingState>(PairingState.Naming(deviceName))
    private var job: Job? = null

    @Composable
    override fun Content(nav: Navigator) {
        val current = state
        ScreenFrame(title = "Pair with Seven", nav = nav, actions = current.actions(this, nav)) {
            current.Body(this@PairingScreen)
        }
    }

    @Composable
    fun Summary() {
        Text(
            "${ticket.addresses.joinToString()} : ${ticket.port}\n${ticket.fingerprint.display}",
            color = Palette.faint,
            style = MaterialTheme.typography.labelSmall,
        )
    }

    fun send(name: String, nav: Navigator) {
        state = PairingState.Waiting(name)
        job = scope.launch {
            try {
                services.pairings.save(services.pairer.pair(ticket, name))
                nav.home()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                state = PairingState.Failed(e.explanation() ?: "Pairing failed: ${e.message ?: e.javaClass.simpleName}", name)
            }
        }
    }

    fun cancel(name: String) {
        job?.cancel()
        edit(name)
    }

    fun edit(name: String) {
        state = PairingState.Naming(name)
    }

    override fun dispose() {
        scope.cancel()
    }
}

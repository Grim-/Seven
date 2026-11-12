package seven.companion.session

import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import seven.companion.Services
import seven.companion.net.SevenAddress
import seven.companion.net.explanation
import seven.companion.proxy.LoopbackProxy
import seven.companion.settings.AppSettings
import seven.companion.store.PairedSeven
import seven.companion.ui.nav.Navigator
import seven.companion.ui.nav.Screen

class SessionScreen(private val seven: PairedSeven, private val hint: SevenAddress?, private val services: Services) : Screen {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var state by mutableStateOf<SessionState>(SessionState.Connecting(seven.label))
    private var started = false
    private var asleep = false
    private var connecting: Job? = null
    private var idle: Job? = null

    @Composable
    override fun Content(nav: Navigator) {
        val activity = LocalContext.current as ComponentActivity
        val owner = LocalLifecycleOwner.current
        LaunchedEffect(Unit) {
            if (!started) {
                started = true
                connect(activity)
            }
        }
        DisposableEffect(owner) {
            val observer = LifecycleEventObserver { _, event ->
                if (event == Lifecycle.Event.ON_STOP) background()
                if (event == Lifecycle.Event.ON_START) foreground(activity)
            }
            owner.lifecycle.addObserver(observer)
            onDispose { owner.lifecycle.removeObserver(observer) }
        }
        state.Content(this, nav)
    }

    fun connect(activity: ComponentActivity) {
        connecting?.cancel()
        asleep = false
        show(SessionState.Connecting(seven.label))
        connecting = scope.launch {
            try {
                val connection = services.connector.connect(seven, hint)
                val proxy = LoopbackProxy(connection, services.settings.get(AppSettings.proxyPort), services.settings.get(AppSettings.connectSeconds) * 1000)
                proxy.start()
                show(SessionState.Open.create(activity, connection, proxy, this@SessionScreen))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                show(SessionState.Lost(seven.label, e.explanation() ?: "Couldn't connect: ${e.message ?: e.javaClass.simpleName}"))
            }
        }
    }

    fun lost(message: String) {
        scope.launch(Dispatchers.Main) { show(SessionState.Lost(seven.label, message)) }
    }

    private fun background() {
        state.pause()
        idle?.cancel()
        idle = scope.launch {
            delay(services.settings.get(AppSettings.backgroundMinutes) * 60_000L)
            connecting?.cancel()
            asleep = true
            show(SessionState.Asleep(seven.label))
        }
    }

    private fun foreground(activity: ComponentActivity) {
        idle?.cancel()
        idle = null
        if (asleep) connect(activity) else state.resume()
    }

    private fun show(next: SessionState) {
        state.close()
        state = next
    }

    override fun dispose() {
        state.close()
        scope.cancel()
    }
}

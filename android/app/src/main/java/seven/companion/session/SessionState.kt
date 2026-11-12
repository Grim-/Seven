package seven.companion.session

import android.net.Uri
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import seven.companion.proxy.LoopbackProxy
import seven.companion.ui.components.Action
import seven.companion.ui.components.Notice
import seven.companion.ui.components.ScreenFrame
import seven.companion.ui.nav.Navigator
import seven.companion.ui.theme.Tone

sealed interface SessionState {
    @Composable
    fun Content(screen: SessionScreen, nav: Navigator)

    fun pause() {}
    fun resume() {}
    fun close() {}

    class Connecting(private val label: String) : SessionState {
        @Composable
        override fun Content(screen: SessionScreen, nav: Navigator) {
            ScreenFrame(title = label, nav = nav, actions = listOf(Action("Cancel", Tone.Dim) { nav.back() })) {
                Notice("Connecting to $label...", Tone.Accent)
            }
        }
    }

    class Lost(private val label: String, private val message: String) : SessionState {
        @Composable
        override fun Content(screen: SessionScreen, nav: Navigator) {
            val activity = LocalContext.current as ComponentActivity
            ScreenFrame(
                title = label,
                nav = nav,
                actions = listOf(
                    Action("Reconnect") { screen.connect(activity) },
                    Action("Back", Tone.Dim) { nav.back() },
                ),
            ) {
                Notice(message, Tone.Alert)
            }
        }
    }

    class Asleep(private val label: String) : SessionState {
        @Composable
        override fun Content(screen: SessionScreen, nav: Navigator) {
            val activity = LocalContext.current as ComponentActivity
            ScreenFrame(title = label, nav = nav, actions = listOf(Action("Reconnect") { screen.connect(activity) })) {
                Notice("Disconnected while the app was in the background.")
            }
        }
    }

    class Open private constructor(
        private val proxy: LoopbackProxy,
        private val webView: WebView,
        private val port: ResultPort,
    ) : SessionState {
        private var presented by mutableStateOf<String?>(null)

        @Composable
        override fun Content(screen: SessionScreen, nav: Navigator) {
            BackHandler {
                when {
                    presented != null -> presented = null
                    webView.canGoBack() -> webView.goBack()
                    else -> nav.back()
                }
            }
            Box(Modifier.fillMaxSize()) {
                AndroidView(
                    factory = { webView.also { (it.parent as? ViewGroup)?.removeView(it) } },
                    modifier = Modifier.fillMaxSize(),
                )
                presented?.let { PageOverlay(it, proxy.origin) { presented = null } }
            }
        }

        override fun pause() = webView.onPause()

        override fun resume() = webView.onResume()

        override fun close() {
            (webView.parent as? ViewGroup)?.removeView(webView)
            webView.destroy()
            port.close()
            proxy.stop()
        }

        companion object {
            fun create(activity: ComponentActivity, connection: Connection, proxy: LoopbackProxy, screen: SessionScreen): Open {
                val port = ResultPort(activity)
                val client = SessionClient(Uri.parse(proxy.origin)) { message -> screen.lost(proxy.problem.value ?: message) }
                val webView = WebViews.create(activity, client)
                val open = Open(proxy, webView, port)
                webView.webChromeClient = FileChooser(port)
                webView.addJavascriptInterface(DeviceBridge(webView, PhoneActions(activity, connection, port, screen.scope) { open.presented = it }), BRIDGE)
                CookieManager.getInstance().setCookie(proxy.origin, proxy.cookieHeader)
                webView.loadUrl("${proxy.origin}/")
                return open
            }

            private const val BRIDGE = "sevenDevice"
        }
    }
}

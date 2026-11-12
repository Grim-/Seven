package seven.companion.session

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import seven.companion.ui.components.TitleBar
import seven.companion.ui.theme.Palette

@Composable
fun PageOverlay(html: String, origin: String, onClose: () -> Unit) {
    val context = LocalContext.current
    val view = remember(html) {
        WebViews.create(context, LinkClient(Uri.parse(origin))).apply {
            loadDataWithBaseURL("$origin/", html, "text/html", "utf-8", null)
        }
    }
    DisposableEffect(view) { onDispose { view.destroy() } }
    Column(Modifier.fillMaxSize().background(Palette.bg)) {
        TitleBar("Page from Seven", onClose)
        AndroidView(factory = { view }, modifier = Modifier.fillMaxWidth().weight(1f))
    }
}

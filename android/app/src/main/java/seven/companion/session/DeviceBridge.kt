package seven.companion.session

import android.webkit.JavascriptInterface
import android.webkit.WebView
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject
import seven.companion.net.explanation

class DeviceBridge(private val webView: WebView, private val actions: DeviceActions) {
    @JavascriptInterface
    fun copyText(call: Int, text: String) = run(call) { actions.copyText(text) }

    @JavascriptInterface
    fun saveText(call: Int, name: String, text: String) = run(call) { actions.saveText(name, text) }

    @JavascriptInterface
    fun saveAsset(call: Int, id: String, name: String) = run(call) { actions.saveAsset(id, name) }

    @JavascriptInterface
    fun openAsset(call: Int, id: String) = run(call) { actions.openAsset(id) }

    @JavascriptInterface
    fun presentPage(call: Int, html: String) = run(call) { actions.presentPage(html) }

    private fun run(call: Int, work: suspend () -> String?) {
        actions.scope.launch(Dispatchers.Main) {
            val (ok, value) = try {
                true to work()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                false to (e.explanation() ?: e.message ?: "The phone could not do that.")
            }
            val literal = value?.let(JSONObject::quote) ?: "null"
            webView.evaluateJavascript("window.sevenDeviceReply && window.sevenDeviceReply($call, $ok, $literal)", null)
        }
    }
}

package seven.companion.session

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.activity.result.ActivityResult

class FileChooser(private val port: ResultPort) : WebChromeClient() {
    override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
        val intent = params.createIntent().putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
        return try {
            port.launch(intent) { callback.onReceiveValue(picked(it)) }
            true
        } catch (e: ActivityNotFoundException) {
            callback.onReceiveValue(null)
            false
        }
    }

    private fun picked(result: ActivityResult): Array<Uri>? {
        val data = result.data?.takeIf { result.resultCode == Activity.RESULT_OK } ?: return null
        val clip = data.clipData ?: return data.data?.let { arrayOf(it) }
        return Array(clip.itemCount) { clip.getItemAt(it).uri }
    }
}

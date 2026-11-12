package seven.companion.session

import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient

open class LinkClient(private val origin: Uri) : WebViewClient() {
    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val url = request.url
        if (url.host == origin.host && url.port == origin.port) return false
        try {
            view.context.startActivity(Intent(Intent.ACTION_VIEW, url))
        } catch (e: ActivityNotFoundException) {
        }
        return true
    }
}

class SessionClient(origin: Uri, private val onMainFailure: (String) -> Unit) : LinkClient(origin) {
    override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
        if (request.isForMainFrame) onMainFailure("Seven answered with status ${response.statusCode} (${request.url}).")
    }

    override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
        if (request.isForMainFrame) onMainFailure("${error.description} (${request.url})")
    }
}

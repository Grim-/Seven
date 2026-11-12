package seven.companion.session

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.ApplicationInfo
import android.webkit.WebView
import android.webkit.WebViewClient

object WebViews {
    @SuppressLint("SetJavaScriptEnabled")
    fun create(context: Context, client: WebViewClient): WebView {
        WebView.setWebContentsDebuggingEnabled((context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0)
        return WebView(context).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = client
        }
    }
}

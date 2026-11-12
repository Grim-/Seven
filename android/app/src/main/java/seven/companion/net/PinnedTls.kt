package seven.companion.net

import java.security.cert.X509Certificate
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSession
import javax.net.ssl.SSLSocketFactory

class PinnedTls(private val pin: Fingerprint) {
    val trust = PinnedTrust(pin)
    private val context: SSLContext = SSLContext.getInstance("TLS").apply { init(null, arrayOf(trust), null) }

    val socketFactory: SSLSocketFactory get() = context.socketFactory

    fun verifies(session: SSLSession): Boolean =
        (session.peerCertificates.firstOrNull() as? X509Certificate)?.let(pin::matches) == true
}

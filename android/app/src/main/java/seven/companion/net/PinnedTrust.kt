package seven.companion.net

import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import javax.net.ssl.X509TrustManager

class NotTheSameSeven : CertificateException(MESSAGE), Explained {
    override val explanation: String get() = MESSAGE

    private companion object {
        const val MESSAGE = "This isn't the Seven you paired with."
    }
}

class PinnedTrust(private val pin: Fingerprint) : X509TrustManager {
    override fun checkServerTrusted(chain: Array<out X509Certificate>, authType: String) {
        val leaf = chain.firstOrNull() ?: throw NotTheSameSeven()
        if (!pin.matches(leaf)) throw NotTheSameSeven()
    }

    override fun checkClientTrusted(chain: Array<out X509Certificate>, authType: String) {
        throw CertificateException("Client certificates are not accepted.")
    }

    override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
}

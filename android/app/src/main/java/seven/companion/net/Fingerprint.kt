package seven.companion.net

import java.security.MessageDigest
import java.security.cert.X509Certificate

@JvmInline
value class Fingerprint private constructor(val hex: String) {
    val display: String get() = hex.chunked(2).joinToString(":")
    val short: String get() = hex.take(16).chunked(2).joinToString(":")

    fun matches(cert: X509Certificate): Boolean = of(cert) == this

    companion object {
        fun parse(text: String): Fingerprint? {
            val hex = text.filter { it.isLetterOrDigit() }.uppercase()
            return Fingerprint(hex).takeIf { hex.length == 64 && hex.all { it in '0'..'9' || it in 'A'..'F' } }
        }

        fun of(cert: X509Certificate): Fingerprint =
            Fingerprint(MessageDigest.getInstance("SHA-256").digest(cert.encoded).joinToString("") { "%02X".format(it) })
    }
}

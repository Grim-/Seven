package seven.companion.pairing

import org.json.JSONObject
import seven.companion.net.Fingerprint
import seven.companion.net.SevenProblem

data class PairingTicket(
    val addresses: List<String>,
    val port: Int,
    val fingerprint: Fingerprint,
    val code: String,
    val announceId: String?,
) {
    override fun toString(): String = "PairingTicket(${addresses.joinToString()}:$port)"

    companion object {
        private const val PROTOCOL = 1
        private val CODE = Regex("\\d{8}")
        val PORTS = 1..65535

        fun isCode(text: String): Boolean = CODE.matches(text)

        fun fromQr(text: String): PairingTicket? {
            val o = runCatching { JSONObject(text) }.getOrNull() ?: return null
            if (!o.has("seven")) return null
            if (o.optInt("seven") != PROTOCOL) throw SevenProblem("This QR code is from a different version of Seven than this app supports.")
            val list = o.optJSONArray("addresses") ?: return null
            val code = o.optString("code")
            val fingerprint = Fingerprint.parse(o.optString("fingerprint")) ?: return null
            val port = o.optInt("port")
            if (!isCode(code) || list.length() == 0 || port !in PORTS) return null
            return PairingTicket(
                addresses = (0 until list.length()).map(list::getString),
                port = port,
                fingerprint = fingerprint,
                code = code,
                announceId = o.optString("id").ifEmpty { null },
            )
        }
    }
}

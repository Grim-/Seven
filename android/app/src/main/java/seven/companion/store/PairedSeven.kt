package seven.companion.store

import org.json.JSONArray
import org.json.JSONObject
import seven.companion.net.Fingerprint

data class PairedSeven(
    val deviceId: String,
    val deviceKey: String,
    val fingerprint: Fingerprint,
    val announceId: String?,
    val label: String,
    val addresses: List<String>,
    val port: Int,
    val lastAddress: String?,
    val pairedAt: Long,
) {
    val authorization: String get() = "Device $deviceId:$deviceKey"

    val candidates: List<String> get() = listOfNotNull(lastAddress) + addresses.filter { it != lastAddress }

    override fun toString(): String = "PairedSeven($label, $deviceId)"

    fun toJson(): JSONObject = JSONObject()
        .put("deviceId", deviceId)
        .put("deviceKey", deviceKey)
        .put("fingerprint", fingerprint.hex)
        .put("announceId", announceId)
        .put("label", label)
        .put("addresses", JSONArray(addresses))
        .put("port", port)
        .put("lastAddress", lastAddress)
        .put("pairedAt", pairedAt)

    companion object {
        fun fromJson(o: JSONObject): PairedSeven {
            val addresses = o.getJSONArray("addresses")
            return PairedSeven(
                deviceId = o.getString("deviceId"),
                deviceKey = o.getString("deviceKey"),
                fingerprint = requireNotNull(Fingerprint.parse(o.getString("fingerprint"))),
                announceId = o.optString("announceId").takeIf { o.has("announceId") && !o.isNull("announceId") },
                label = o.getString("label"),
                addresses = (0 until addresses.length()).map(addresses::getString),
                port = o.getInt("port"),
                lastAddress = o.optString("lastAddress").takeIf { o.has("lastAddress") && !o.isNull("lastAddress") },
                pairedAt = o.getLong("pairedAt"),
            )
        }
    }
}

package seven.companion.pairing

import android.net.http.SslCertificate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import seven.companion.net.PinnedClient
import seven.companion.net.PinnedTls
import seven.companion.net.Reach
import seven.companion.net.SevenAddress
import seven.companion.net.await
import seven.companion.net.problem
import seven.companion.settings.AppSettings
import seven.companion.settings.SettingsStore
import seven.companion.store.PairedSeven
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit

class Pairer(private val settings: SettingsStore) {
    suspend fun pair(ticket: PairingTicket, name: String): PairedSeven = withContext(Dispatchers.IO) {
        val client = PinnedClient.create(PinnedTls(ticket.fingerprint), settings.get(AppSettings.connectSeconds))
        val (address, label) = Reach.first(
            client,
            ticket.addresses.map { SevenAddress(it, ticket.port) },
            { Request.Builder().url(it.url("/pair")).build() },
        ) { address, response -> address to label(response, address) }
        val body = JSONObject().put("code", ticket.code).put("name", name).toString().toRequestBody(JSON)
        val request = Request.Builder().url(address.url("/pair")).post(body).build()
        val granted = client.newBuilder().readTimeout(0, TimeUnit.SECONDS).build().newCall(request).await().use { response ->
            if (!response.isSuccessful) throw response.problem()
            JSONObject(response.body?.string().orEmpty())
        }
        PairedSeven(
            deviceId = granted.getString("deviceId"),
            deviceKey = granted.getString("deviceKey"),
            fingerprint = ticket.fingerprint,
            announceId = ticket.announceId,
            label = label,
            addresses = ticket.addresses,
            port = ticket.port,
            lastAddress = address.host,
            pairedAt = System.currentTimeMillis(),
        )
    }

    private fun label(response: Response, address: SevenAddress): String =
        (response.handshake?.peerCertificates?.firstOrNull() as? X509Certificate)
            ?.let { SslCertificate(it).issuedTo.cName }
            ?.takeIf { it.isNotBlank() }
            ?: address.host

    private companion object {
        val JSON = "application/json; charset=utf-8".toMediaType()
    }
}

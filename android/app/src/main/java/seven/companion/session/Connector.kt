package seven.companion.session

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request
import seven.companion.net.PinnedClient
import seven.companion.net.PinnedTls
import seven.companion.net.Reach
import seven.companion.net.SevenAddress
import seven.companion.net.problem
import seven.companion.settings.AppSettings
import seven.companion.settings.SettingsStore
import seven.companion.store.PairedSeven
import seven.companion.store.PairedSevens

class Connector(private val settings: SettingsStore, private val pairings: PairedSevens) {
    suspend fun connect(seven: PairedSeven, hint: SevenAddress?): Connection = withContext(Dispatchers.IO) {
        val tls = PinnedTls(seven.fingerprint)
        val client = PinnedClient.create(tls, settings.get(AppSettings.connectSeconds)).newBuilder()
            .addInterceptor { chain -> chain.proceed(chain.request().newBuilder().header("Authorization", seven.authorization).build()) }
            .build()
        val addresses = (listOfNotNull(hint) + seven.candidates.map { SevenAddress(it, seven.port) }).distinct()
        val address = Reach.first(client, addresses, { Request.Builder().url(it.url("/")).build() }) { address, response ->
            if (!response.isSuccessful) throw response.problem()
            address
        }
        val updated = seven.copy(lastAddress = address.host, port = address.port)
        pairings.save(updated)
        Connection(updated, address, tls, client)
    }
}

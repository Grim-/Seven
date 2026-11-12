package seven.companion.net

import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

object PinnedClient {
    private val base = OkHttpClient()

    fun create(tls: PinnedTls, connectSeconds: Int): OkHttpClient =
        base.newBuilder()
            .sslSocketFactory(tls.socketFactory, tls.trust)
            .hostnameVerifier { _, session -> tls.verifies(session) }
            .connectTimeout(connectSeconds.toLong(), TimeUnit.SECONDS)
            .build()
}

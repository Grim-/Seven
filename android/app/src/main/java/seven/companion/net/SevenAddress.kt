package seven.companion.net

import okhttp3.HttpUrl

data class SevenAddress(val host: String, val port: Int) {
    val authority: String get() = if (':' in host) "[$host]:$port" else "$host:$port"

    fun url(path: String): HttpUrl = HttpUrl.Builder().scheme("https").host(host).port(port).encodedPath(path).build()
}

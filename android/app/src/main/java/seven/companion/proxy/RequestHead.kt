package seven.companion.proxy

import java.io.InputStream

class RequestHead private constructor(private val requestLine: String, private val headers: List<Pair<String, String>>) {
    fun carries(cookie: String): Boolean = cookies().any { it == cookie }

    fun forward(authority: String, authorization: String, cookie: String): ByteArray {
        val upgrade = headers.any { it.first.equals("Upgrade", ignoreCase = true) }
        val kept = headers.filterNot { (name, _) -> HOP.any { it.equals(name, ignoreCase = true) } }
        val others = cookies().filterNot { it == cookie }
        val lines = buildList {
            add(requestLine)
            add("Host: $authority")
            add("Authorization: $authorization")
            add("Connection: ${if (upgrade) "Upgrade" else "close"}")
            kept.forEach { (name, value) -> add("$name: $value") }
            if (others.isNotEmpty()) add("Cookie: ${others.joinToString("; ")}")
        }
        return (lines.joinToString("\r\n") + "\r\n\r\n").toByteArray(Charsets.ISO_8859_1)
    }

    private fun cookies(): List<String> =
        headers.filter { it.first.equals("Cookie", ignoreCase = true) }
            .flatMap { it.second.split(';') }
            .map(String::trim)
            .filter(String::isNotEmpty)

    companion object {
        private val HOP = listOf("Host", "Authorization", "Connection", "Proxy-Connection", "Keep-Alive", "Cookie")
        private val END = byteArrayOf(13, 10, 13, 10)

        fun read(input: InputStream, limit: Int): RequestHead? {
            val bytes = java.io.ByteArrayOutputStream()
            var matched = 0
            while (matched < END.size) {
                val b = input.read()
                if (b < 0 || bytes.size() >= limit) return null
                bytes.write(b)
                matched = if (b.toByte() == END[matched]) matched + 1 else if (b.toByte() == END[0]) 1 else 0
            }
            val lines = bytes.toString(Charsets.ISO_8859_1.name()).split("\r\n").filter(String::isNotEmpty)
            val requestLine = lines.firstOrNull() ?: return null
            val headers = lines.drop(1).mapNotNull { line ->
                val colon = line.indexOf(':')
                if (colon <= 0) null else line.substring(0, colon).trim() to line.substring(colon + 1).trim()
            }
            return RequestHead(requestLine, headers)
        }
    }
}

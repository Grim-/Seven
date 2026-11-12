package seven.companion.net

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.IOException

object Reach {
    suspend fun <T> first(
        client: OkHttpClient,
        addresses: List<SevenAddress>,
        request: (SevenAddress) -> Request,
        answer: (SevenAddress, Response) -> T,
    ): T {
        val failures = mutableListOf<IOException>()
        for (address in addresses) {
            val response = try {
                client.newCall(request(address)).await()
            } catch (e: IOException) {
                failures += e
                continue
            }
            return response.use { answer(address, it) }
        }
        throw failures.firstOrNull { it.explanation() != null }
            ?: SevenProblem("Couldn't reach Seven at ${addresses.joinToString { it.authority }}. Check that Seven's server is on and the phone is on the same network.")
    }
}

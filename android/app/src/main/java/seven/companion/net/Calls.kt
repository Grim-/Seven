package seven.companion.net

import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

suspend fun Call.await(): Response = suspendCancellableCoroutine { continuation ->
    enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) {
            continuation.resume(response) { response.close() }
        }

        override fun onFailure(call: Call, e: IOException) {
            continuation.resumeWithException(e)
        }
    })
    continuation.invokeOnCancellation { cancel() }
}

fun Response.problem(): SevenProblem {
    val text = body?.string().orEmpty()
    val message = runCatching { JSONObject(text).getJSONObject("error").getString("message") }.getOrNull()
    return SevenProblem(message ?: "Seven answered with status $code.")
}

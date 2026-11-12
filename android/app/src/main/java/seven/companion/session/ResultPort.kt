package seven.companion.session

import android.app.Activity
import android.content.Intent
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

class ResultPort(activity: ComponentActivity) {
    private var pending: ((ActivityResult) -> Unit)? = null
    private val launcher = activity.activityResultRegistry.register(
        "seven-port-${System.nanoTime()}",
        ActivityResultContracts.StartActivityForResult(),
    ) { result -> settle(result) }

    fun launch(intent: Intent, onResult: (ActivityResult) -> Unit) {
        settle(CANCELLED)
        pending = onResult
        launcher.launch(intent)
    }

    suspend fun await(intent: Intent): ActivityResult = suspendCancellableCoroutine { continuation ->
        launch(intent) { continuation.resume(it) }
    }

    fun close() {
        settle(CANCELLED)
        launcher.unregister()
    }

    private fun settle(result: ActivityResult) {
        val waiting = pending
        pending = null
        waiting?.invoke(result)
    }

    private companion object {
        val CANCELLED = ActivityResult(Activity.RESULT_CANCELED, null)
    }
}

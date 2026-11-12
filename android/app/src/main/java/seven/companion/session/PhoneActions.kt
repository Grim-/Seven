package seven.companion.session

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import android.webkit.MimeTypeMap
import androidx.activity.ComponentActivity
import androidx.core.content.FileProvider
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request
import okhttp3.Response
import seven.companion.net.SevenProblem
import seven.companion.net.problem
import java.io.File

class PhoneActions(
    private val activity: ComponentActivity,
    private val connection: Connection,
    private val port: ResultPort,
    override val scope: CoroutineScope,
    private val present: (String) -> Unit,
) : DeviceActions {
    override suspend fun copyText(text: String): String? {
        activity.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("Seven", text))
        return null
    }

    override suspend fun saveText(name: String, text: String): String? {
        val target = pickTarget(name, "text/plain") ?: return null
        withContext(Dispatchers.IO) { output(target).use { it.write(text.encodeToByteArray()) } }
        return name
    }

    override suspend fun saveAsset(id: String, name: String): String? {
        val target = pickTarget(name, mimeOf(name)) ?: return null
        withContext(Dispatchers.IO) { fetch(id) { response -> output(target).use { response.body!!.byteStream().copyTo(it) } } }
        return name
    }

    override suspend fun openAsset(id: String): String? {
        val (file, mime) = withContext(Dispatchers.IO) {
            fetch(id) { response ->
                val mime = response.body!!.contentType()?.let { "${it.type}/${it.subtype}" } ?: OCTET
                val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime)?.let { ".$it" }.orEmpty()
                val file = File(File(activity.cacheDir, OPEN_DIR).apply { mkdirs() }, Uri.encode(id) + extension)
                file.outputStream().use { response.body!!.byteStream().copyTo(it) }
                file to mime
            }
        }
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.files", file)
        val view = Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        try {
            activity.startActivity(Intent.createChooser(view, null))
        } catch (e: ActivityNotFoundException) {
            throw SevenProblem("No app on this phone can open that file.")
        }
        return null
    }

    override suspend fun presentPage(html: String): String {
        present(html)
        return ""
    }

    private suspend fun pickTarget(name: String, mime: String): Uri? {
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(mime)
            .putExtra(Intent.EXTRA_TITLE, name)
        val result = port.await(intent)
        return result.data?.data?.takeIf { result.resultCode == Activity.RESULT_OK }
    }

    private fun output(target: Uri) =
        activity.contentResolver.openOutputStream(target) ?: throw SevenProblem("The phone could not write to that place.")

    private fun <T> fetch(id: String, use: (Response) -> T): T {
        val request = Request.Builder().url(connection.address.url("/assets/${Uri.encode(id)}")).build()
        return connection.client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw response.problem()
            use(response)
        }
    }

    private fun mimeOf(name: String): String =
        MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substringAfterLast('.', "").lowercase()) ?: OCTET

    private companion object {
        const val OCTET = "application/octet-stream"
        const val OPEN_DIR = "open"
    }
}

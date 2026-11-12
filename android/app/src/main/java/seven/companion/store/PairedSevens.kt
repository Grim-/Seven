package seven.companion.store

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import java.io.File

class PairedSevens(context: Context, private val vault: Vault) {
    private val file = File(context.noBackupFilesDir, "pairings.bin")
    private val _problem = MutableStateFlow<String?>(null)
    private val _all = MutableStateFlow(load())

    val all: StateFlow<List<PairedSeven>> = _all
    val problem: StateFlow<String?> = _problem

    fun save(seven: PairedSeven) = write(_all.value.filterNot { it.deviceId == seven.deviceId || it.fingerprint == seven.fingerprint } + seven)

    fun forget(deviceId: String) = write(_all.value.filterNot { it.deviceId == deviceId })

    private fun load(): List<PairedSeven> {
        if (!file.exists()) return emptyList()
        return runCatching {
            val array = JSONArray(vault.open(file.readBytes()).decodeToString())
            (0 until array.length()).map { PairedSeven.fromJson(array.getJSONObject(it)) }
        }.getOrElse {
            _problem.value = "Saved pairings could not be read on this phone (its key store was reset). Pair again; the old devices can be removed in Seven's Network panel."
            emptyList()
        }
    }

    @Synchronized
    private fun write(list: List<PairedSeven>) {
        val staged = File(file.parentFile, "${file.name}.tmp")
        staged.writeBytes(vault.seal(JSONArray(list.map(PairedSeven::toJson)).toString().encodeToByteArray()))
        check(staged.renameTo(file)) { "Could not save pairings." }
        _all.value = list
        _problem.value = null
    }
}

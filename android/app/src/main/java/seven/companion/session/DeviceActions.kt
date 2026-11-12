package seven.companion.session

import kotlinx.coroutines.CoroutineScope

interface DeviceActions {
    val scope: CoroutineScope

    suspend fun copyText(text: String): String?
    suspend fun saveText(name: String, text: String): String?
    suspend fun saveAsset(id: String, name: String): String?
    suspend fun openAsset(id: String): String?
    suspend fun presentPage(html: String): String?
}

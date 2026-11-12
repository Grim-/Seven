package seven.companion.session

import okhttp3.OkHttpClient
import seven.companion.net.PinnedTls
import seven.companion.net.SevenAddress
import seven.companion.store.PairedSeven

class Connection(
    val seven: PairedSeven,
    val address: SevenAddress,
    val tls: PinnedTls,
    val client: OkHttpClient,
)

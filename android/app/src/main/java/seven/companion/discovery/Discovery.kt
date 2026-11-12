package seven.companion.discovery

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import seven.companion.net.SevenAddress
import seven.companion.settings.AppSettings
import seven.companion.settings.SettingsStore

class Discovery(context: Context, private val settings: SettingsStore) {
    private val nsd = context.getSystemService(NsdManager::class.java)
    private val main = Handler(Looper.getMainLooper())
    private val queue = ArrayDeque<NsdServiceInfo>()
    private val _found = MutableStateFlow<List<Announced>>(emptyList())
    private val _problem = MutableStateFlow<String?>(null)
    private var listener: NsdManager.DiscoveryListener? = null
    private var users = 0
    private var resolving = false

    val found: StateFlow<List<Announced>> = _found
    val problem: StateFlow<String?> = _problem

    fun start() {
        if (users++ == 0) begin()
    }

    fun stop() {
        if (--users > 0) return
        listener?.let { runCatching { nsd.stopServiceDiscovery(it) } }
        listener = null
        queue.clear()
        _found.value = emptyList()
    }

    private fun begin() {
        _problem.value = null
        val watching = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) {}
            override fun onDiscoveryStopped(serviceType: String) {}
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}

            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                main.post {
                    listener = null
                    _problem.value = "Couldn't look for Seven on this network (Android NSD error $errorCode). Paired Sevens are still tried at their last address."
                }
            }

            override fun onServiceFound(info: NsdServiceInfo) {
                main.post { if (listener === this) enqueue(info) }
            }

            override fun onServiceLost(info: NsdServiceInfo) {
                main.post { _found.value = _found.value.filterNot { it.name == info.serviceName } }
            }
        }
        listener = watching
        nsd.discoverServices("_${settings.get(AppSettings.serviceType)}._tcp", NsdManager.PROTOCOL_DNS_SD, watching)
    }

    private fun enqueue(info: NsdServiceInfo) {
        queue.addLast(info)
        next()
    }

    @Suppress("DEPRECATION")
    private fun next() {
        if (resolving) return
        val info = queue.removeFirstOrNull() ?: return
        resolving = true
        nsd.resolveService(info, object : NsdManager.ResolveListener {
            override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
                main.post { settle() }
            }

            override fun onServiceResolved(info: NsdServiceInfo) {
                main.post {
                    add(info)
                    settle()
                }
            }
        })
    }

    private fun settle() {
        resolving = false
        next()
    }

    @Suppress("DEPRECATION")
    private fun add(info: NsdServiceInfo) {
        if (listener == null) return
        val host = info.host ?: return
        val address = host.hostAddress ?: return
        val announced = Announced(info.serviceName, info.attributes["id"]?.decodeToString(), SevenAddress(address, info.port))
        _found.value = _found.value.filterNot { it.name == announced.name } + announced
    }
}

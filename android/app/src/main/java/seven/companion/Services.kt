package seven.companion

import android.content.Context
import androidx.compose.runtime.staticCompositionLocalOf
import seven.companion.discovery.Discovery
import seven.companion.pairing.Pairer
import seven.companion.session.Connector
import seven.companion.settings.SettingsStore
import seven.companion.store.PairedSevens
import seven.companion.store.Vault

class Services(context: Context) {
    val settings = SettingsStore(context)
    val pairings = PairedSevens(context, Vault())
    val pairer = Pairer(settings)
    val connector = Connector(settings, pairings)
    val discovery = Discovery(context, settings)
}

val LocalServices = staticCompositionLocalOf<Services> { error("Services not provided") }

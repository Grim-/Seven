package seven.companion.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import seven.companion.LocalServices
import seven.companion.session.SessionScreen
import seven.companion.store.PairedSeven
import seven.companion.ui.components.Action
import seven.companion.ui.components.ConfirmDialog
import seven.companion.ui.components.Notice
import seven.companion.ui.components.PairedSevenRow
import seven.companion.ui.components.ScreenFrame
import seven.companion.ui.components.SectionLabel
import seven.companion.ui.components.SevenRow
import seven.companion.ui.nav.Navigator
import seven.companion.ui.nav.Screen
import seven.companion.ui.theme.Tone

object HomeScreen : Screen {
    @Composable
    override fun Content(nav: Navigator) {
        val services = LocalServices.current
        val discovery = services.discovery
        val sevens by services.pairings.all.collectAsStateWithLifecycle()
        val problem by services.pairings.problem.collectAsStateWithLifecycle()
        val found by discovery.found.collectAsStateWithLifecycle()
        val searching by discovery.problem.collectAsStateWithLifecycle()
        var forgetting by remember { mutableStateOf<PairedSeven?>(null) }

        DisposableEffect(Unit) {
            discovery.start()
            onDispose { discovery.stop() }
        }

        val pairedIds = sevens.mapNotNull { it.announceId }.toSet()
        val unpaired = found.filter { it.id == null || it.id !in pairedIds }

        ScreenFrame(
            title = "Seven",
            nav = nav,
            actions = listOf(
                Action("Scan QR") { nav.push(ScanScreen()) },
                Action("Type in", Tone.Info) { nav.push(ManualScreen()) },
                Action("Settings", Tone.Dim) { nav.push(SettingsScreen) },
            ),
        ) {
            problem?.let { Notice(it, Tone.Alert) }
            searching?.let { Notice(it, Tone.Alert) }
            if (sevens.isEmpty()) Notice("No paired Seven yet. On your PC open Seven's Network panel, choose Pair a device, then scan the QR code it shows.")
            sevens.sortedByDescending { it.pairedAt }.forEach { seven ->
                val announced = found.firstOrNull { it.id != null && it.id == seven.announceId }
                val open = { nav.push(SessionScreen(seven, announced?.address, services)) }
                PairedSevenRow(
                    seven = seven,
                    online = announced != null,
                    actions = listOf(
                        Action("Connect", run = open),
                        Action("Forget this Seven", Tone.Alert) { forgetting = seven },
                    ),
                    onTap = open,
                )
            }
            if (unpaired.isNotEmpty()) {
                SectionLabel("On this network, not paired")
                unpaired.forEach { announced ->
                    val typeIn = { nav.push(ManualScreen(announced.address.host, announced.address.port.toString())) }
                    SevenRow(
                        title = announced.name,
                        detail = announced.address.authority,
                        note = "Open Pair a device in Seven, then scan its QR code.",
                        status = null,
                        actions = listOf(
                            Action("Scan QR") { nav.push(ScanScreen()) },
                            Action("Type in", Tone.Info, run = typeIn),
                        ),
                        onTap = null,
                    )
                }
            }
        }

        forgetting?.let { seven ->
            ConfirmDialog(
                title = "Forget ${seven.label}",
                text = "This phone will need to pair again to reach this Seven. Seven still lists this phone until you remove it in its Network panel.",
                confirm = Action("Forget", Tone.Alert) { services.pairings.forget(seven.deviceId) },
                onDismiss = { forgetting = null },
            )
        }
    }
}

package seven.companion.ui.screens

import android.Manifest
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import seven.companion.Services
import seven.companion.net.explanation
import seven.companion.services
import seven.companion.pairing.DeviceName
import seven.companion.pairing.PairingTicket
import seven.companion.scan.CameraPreview
import seven.companion.scan.QrAnalyzer
import seven.companion.ui.components.Action
import seven.companion.ui.components.Notice
import seven.companion.ui.components.PermissionGate
import seven.companion.ui.components.ScreenFrame
import seven.companion.ui.nav.Navigator
import seven.companion.ui.nav.Screen
import seven.companion.ui.theme.Tone

class ScanScreen : Screen {
    private var problem by mutableStateOf<String?>(null)
    private var done = false

    @Composable
    override fun Content(nav: Navigator) {
        val context = LocalContext.current
        val analyzer = remember {
            val main = ContextCompat.getMainExecutor(context)
            QrAnalyzer { text -> main.execute { scanned(text, nav, DeviceName.of(context), context.services) } }
        }
        ScreenFrame(
            title = "Scan pairing code",
            nav = nav,
            scroll = false,
            actions = listOf(Action("Type in instead", Tone.Info) { nav.replace(ManualScreen()) }),
        ) {
            PermissionGate(
                permission = Manifest.permission.CAMERA,
                reason = "The camera is used only to read the QR code Seven shows when pairing.",
                refused = "Camera access was refused. Allow it in Android's app settings, or type the pairing details in instead.",
            ) {
                Notice("Point the camera at the QR code in Seven's Pair a device screen.")
                CameraPreview(analyzer, Modifier.fillMaxWidth().aspectRatio(3f / 4f))
            }
            problem?.let { Notice(it, Tone.Alert) }
        }
    }

    private fun scanned(text: String, nav: Navigator, deviceName: String, services: Services) {
        if (done) return
        val ticket = try {
            PairingTicket.fromQr(text)
        } catch (e: Exception) {
            problem = e.explanation() ?: e.message
            null
        } ?: return
        done = true
        nav.replace(PairingScreen(ticket, deviceName, services))
    }
}

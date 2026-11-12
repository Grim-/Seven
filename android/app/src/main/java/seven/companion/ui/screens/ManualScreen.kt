package seven.companion.ui.screens

import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import seven.companion.net.Fingerprint
import seven.companion.pairing.DeviceName
import seven.companion.services
import seven.companion.pairing.PairingTicket
import seven.companion.ui.components.Action
import seven.companion.ui.components.FieldInput
import seven.companion.ui.components.Notice
import seven.companion.ui.components.ScreenFrame
import seven.companion.ui.nav.Navigator
import seven.companion.ui.nav.Screen

class ManualScreen(private val initialAddress: String = "", private val initialPort: String = DEFAULT_PORT) : Screen {
    @Composable
    override fun Content(nav: Navigator) {
        val context = LocalContext.current
        var address by rememberSaveable { mutableStateOf(initialAddress) }
        var port by rememberSaveable { mutableStateOf(initialPort) }
        var fingerprint by rememberSaveable { mutableStateOf("") }
        var code by rememberSaveable { mutableStateOf("") }

        val portValue = port.toIntOrNull()?.takeIf { it in PairingTicket.PORTS }
        val pin = Fingerprint.parse(fingerprint)
        val ready = address.isNotBlank() && portValue != null && pin != null && PairingTicket.isCode(code)

        ScreenFrame(
            title = "Type in pairing details",
            nav = nav,
            actions = listOf(
                Action("Pair", enabled = ready) {
                    val ticket = PairingTicket(listOf(address.trim()), portValue!!, pin!!, code, null)
                    nav.replace(PairingScreen(ticket, DeviceName.of(context), context.services))
                },
            ),
        ) {
            Notice("Copy these from Seven's Pair a device screen.")
            FieldInput(
                label = "Address",
                value = address,
                onChange = { address = it },
                keyboard = KeyboardOptions(keyboardType = KeyboardType.Uri, autoCorrectEnabled = false),
            )
            FieldInput(
                label = "Port",
                value = port,
                onChange = { port = it },
                error = if (port.isNotEmpty() && portValue == null) "A port from 1 to 65535." else null,
                keyboard = KeyboardOptions(keyboardType = KeyboardType.Number),
            )
            FieldInput(
                label = "Fingerprint",
                value = fingerprint,
                onChange = { fingerprint = it },
                error = if (fingerprint.isNotEmpty() && pin == null) "64 hex digits; colons and spaces are ignored." else null,
                keyboard = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, autoCorrectEnabled = false, keyboardType = KeyboardType.Ascii),
                singleLine = false,
            )
            FieldInput(
                label = "Pairing code",
                value = code,
                onChange = { typed -> code = typed.filter(Char::isDigit).take(8) },
                error = if (code.isNotEmpty() && !PairingTicket.isCode(code)) "8 digits." else null,
                keyboard = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            )
        }
    }

    private companion object {
        const val DEFAULT_PORT = "8443"
    }
}

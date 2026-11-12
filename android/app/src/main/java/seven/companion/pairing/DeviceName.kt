package seven.companion.pairing

import android.content.Context
import android.os.Build
import android.provider.Settings

object DeviceName {
    fun of(context: Context): String =
        Settings.Global.getString(context.contentResolver, Settings.Global.DEVICE_NAME)?.takeIf { it.isNotBlank() } ?: Build.MODEL
}

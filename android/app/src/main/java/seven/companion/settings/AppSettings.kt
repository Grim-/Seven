package seven.companion.settings

object AppSettings {
    val connectSeconds = IntSetting(
        key = "connectSeconds",
        label = "Connect timeout (seconds)",
        help = "How long to try each of Seven's addresses before moving to the next.",
        default = 3,
        range = 1..30,
    )

    val backgroundMinutes = IntSetting(
        key = "backgroundMinutes",
        label = "Disconnect in background after (minutes)",
        help = "How long the app keeps its connection to Seven while it is in the background. Work keeps running on the PC; the app reconnects when you open it.",
        default = 5,
        range = 1..240,
    )

    val proxyPort = IntSetting(
        key = "proxyPort",
        label = "Local port",
        help = "The app hands Seven's page to its own browser view on this port of the phone. Only this app can use it. Change it if another app already uses the port.",
        default = 47807,
        range = 1024..65535,
    )

    val serviceType = TextSetting(
        key = "serviceType",
        label = "Network name",
        help = "Must match the announce type in Seven's Network settings (seven unless you changed it).",
        default = "seven",
        pattern = Regex("[a-z0-9-]{1,15}"),
        invalid = "1 to 15 lowercase letters, digits or dashes.",
    )

    val all: List<AppSetting> = listOf(connectSeconds, backgroundMinutes, proxyPort, serviceType)
}

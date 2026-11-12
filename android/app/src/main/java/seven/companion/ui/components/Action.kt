package seven.companion.ui.components

import seven.companion.ui.theme.Tone

data class Action(
    val label: String,
    val tone: Tone = Tone.Accent,
    val enabled: Boolean = true,
    val run: () -> Unit,
)

package seven.companion.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import seven.companion.ui.nav.Navigator

@Composable
fun ScreenFrame(
    title: String,
    nav: Navigator,
    actions: List<Action> = emptyList(),
    scroll: Boolean = true,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        TitleBar(title, if (nav.canGoBack) nav::back else null)
        val body = Modifier.weight(1f).fillMaxWidth()
        Column(
            modifier = (if (scroll) body.verticalScroll(rememberScrollState()) else body).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content,
        )
        if (actions.isNotEmpty()) ActionBar(actions)
    }
}

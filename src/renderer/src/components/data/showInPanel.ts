import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { toast } from '../../store/toasts'
import { useApp } from '../../store/app'
import { focusedConversation } from '../../lib/conversation'
import { openSidePanelTab } from '../../lib/listPrefs'

export async function showInPanel(entry: string, part: string | null = null): Promise<void> {
  const sessionId = focusedConversation()?.sessionId
  if (!sessionId) {
    toast.error('No chat open', 'Open a chat first; it goes in that chat’s side panel.')
    return
  }
  try {
    await engine('panel.showEntry', { sessionId, entry, part })
    openSidePanelTab('outputs')
    if (useApp.getState().view !== 'chat') {
      toast.success('In the side panel', 'Added to the chat’s Outputs tab.')
    }
  } catch (err) {
    toast.error('Could not show it', errorText(err))
  }
}

import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { toast } from '../../store/toasts'
import { focusedConversation } from '../../lib/conversation'

export async function showInPanel(entry: string, part: string | null = null): Promise<void> {
  const sessionId = focusedConversation()?.sessionId
  if (!sessionId) {
    toast.error('No chat open', 'Open a chat first; it goes in that chat’s side panel.')
    return
  }
  try {
    await engine('panel.showEntry', { sessionId, entry, part })
    toast.success('In the side panel', 'Open the chat’s side panel to see it.')
  } catch (err) {
    toast.error('Could not show it', errorText(err))
  }
}

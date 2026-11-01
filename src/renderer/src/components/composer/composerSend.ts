import { engine } from '../../lib/ipc'
import { conversationOf, openChat, type Conversation } from '../../lib/conversation'
import { useSessions } from '../../store/sessions'
import { useWindows } from '../../store/windows'

export interface PadDraft {
  text: string
  page: string | null
  title: string
}

export const EMPTY_DRAFT: PadDraft = { text: '', page: null, title: '' }

async function rolled(text: string): Promise<string> {
  return (await engine('library.rollText', { text })).text
}

export async function sendInto(conv: Conversation, text: string): Promise<void> {
  await useSessions.getState().send(conv, await rolled(text))
}

export async function sendToChat(sessionId: string | null, agentId: string | null, text: string): Promise<void> {
  const home = useWindows.getState().home
  if (!home) throw new Error('There is no chat window open.')
  const message = await rolled(text)
  openChat(sessionId, agentId ?? undefined)
  await useSessions.getState().send(conversationOf(home), message)
}

export async function savePad(draft: PadDraft, title: string | null): Promise<PadDraft> {
  if (draft.page && title === null) {
    const page = await engine('data.pages.write', { id: draft.page, title: null, body: draft.text })
    return { ...draft, page: page.id, title: page.title }
  }
  const page = await engine('data.pages.create', { title: title ?? draft.title, body: draft.text, fields: [], type: null })
  return { ...draft, page: page.id, title: page.title }
}

export async function openPage(id: string): Promise<PadDraft> {
  const page = await engine('data.pages.get', { id })
  return { text: page.body, page: page.id, title: page.title }
}

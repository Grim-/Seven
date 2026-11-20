import { useDialogue } from '../dialogue/dialogueStore'
import { registerViewAct } from './registry'

registerViewAct('speak', (data, { title }) => {
  const dialogue = String(data.dialogue ?? '').trim()
  if (!dialogue) return
  const sheet = String(data.sheet ?? '').trim()
  const name = String(data.name ?? title ?? sheet).trim() || 'Character'
  useDialogue.getState().say(sheet, name, dialogue)
})

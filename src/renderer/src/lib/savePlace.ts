import { create } from 'zustand'
import type { SaveFolderAnswer } from '@shared/saveFolders'
import { engine } from './ipc'
import { failed } from './notify'

export interface SaveChoice {
  folder: string
  tags: string[]
}

interface Asking {
  id: number
  target: string
  answer: SaveFolderAnswer
  resolve: (choice: SaveChoice | null) => void
}

export const useSaving = create<{ queue: Asking[] }>(() => ({ queue: [] }))

let asked = 0
let shift = false

window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') shift = true
})
window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') shift = false
})
window.addEventListener('blur', () => {
  shift = false
})

export async function askPlace(where: { target?: string; type?: string | null }): Promise<SaveChoice | null> {
  const answer = await engine('saveFolders.answer', where)
  if (!answer.ask && !shift) return { folder: answer.folder, tags: [] }
  return new Promise((resolve) => useSaving.setState((s) => ({ queue: [...s.queue, { id: ++asked, target: answer.target, answer, resolve }] })))
}

export function rememberPlace(target: string, folder: string): Promise<unknown> {
  return engine('saveFolders.set', { target, place: { folder: folder.trim(), ask: false } })
}

export function answerPlace(asking: Asking, choice: SaveChoice | null, remember: boolean): void {
  useSaving.setState((s) => ({ queue: s.queue.filter((q) => q.id !== asking.id) }))
  if (choice && remember) void rememberPlace(asking.target, choice.folder).catch(failed('Could not remember the folder'))
  asking.resolve(choice)
}

export type { Asking }

// NOTE: This helper is STRICTLY for runtime simulation in Play mode.
// It mutates CharacterSheet.save and moves characters between runtime saves.
// NEVER import or invoke this function inside World Editor or Map Editor components.

import { askConfirm } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { noteMisfits } from './misfits'

export async function bringHere(world: string, sheet: string): Promise<boolean> {
  const save = (await engine('saves.current', { world })) ?? (await engine('saves.create', { world, name: 'Save 1', copy: false }))
  const s = await engine('sheets.get', { id: sheet })
  if (s.save === save.id) return true
  const go = () => engine('saves.bring', { id: save.id, sheet }).then(() => noteMisfits(sheet, s.title))
  if (!s.save) {
    await go()
    return true
  }
  return new Promise((resolve) =>
    askConfirm(`Move ${s.title} into ${save.name}?`, 'They are playing in another save. Moving them takes them out of it, with their state.', 'Move here', () =>
      go().then(
        () => resolve(true),
        (err) => {
          failed('Could not move them')(err)
          resolve(false)
        }
      )
    )
  )
}

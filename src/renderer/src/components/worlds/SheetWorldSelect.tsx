import { Select } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useWorlds } from './Worlds'
import { useSheetWorld } from './useSheetWorld'

export function SheetWorldSelect({ sheet, className }: { sheet: string; className?: string }) {
  const list = useWorlds()
  const current = useSheetWorld(sheet)
  const change = (world: string) =>
    void (world ? engine('worlds.addCharacter', { id: world, sheet, map: null }) : engine('worlds.removeCharacter', { sheet })).catch(failed('Could not change the world'))
  return (
    <Select
      value={current ?? ''}
      options={[{ value: '', label: 'Not in a world' }, ...list.map((w) => ({ value: w.id, label: w.name }))]}
      onChange={change}
      className={className}
    />
  )
}

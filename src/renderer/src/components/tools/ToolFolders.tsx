import { useEffect } from 'react'
import { FolderOpen } from 'lucide-react'
import { Button, Field, NumberField, PathRow } from '../ui'
import { engine, main } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { toast } from '../../store/toasts'
import { useTools } from '../../store/tools'
import { failed } from '../../lib/notify'
import { noteFailure } from '../../store/problems'

const LABEL = { toolsFolder: 'Tools', skillsFolder: 'Skills' } as const

export function ToolFolders() {
  const prefs = useTools((s) => s.prefs)

  useEffect(() => {
    engine('tools.prefs.get')
      .then((p) => useTools.setState({ prefs: p }))
      .catch(noteFailure('tools', 'Could not read the tool folders'))
  }, [])

  const pick = async (key: keyof typeof LABEL) => {
    const folder = await main('dialog.openFolder')
    if (!folder) return
    try {
      useTools.setState({ prefs: await engine('tools.prefs.set', { [key]: folder }) })
    } catch (err) {
      toast.error('Could not change the folder', errorText(err))
    }
  }

  return (
    <>
      {(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((key) => (
        <PathRow key={key} label={LABEL[key]} path={prefs?.[key] ?? '…'}>
          <Button size="sm" variant="ghost" icon={<FolderOpen />} disabled={!prefs} onClick={() => prefs && void main('folder.open', { path: prefs[key] }).catch(failed('Could not open'))}>
            Open
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void pick(key)}>
            Change…
          </Button>
        </PathRow>
      ))}
      <Field label="Zip install limit (MB)" hint="A zip that unpacks to more than this is refused." className="max-w-xs">
        <NumberField value={prefs?.zipLimitMb} min={1} onChange={(v) => typeof v === 'number' && void engine('tools.prefs.set', { zipLimitMb: v }).then((p) => useTools.setState({ prefs: p })).catch(failed('Could not save the limit'))} />
      </Field>
    </>
  )
}

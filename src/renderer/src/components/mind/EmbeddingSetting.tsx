import { useEffect, useState } from 'react'
import type { MindPrefs } from '@shared/types'
import { Select, SettingRow } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useModels } from '../../store/models'

export function EmbeddingSetting() {
  const models = useModels((s) => s.list)
  const [prefs, setPrefs] = useState<(MindPrefs & { loaded: boolean; error: string | null }) | null>(null)
  useEffect(() => {
    void engine('mind.prefs.get').then(setPrefs).catch(() => undefined)
  }, [])
  if (!prefs) return null
  const change = (id: string) =>
    void engine('mind.prefs.set', { embeddingModelId: id || null })
      .then(setPrefs)
      .catch(failed('Could not change the embedding model'))
  return (
    <SettingRow
      label="Memory search model"
      hint={
        prefs.error
          ? `Could not load it: ${prefs.error}`
          : 'A small embedding model (for example EmbeddingGemma 300M or nomic-embed-text) lets agents search their memory by meaning. It runs on the CPU. Without one, search matches words only. Changing it re-indexes everything in the background.'
      }
    >
      <Select value={prefs.embeddingModelId ?? ''} options={[{ value: '', label: 'None (words only)' }, ...models.map((m) => ({ value: m.id, label: m.name }))]} onChange={change} className="w-64" />
    </SettingRow>
  )
}


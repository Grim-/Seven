import { useEffect, useState } from 'react'
import type { ContextPrefs } from '@shared/types'
import { NumberField, SettingCard, SettingRow, Toggle } from '../components/ui'
import { EmbeddingSetting } from '../components/mind/EmbeddingSetting'
import { engine } from '../lib/ipc'
import { failed } from '../lib/notify'

export function useContextPrefs(): [ContextPrefs | null, (patch: Partial<ContextPrefs>) => void] {
  const [prefs, setPrefs] = useState<ContextPrefs | null>(null)
  useEffect(() => {
    engine('contextPrefs.get')
      .then(setPrefs)
      .catch(() => setPrefs(null))
  }, [])
  const update = (patch: Partial<ContextPrefs>) => {
    engine('contextPrefs.set', patch)
      .then(setPrefs)
      .catch(failed('Could not save'))
  }
  return [prefs, update]
}

export function MemoryPanel({ className }: { className?: string }) {
  const [prefs, update] = useContextPrefs()
  return (
    <SettingCard title="Memory and context" className={className} intro="Each agent has its own private, encrypted mind, in Data under Minds. Things every agent should know go on a page in Data.">
      <SettingRow label="Pinned memories limit (tokens)" hint="Above this, the oldest pinned memories are left out of the prompt.">
        <NumberField value={prefs?.memoryCap} min={200} max={16000} step={100} onChange={(v) => v !== undefined && update({ memoryCap: v })} className="w-32" />
      </SettingRow>
      <SettingRow
        label="Keep model state when switching chats"
        hint="Experiment. Saves the model's working memory to disk when you switch away and loads it when you come back, instead of re-reading the chat. Files can be large; the 3 most recent are kept."
      >
        <Toggle checked={prefs?.saveChatState ?? false} onChange={(v) => update({ saveChatState: v })} label={prefs?.saveChatState ? 'On' : 'Off'} />
      </SettingRow>
      <EmbeddingSetting />
    </SettingCard>
  )
}

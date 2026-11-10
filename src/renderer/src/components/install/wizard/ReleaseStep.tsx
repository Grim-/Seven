import { useEffect, useState } from 'react'
import type { InstallChoice, InstallHelperState } from '@shared/types'
import { AlertBox, Button, Field, Select } from '../../ui'
import { engine } from '../../../lib/ipc'
import { errorText } from '../../../lib/format'
import { failed } from '../../../lib/notify'
import { ChoiceRow } from './ChoiceRow'

export function ReleaseStep({ state, tag, build, onTag, onBuild }: { state: InstallHelperState; tag: string; build: string; onTag: (tag: string) => void; onBuild: (build: string) => void }) {
  const [choices, setChoices] = useState<InstallChoice[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!tag) return
    let live = true
    setChoices(null)
    setError(null)
    engine('install.choices', { helper: state.id, tag })
      .then((list) => live && setChoices(list))
      .catch((err) => live && setError(errorText(err)))
    return () => {
      live = false
    }
  }, [state.id, tag])
  if (!state.releases.length)
    return (
      <div className="flex flex-col items-start gap-2 text-[13px]">
        <span>Seven hasn't listed the releases yet.</span>
        <Button size="sm" variant="secondary" onClick={() => void engine('install.check', { helper: state.id }).catch(failed('Could not check for releases'))}>
          Check for releases
        </Button>
      </div>
    )
  return (
    <div className="flex flex-col gap-3">
      <Field label="Release">
        <Select value={tag} options={[{ value: '', label: 'Pick a release…' }, ...state.releases.map((r) => ({ value: r.tag, label: r.publishedAt ? `${r.tag} · ${new Date(r.publishedAt).toLocaleDateString()}` : r.tag }))]} onChange={(v) => onTag(v)} />
      </Field>
      {error && <AlertBox>{error}</AlertBox>}
      {tag && !choices && !error && <span className="text-[12.5px] text-dim">Reading the builds in {tag}…</span>}
      {choices && (
        <Field label="Build" group>
          <div className="flex flex-col gap-1.5">
            {choices.length ? choices.map((c) => <ChoiceRow key={c.build} choice={c} picked={c.build === build} onPick={() => onBuild(c.build)} />) : <span className="text-[12.5px] text-dim">This release has no Windows build Seven recognises. The file patterns are in settings.</span>}
          </div>
        </Field>
      )}
    </div>
  )
}

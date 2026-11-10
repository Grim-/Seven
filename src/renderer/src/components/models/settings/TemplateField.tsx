import { useEffect, useState } from 'react'
import type { ChatTemplate, ModelEntry } from '@shared/types'
import { Select, SaveState, SettingRow, Textarea, useAutosavedState } from '../../ui'
import { engine } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'

export function TemplateField({ model }: { model: ModelEntry }) {
  const [choice, setChoice] = useState<ChatTemplate | null>(null)
  const template = useAutosavedState('', (t) => engine('models.template.set', { id: model.id, choice: { type: 'jinja', template: t } }).then(setChoice), { when: (t) => Boolean(t.trim()) })
  const setText = template.reset
  useEffect(() => {
    void engine('models.template.get', { id: model.id })
      .then((r) => {
        setChoice(r)
        setText(r.type === 'jinja' ? r.template : '')
      })
      .catch(() => undefined)
  }, [model.id])
  if (!choice) return null
  const options = [
    { value: 'auto', label: 'From the model file' },
    { value: 'jinja', label: 'Custom Jinja template' }
  ]
  const pick = (v: string) => {
    if (v === 'jinja') setChoice({ type: 'jinja', template: template.value })
    else
      void engine('models.template.set', { id: model.id, choice: { type: 'auto' } })
        .then(setChoice)
        .catch(failed('Could not change the template'))
  }
  return (
    <>
      <SettingRow label="Chat template" hint="How chats are formatted for this model. Paste your own when the template in the file is broken. Reloads the model on the next message.">
        <Select value={choice.type} options={options} onChange={pick} className="h-7 w-72 text-[12px]" />
      </SettingRow>
      {choice.type === 'jinja' && (
        <div className="flex flex-col gap-2">
          <Textarea mono rows={10} value={template.value} onChange={(e) => template.set(e.target.value)} placeholder="Paste a Jinja chat template" />
          <SaveState status={template.status} error={template.error} />
        </div>
      )}
    </>
  )
}


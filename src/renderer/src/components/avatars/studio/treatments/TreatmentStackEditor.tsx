import type { KeyboardEvent, MouseEvent } from 'react'
import { Plus } from 'lucide-react'
import { TREATMENT_ON, avatarTreatmentInfo, avatarTreatments, type Avatar, type TreatmentEntry } from '@shared/avatars'
import { UP_DOWN, stepByKey } from '../../../../lib/stepKeys'
import { isTypingTarget } from '../../../../store/keybinds'
import { FieldGrid, openMenu, useReorder } from '../../../ui'
import { SettingControls } from '../../../settingSpec/SettingControls'
import { TreatmentPicker } from './TreatmentPicker'
import { TreatmentRow } from './TreatmentRow'
import { treatmentActions } from './treatmentActions'
import { useTreatmentStack } from './useTreatmentStack'

export function TreatmentStackEditor({ avatar, entries, onChange, editing, readOnly }: { avatar: Avatar; entries: TreatmentEntry[]; onChange: (next: TreatmentEntry[]) => void; editing: string; readOnly: boolean }) {
  const stack = useTreatmentStack(entries, onChange, editing)
  const { props, isOver } = useReorder(stack.reorder)
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = stepByKey(e, entries.findIndex((x) => x.key === stack.picked), entries.length, UP_DOWN)
    if (at !== null) return stack.pick(entries[at].key)
    if (e.key !== 'Delete' || readOnly || !stack.picked || isTypingTarget(e)) return
    e.preventDefault()
    stack.remove(stack.picked)
  }
  const blankMenu = (e: MouseEvent) => {
    if (readOnly || e.target !== e.currentTarget) return
    openMenu(e, 'Treatments', [{ label: 'Add treatment', icon: <Plus />, children: avatarTreatments().map((t) => ({ label: t.label, hint: t.description, onSelect: () => stack.add(t.id) })) }])
  }
  return (
    <div onKeyDown={keys} onContextMenu={blankMenu} className="flex min-h-full flex-col gap-px">
      <fieldset disabled={readOnly} className="contents">
        {entries.map((entry, i) => {
          const info = avatarTreatmentInfo(entry.type)
          const values = stack.valuesOf(entry)
          const specs = (info?.settings ?? []).filter((s) => s !== TREATMENT_ON && (!stack.posed || info?.poseSettings.includes(s.name)))
          return (
            <TreatmentRow
              key={entry.key}
              avatar={avatar}
              entry={entry}
              open={stack.picked === entry.key}
              on={values.on === true}
              marked={stack.overridden(entry)}
              actions={readOnly ? [] : treatmentActions(stack, entry)}
              reorder={readOnly ? {} : props(i)}
              over={isOver(i)}
              onPick={() => stack.pick(stack.picked === entry.key ? null : entry.key)}
              onToggle={(on) => stack.change(entry.key, TREATMENT_ON.name, on)}
            >
              <FieldGrid dense>
                <SettingControls specs={specs} values={values} onChange={(name, value) => stack.change(entry.key, name, value)} readOnly={readOnly} changed={stack.changedOf(entry)} onReset={stack.reset && ((name) => stack.reset!(entry.key, name))} />
              </FieldGrid>
            </TreatmentRow>
          )
        })}
      </fieldset>
      {!readOnly && <TreatmentPicker avatar={avatar} onAdd={stack.add} />}
    </div>
  )
}

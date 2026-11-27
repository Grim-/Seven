import type { ReactNode } from 'react'
import { ChevronDown, Eraser } from 'lucide-react'
import { avatarRendererInfo } from '@shared/avatars'
import { useViewPlace } from '../../../lib/viewPlace'
import { FieldGrid, Popover, RowAction, ShellTabs } from '../../ui'
import { SettingControls } from '../../settingSpec/SettingControls'
import { RendererPicker } from './RendererPicker'
import { poseLabel } from './poses'
import type { PoseLook } from './usePoseLook'

const LOOK_GROUP = 'look'

const GROUPS: { value: string; label: string }[] = [
  { value: LOOK_GROUP, label: 'Look' },
  { value: 'frames', label: 'Frames' },
  { value: 'glances', label: 'Glances' },
  { value: 'motion', label: 'Motion' }
]

function RendererChoice({ value, onChange }: { value: string; onChange: (renderer: string) => void }) {
  return (
    <Popover
      title="Drawn as"
      trigger={
        <span className="flex items-center gap-1 border border-line px-2 py-0.5 font-label text-[10.5px] caps-10 text-dim hover:border-accent hover:text-ink">
          {avatarRendererInfo(value)?.label ?? value}
          <ChevronDown className="h-3 w-3" />
        </span>
      }
      className="p-2.5"
    >
      {(close) => (
        <RendererPicker
          value={value}
          onChange={(renderer) => {
            close()
            onChange(renderer)
          }}
        />
      )}
    </Popover>
  )
}

export interface InspectorTab {
  value: string
  label: string
  body: () => ReactNode
}

export function AvatarInspector({ look, renderer, readOnly, onRenderer, extraTabs, footer }: { look: PoseLook; renderer: string; readOnly: boolean; onRenderer: (renderer: string) => void; extraTabs: InspectorTab[]; footer: ReactNode }) {
  const [tab, setTab] = useViewPlace('avatarStudio.tab', LOOK_GROUP)
  const groupOf = (spec: { group?: string }) => spec.group ?? LOOK_GROUP
  const tabs: InspectorTab[] = [
    ...GROUPS.filter((g) => look.specs.some((s) => groupOf(s) === g.value)).map((g) => ({
      ...g,
      body: () => (
        <FieldGrid>
          <SettingControls specs={look.specs.filter((s) => groupOf(s) === g.value)} values={look.values} onChange={look.change} readOnly={readOnly} changed={look.changed} onReset={look.reset} />
        </FieldGrid>
      )
    })),
    ...extraTabs
  ]
  const active = tabs.find((t) => t.value === tab) ?? tabs[0]
  const own = look.posed && look.marked.includes(look.editing)
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className="type-eyebrow text-accent">{look.posed ? poseLabel(look.editing) : 'Base look'}</span>
        {look.posed && <span className="font-label text-[10px] caps-10 text-faint">{own ? 'own look' : 'from base'}</span>}
        {own && !readOnly && <RowAction title="Clear this look" icon={<Eraser />} danger onClick={() => look.clear(look.editing)} />}
        {!readOnly && (
          <span className="ml-auto">
            <RendererChoice value={renderer} onChange={onRenderer} />
          </span>
        )}
      </div>
      {tabs.length > 1 && <ShellTabs value={active?.value ?? LOOK_GROUP} options={tabs.map(({ value, label }) => ({ value, label }))} onChange={setTab} className="px-3" />}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{active?.body()}</div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line/40 px-3 py-2.5">{footer}</div>
    </div>
  )
}

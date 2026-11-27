import { ArrowDownToLine, ArrowUpToLine, Box, Flag, Move, RotateCw, Swords, Trash2 } from 'lucide-react'
import type { ConditionGating, ObjectLayerData, PropCollision } from '@shared/maps'
import { Field, Segmented, confirmDelete, type MenuItem } from '../ui'
import { ObjectPlayManager } from './ObjectPlayManager'
import { FlagSelect } from '../game/FlagSelect'
import { EntrySelect } from '../game/EntrySelect'
import { PictureFields } from './PictureFields'
import { InspectorShell, type InspectorTab } from './InspectorShell'

interface Props {
  object: ObjectLayerData
  world?: string
  gating?: ConditionGating
  isExpanded?: boolean
  onToggleExpand?: () => void
  onChange: (next: ObjectLayerData) => void
  onChangeGating: (gating: ConditionGating | null) => void
  onBringToFront: () => void
  onSendToBack: () => void
  onDelete: () => void
  onClose: () => void
  extraTabs?: InspectorTab[]
}

const COLLISIONS: { value: PropCollision; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'passable', label: 'Passable' },
  { value: 'water', label: 'Water' }
]

export function WorldObjectInspector({ object, world = '', gating, isExpanded, onToggleExpand, onChange, onChangeGating, onBringToFront, onSendToBack, onDelete, onClose, extraTabs = [] }: Props) {
  const gate = (patch: ConditionGating) => {
    const next = { ...gating, ...patch }
    onChangeGating(next.needsFlag || next.hiddenIfFlag ? next : null)
  }
  const tabs: InspectorTab[] = [
    {
      id: 'object',
      label: 'Object',
      icon: <Box />,
      body: (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-line tone-well-90 p-1">
              <img src={object.image} alt={object.name} className="max-h-full max-w-full object-contain" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Segmented value={object.collision ?? 'solid'} options={COLLISIONS} onChange={(collision) => onChange({ ...object, collision })} />
            </div>
          </div>
          <Field label="Library entry">
            <EntrySelect value={object.entry || null} onChange={(entry) => onChange({ ...object, entry })} />
          </Field>
        </div>
      )
    },
    { id: 'place', label: 'Place', icon: <Move />, body: <div className="flex flex-col gap-2"><PictureFields layer={object} onChange={onChange} /></div> },
    {
      id: 'play',
      label: 'Play',
      icon: <Swords />,
      body: (
        <ObjectPlayManager
          actionsText={object.actions ?? ''}
          decisionsText={object.decisions ?? ''}
          onChangeActions={(actions) => onChange({ ...object, actions })}
          onChangeDecisions={(decisions) => onChange({ ...object, decisions })}
          world={world}
        />
      )
    },
    {
      id: 'rules',
      label: 'Rules',
      icon: <Flag />,
      count: [gating?.needsFlag, gating?.hiddenIfFlag].filter(Boolean).length || undefined,
      body: (
        <div className="grid grid-cols-2 gap-2 phone:grid-cols-1">
          <Field label="Shown while flag set">
            <FlagSelect world={world} value={gating?.needsFlag} onChange={(needsFlag) => gate({ needsFlag })} placeholder="Always" />
          </Field>
          <Field label="Hidden while flag set">
            <FlagSelect world={world} value={gating?.hiddenIfFlag} onChange={(hiddenIfFlag) => gate({ hiddenIfFlag })} placeholder="Never" />
          </Field>
        </div>
      )
    },
    ...extraTabs
  ]
  const actions: MenuItem[] = [
    { label: 'Rotate 90°', icon: <RotateCw />, onSelect: () => onChange({ ...object, rotation: (object.rotation + 90) % 360 }) },
    { label: 'To front', icon: <ArrowUpToLine />, onSelect: onBringToFront },
    { label: 'To back', icon: <ArrowDownToLine />, onSelect: onSendToBack },
    { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => confirmDelete(`Delete ${object.name}?`, 'This removes it from the map.', async () => onDelete()) }
  ]
  return (
    <InspectorShell
      icon={<Box className="text-secondary-ink" />}
      title={object.name}
      onRename={(name) => onChange({ ...object, name })}
      place="worldObject"
      tabs={tabs}
      actions={actions}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      onClose={onClose}
    />
  )
}

import { componentClass, componentsFor, type ComponentDef } from '@shared/game/core'
import { NamedIcon, openMenu } from '../../ui'
import { ParamTokens } from '../ParamTokens'
import { partActions, partKeys, type PartHandlers } from './partActions'
import { partIcon, partLabel, partTone } from './partInfo'
import { Pieces } from './Pieces'

export function PartCard({ def, index, size, onChange, handlers }: { def: ComponentDef; index: number; size: number; onChange: (def: ComponentDef) => void; handlers: PartHandlers }) {
  const Class = componentClass(def.type)
  const label = partLabel(Class, def.type)
  const items = partActions(handlers, index, size)
  const holds = componentsFor(def.type).length > 0
  const children = Array.isArray(def.comps) ? (def.comps as ComponentDef[]) : []
  return (
    <div
      tabIndex={0}
      onKeyDown={partKeys(handlers)}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        openMenu(e, label, items)
      }}
      style={{ ['--tone' as string]: partTone(Class) }}
      className="notch-sm group flex flex-col gap-3 border border-l-[3px] border-[#1c1f28] border-l-[var(--tone)] bg-[linear-gradient(90deg,color-mix(in_srgb,var(--tone)_7%,#12151c),#12151c_60%)] p-3 outline-none transition-colors hover:border-[#2c3140] hover:border-l-[var(--tone)] focus-visible:border-[color-mix(in_srgb,var(--tone)_70%,transparent)]"
    >
      <div className="flex items-center gap-2.5">
        <NamedIcon name={partIcon(Class)} className="h-[18px] w-[18px] shrink-0 text-[var(--tone)]" />
        <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-white" title={Class?.DESCRIPTION}>
          {label}
        </span>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 touch:opacity-100">
          {items.map((item) => (
            <button key={item.label} type="button" title={`${item.label} (${item.hint})`} disabled={item.disabled} onClick={item.onSelect} className="grid h-[26px] w-[26px] place-items-center text-faint hover:bg-white/5 hover:text-white disabled:opacity-30">
              {item.icon}
            </button>
          ))}
        </div>
      </div>
      {Class && Object.keys(Class.PARAMS).length > 0 && <ParamTokens schema={Class.PARAMS} values={def} onChange={(next) => onChange({ ...def, ...next })} />}
      {holds && <Pieces host={def.type} value={children} onChange={(comps) => onChange({ ...def, comps })} />}
    </div>
  )
}

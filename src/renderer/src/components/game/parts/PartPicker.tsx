import { Plus } from 'lucide-react'
import { componentsFor } from '@shared/game/core'
import { NamedIcon, Popover } from '../../ui'
import { partIcon, partLabel } from './partInfo'

export function PartPicker({ host, onPick }: { host: string; onPick: (type: string) => void }) {
  const fits = componentsFor(host)
  if (!fits.length) return null
  return (
    <Popover
      align="start"
      className="notch-sm flex w-[min(24rem,94vw)] flex-col gap-1 p-2"
      triggerClassName="inline-flex items-center gap-2 self-start border border-dashed border-ink/15 px-2.5 py-1.5 font-label text-[10.5px] font-bold caps-12 text-dim hover:border-accent hover:text-accent"
      trigger={
        <>
          <Plus className="h-3 w-3" />
          Add
        </>
      }
    >
      {(close) =>
        fits.map((Class) => (
          <button
            key={Class.type}
            type="button"
            onClick={() => {
              onPick(Class.type)
              close()
            }}
            className="flex items-start gap-2.5 px-2 py-1.5 text-left hover:bg-ink/5"
          >
            <NamedIcon name={partIcon(Class)} className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] font-semibold text-ink">{partLabel(Class, Class.type)}</span>
              <span className="text-[11.5px] leading-snug text-dim">{Class.DESCRIPTION}</span>
            </span>
          </button>
        ))
      }
    </Popover>
  )
}

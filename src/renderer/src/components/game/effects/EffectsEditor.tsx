import { useMemo, type KeyboardEvent } from 'react'
import { Play } from 'lucide-react'
import { Popover } from '../../ui'
import type { ComponentDef } from '@shared/game/core'
import type { EffectLane } from '@shared/game/components'
import { EffectsContext, type EffectsScope } from './context'
import { EffectsInWords } from './EffectsInWords'
import { EffectsTry } from './EffectsTry'
import { EffectSteps } from './EffectSteps'
import { SectionTag } from '../SectionTag'
import { hostLanes, hostTries, pieceChoices } from './pieces'
import { nodesAt, parseKey } from './tree'
import { useEffectsEditing } from './useEffectsEditing'
import { isTypingTarget, matchesKeybind } from '../../../store/keybinds'
import './tokens'

const NO_LANES: EffectLane[] = [{ event: 'OnUse', label: 'When it happens' }]

function useKeys(scope: EffectsScope): (e: KeyboardEvent) => void {
  return (e) => {
    if (!e.currentTarget.contains(e.target as Node)) return
    if (isTypingTarget(e)) return
    if (e.key === 'Escape' && (scope.adding || scope.selected)) {
      scope.setAdding(null)
      scope.select(null)
      return
    }
    if (!scope.selected) return
    const { path, index } = parseKey(scope.selected)
    if (!nodesAt(scope.tree, path)[index]) return
    const act = (fn: () => void) => {
      e.preventDefault()
      fn()
    }
    if (matchesKeybind('effects.delete', e)) act(() => scope.remove(path, index))
    else if (matchesKeybind('effects.duplicate', e)) act(() => scope.duplicate(path, index))
    else if (matchesKeybind('effects.moveUp', e)) act(() => scope.move(path, index, index - 1))
    else if (matchesKeybind('effects.moveDown', e)) act(() => scope.move(path, index, index + 1))
    else if (matchesKeybind('effects.add', e)) act(() => scope.setAdding({ path, index: index + 1 }))
  }
}

export function EffectsEditor({ host, value, onChange, lanes, aside = true }: { host: string; value: ComponentDef[]; onChange: (next: ComponentDef[]) => void; lanes?: EffectLane[]; aside?: boolean }) {
  const using = lanes ?? hostLanes(host) ?? NO_LANES
  const editing = useEffectsEditing(value, using, onChange)
  const choices = useMemo(() => pieceChoices(host), [host])
  const scope: EffectsScope = { ...editing, choices }
  const keys = useKeys(scope)
  const tries = hostTries(host)
  return (
    <EffectsContext.Provider value={scope}>
      <div onKeyDown={keys} className="flex min-w-0 flex-wrap gap-x-5 gap-y-4 border border-line/50 tone-panel-40">
        <div className="flex min-w-0 flex-[1_1_28rem] flex-col gap-5 p-4">
          {editing.tree.map((l, i) => (
            <section key={l.lane.event} className="flex flex-col gap-2.5">
              <SectionTag>{l.lane.label}</SectionTag>
              <EffectSteps nodes={l.nodes} path={[i]} />
            </section>
          ))}
        </div>
        {!aside && tries && (
          <div className="flex w-full justify-end px-4 pb-3">
            <Popover
              align="end"
              className="notch-sm w-[min(22rem,94vw)] p-4"
              triggerClassName="inline-flex items-center gap-2 border border-dashed border-ink/15 px-2.5 py-1.5 font-label text-[10.5px] font-bold caps-12 text-dim hover:border-accent hover:text-accent"
              trigger={
                <>
                  <Play className="h-3 w-3" />
                  Try it
                </>
              }
            >
              <EffectsTry defs={value} lanes={using} />
            </Popover>
          </div>
        )}
        {aside && (
          <aside className="flex min-w-0 flex-[1_1_16rem] flex-col gap-5 border-l border-line/50 tone-panel-30 p-4">
            <EffectsInWords tree={editing.tree} />
            {tries && <EffectsTry defs={value} lanes={using} />}
          </aside>
        )}
      </div>
    </EffectsContext.Provider>
  )
}

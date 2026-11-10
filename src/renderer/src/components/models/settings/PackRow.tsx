import type { PackView } from '@shared/types'
import { ActionBar, SettingRow, StatusBadge, Toggle, openMenu } from '../../ui'
import { packActions, packMoves, packRemove, packToggle } from './packActions'

function shown(value: unknown): string {
  return typeof value === 'boolean' ? (value ? 'On' : 'Off') : String(value)
}

export function PackRow({ pack, on, setOn }: { pack: PackView; on: string[]; setOn: (on: string[]) => void }) {
  const toggle = packToggle(pack, on, setOn)
  return (
    <div onContextMenu={(e) => openMenu(e, pack.title, packActions(pack, on, setOn))} className="flex flex-col">
      <SettingRow label={pack.title} hint={pack.for || undefined} aside={pack.shipped ? <StatusBadge tone="idle">Seven</StatusBadge> : <StatusBadge tone="busy">Yours</StatusBadge>}>
        <Toggle checked={pack.on} disabled={toggle.disabled} onChange={() => toggle.onSelect?.()} label={pack.on ? 'On' : 'Off'} />
      </SettingRow>
      <div className="flex flex-col gap-1.5 px-3.5 pb-3 text-[12px]">
        {pack.why && <span className="text-dim">{pack.why}</span>}
        {pack.sets.map((s) => (
          <span key={s.key} className={pack.overridden.includes(s.key) ? 'text-faint line-through' : 'text-white/80'}>
            {s.label}: <span className="font-mono">{shown(s.value)}</span>
            {pack.overridden.includes(s.key) && <span className="ml-2 no-underline">a later pack sets this</span>}
          </span>
        ))}
        {pack.invalid && <span className="text-alert">{pack.invalid}</span>}
        {!pack.invalid && pack.failed.map((f) => <span key={f} className="text-dim">Doesn't match: {f}.</span>)}
        {pack.source && (
          <a href={pack.source} target="_blank" rel="noreferrer" className="truncate text-accent hover:underline">
            {pack.source}
          </a>
        )}
        <ActionBar row items={[...packMoves(pack, on, setOn), ...(pack.shipped ? [] : [packRemove(pack)])]} />
      </div>
    </div>
  )
}

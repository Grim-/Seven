import type { PlayAim } from './PlayScene'

export function AimHint({ aim }: { aim: PlayAim | null }) {
  if (!aim) return null
  return <div className="pointer-events-none absolute left-1/2 top-20 z-20 -translate-x-1/2 border border-secondary-ink/60 tone-panel-90 px-3 py-1.5 font-ui text-[12px] text-secondary-ink">{aim.label}: click a character, an object, or right-click a spot · Esc cancels</div>
}

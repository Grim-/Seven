import type { PlayAim } from './PlayScene'

export function AimHint({ aim }: { aim: PlayAim | null }) {
  if (!aim) return null
  return <div className="pointer-events-none absolute left-1/2 top-20 z-20 -translate-x-1/2 border border-cyan/60 bg-black/90 px-3 py-1.5 font-mono text-[12px] text-cyan">{aim.label}: click a character, an object, or right-click a spot · Esc cancels</div>
}

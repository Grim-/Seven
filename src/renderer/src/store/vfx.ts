export interface VfxCue {
  preset: string
  color?: string
  intensity?: number
  durationMs?: number
  loop?: boolean
}

type Listener = (cue: VfxCue) => void

const listeners = new Map<string, Set<Listener>>()
const lastFired = new Map<string, number>()
const COOLDOWN_MS = 100

export function subscribeVfx(target: string, listener: Listener): () => void {
  if (!target) return () => undefined
  let set = listeners.get(target)
  if (!set) {
    set = new Set()
    listeners.set(target, set)
  }
  set.add(listener)
  return () => {
    set?.delete(listener)
    if (set && !set.size) listeners.delete(target)
  }
}

export function triggerVfx(targets: string | (string | null | undefined)[], cue: VfxCue): void {
  const now = performance.now()
  const list = Array.isArray(targets) ? targets : [targets]
  for (const target of list) {
    if (!target) continue
    const key = `${target}:${cue.preset}`
    const prev = lastFired.get(key) ?? 0
    if (now - prev < COOLDOWN_MS) continue
    lastFired.set(key, now)
    for (const listener of listeners.get(target) ?? []) listener(cue)
  }
}

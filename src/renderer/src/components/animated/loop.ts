export interface Ticking {
  tick(time: number): void
  pause(time: number): void
}

const live = new Set<Ticking>()
let frame = 0

function run(time: number): void {
  frame = live.size ? requestAnimationFrame(run) : 0
  if (document.hidden) {
    for (const t of live) t.pause(time)
    return
  }
  for (const t of live) t.tick(time)
}

export function startTicking(t: Ticking): void {
  live.add(t)
  if (!frame) frame = requestAnimationFrame(run)
}

export function stopTicking(t: Ticking): void {
  live.delete(t)
}

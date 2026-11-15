export type Ease = (t: number) => number

export const EASE = {
  linear: (t: number) => t,
  out: (t: number) => 1 - (1 - t) ** 3,
  inOut: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  back: (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2
} satisfies Record<string, Ease>

type Numbers = Record<string, number>

interface Tween {
  target: Numbers
  from: Numbers
  to: Numbers
  time: number
  duration: number
  ease: Ease
  done?: () => void
}

export class Tweens {
  private list: Tween[] = []
  onWake?: () => void

  get active(): boolean {
    return this.list.length > 0
  }

  to(target: object, to: Numbers, duration: number, ease: Ease = EASE.out, done?: () => void): void {
    const t = target as Numbers
    const keys = Object.keys(to)
    this.list = this.list.filter((w) => w.target !== t || !keys.some((k) => k in w.to))
    if (duration <= 0) {
      Object.assign(t, to)
      this.onWake?.()
      done?.()
      return
    }
    this.list.push({ target: t, from: Object.fromEntries(keys.map((k) => [k, t[k]])), to, time: 0, duration, ease, done })
    this.onWake?.()
  }

  cancel(target: object): void {
    this.list = this.list.filter((w) => w.target !== target)
  }

  update(dt: number): void {
    if (!this.list.length) return
    const finished: Tween[] = []
    for (const w of this.list) {
      w.time += dt
      const k = Math.min(1, w.time / w.duration)
      const e = w.ease(k)
      for (const key in w.to) w.target[key] = w.from[key] + (w.to[key] - w.from[key]) * e
      if (k >= 1) finished.push(w)
    }
    this.onWake?.()
    if (!finished.length) return
    this.list = this.list.filter((w) => !finished.includes(w))
    for (const w of finished) w.done?.()
  }

  clear(): void {
    this.list = []
  }
}

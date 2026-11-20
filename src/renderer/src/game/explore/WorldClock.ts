import { GameClock, type Calendar, type ClockState, type TimeDef } from '@shared/game/core'

export interface ClockView {
  clockId: string
  label: string
  calendar: Calendar
  dayPart: number
  hourSeconds: number
  roundSeconds: number
  toDawn: number
  longRestIn: number
  shortRestLabel: string
  longRestLabel: string
}

export class WorldClock {
  private clock: GameClock
  private shown = ''
  private longRestAt: number | null = null

  constructor(
    readonly def: TimeDef,
    state: ClockState,
    longRestAt: number | null,
    private show: (view: ClockView) => void
  ) {
    this.clock = new GameClock(def.clock)
    this.set(state, longRestAt)
  }

  get daylight(): number {
    return this.clock.calendar().daylight
  }

  set(state: ClockState, longRestAt: number | null): void {
    this.clock.fromJSON(state)
    this.longRestAt = longRestAt
    const v = this.view()
    const key = `${v.calendar.day}:${v.calendar.hour}:${v.calendar.minute}:${v.longRestIn}`
    if (key === this.shown) return
    this.shown = key
    this.show(v)
  }

  view(): ClockView {
    const day = this.clock.daySeconds
    const hour = this.def.clock.hourSeconds
    const intoDay = this.clock.time % day
    const dawn = this.def.dawnHour * hour
    const longRestIn = this.longRestAt === null ? 0 : Math.max(0, this.longRestAt + this.def.longRestGapSeconds - this.clock.time)
    const hours = (seconds: number) => `${Math.round((seconds / hour) * 10) / 10} h`
    return { clockId: this.def.id, label: this.def.label, calendar: this.clock.calendar(), dayPart: intoDay / day, hourSeconds: hour, roundSeconds: this.def.roundSeconds, toDawn: (dawn - intoDay + day) % day || day, longRestIn, shortRestLabel: hours(this.def.shortRestSeconds), longRestLabel: hours(this.def.longRestSeconds) }
  }
}

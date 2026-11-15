import { GameClock, type Calendar, type ClockState, type TimeDef } from '@shared/game/core'

export interface ClockView {
  clockId: string
  label: string
  calendar: Calendar
  dayPart: number
  speed: number
  paused: boolean
  speeds: number[]
}

const SPEEDS = [1, 2, 4, 8]

export interface ClockHooks {
  tick: (seconds: number) => void
  show: (view: ClockView) => void
  save: (clockId: string, state: ClockState) => void
}

export class WorldClock {
  private clock: GameClock
  private shown = ''

  constructor(
    readonly def: TimeDef,
    state: ClockState,
    private hooks: ClockHooks
  ) {
    this.clock = new GameClock(def.clock, (seconds) => this.hooks.tick(seconds))
    this.clock.fromJSON(state)
    this.clock.setSpeed(this.clock.speed)
    this.show()
  }

  get daylight(): number {
    return this.clock.calendar().daylight
  }

  get paused(): boolean {
    return this.clock.paused
  }

  update(dt: number): void {
    if (this.clock.advance(dt) > 0) this.save()
    this.show()
  }

  setSpeed(speed: number): void {
    this.clock.setSpeed(speed)
    this.clock.setPaused(false)
    this.save()
    this.show()
  }

  setPaused(paused: boolean): void {
    this.clock.setPaused(paused)
    this.save()
    this.show()
  }

  save(): void {
    this.hooks.save(this.def.id, this.clock.toJSON())
  }

  view(): ClockView {
    const { minSpeed, maxSpeed } = this.def.clock
    const day = this.clock.unit('day')
    return { clockId: this.def.id, label: this.def.label, calendar: this.clock.calendar(), dayPart: (this.clock.now % day) / day, speed: this.clock.speed, paused: this.clock.paused, speeds: SPEEDS.filter((s) => s >= minSpeed && s <= maxSpeed) }
  }

  private show(): void {
    const v = this.view()
    const key = `${v.calendar.day}:${v.calendar.hour}:${v.calendar.minute}:${v.speed}:${v.paused}`
    if (key === this.shown) return
    this.shown = key
    this.hooks.show(v)
  }
}

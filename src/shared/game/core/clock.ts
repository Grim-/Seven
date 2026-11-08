export interface ClockConfig {
  tickSeconds: number
  gameSecondsPerRealSecond: number
  hourSeconds: number
  hoursPerDay: number
  minSpeed: number
  maxSpeed: number
  maxCatchUpTicks: number
}

export interface ClockState {
  time: number
  ticks: number
  speed: number
  paused: boolean
  carry?: number
}

export interface Calendar {
  day: number
  hour: number
  minute: number
  daylight: number
}

const EPSILON = 1e-6

export class GameClock {
  time = 0
  ticks = 0
  speed = 1
  paused = false
  private carry = 0

  constructor(
    readonly config: ClockConfig,
    private step: (seconds: number) => void
  ) {}

  setSpeed(speed: number): number {
    this.speed = Math.min(this.config.maxSpeed, Math.max(this.config.minSpeed, speed))
    return this.speed
  }

  setPaused(paused: boolean): void {
    this.paused = paused
  }

  get now(): number {
    return this.time + this.carry
  }

  advance(realSeconds: number): number {
    if (this.paused || realSeconds <= 0) return 0
    this.carry += realSeconds * this.config.gameSecondsPerRealSecond * this.speed
    const due = Math.min(this.config.maxCatchUpTicks, Math.floor((this.carry + EPSILON) / this.config.tickSeconds))
    this.carry = Math.max(0, this.carry - due * this.config.tickSeconds)
    for (let i = 0; i < due; i++) this.runTick()
    return due
  }

  runTick(): void {
    this.ticks++
    this.time += this.config.tickSeconds
    this.step(this.config.tickSeconds)
  }

  unit(unit: 'second' | 'minute' | 'hour' | 'day'): number {
    const hour = this.config.hourSeconds
    if (unit === 'second') return 1
    if (unit === 'minute') return hour / 60
    if (unit === 'hour') return hour
    return hour * this.config.hoursPerDay
  }

  perTick(amount: number, unit: 'second' | 'minute' | 'hour' | 'day'): number {
    return (amount * this.config.tickSeconds) / this.unit(unit)
  }

  calendar(): Calendar {
    const day = this.unit('day')
    const inDay = this.now % day
    const dayPart = inDay / day
    return {
      day: Math.floor(this.now / day) + 1,
      hour: Math.floor(inDay / this.unit('hour')),
      minute: Math.floor((inDay % this.unit('hour')) / this.unit('minute')),
      daylight: Math.max(0, Math.sin((dayPart - 0.25) * Math.PI * 2) * 0.5 + 0.5)
    }
  }

  toJSON(): ClockState {
    return { time: this.time, ticks: this.ticks, speed: this.speed, paused: this.paused, carry: this.carry }
  }

  fromJSON(state: Partial<ClockState>): void {
    this.time = state.time ?? 0
    this.ticks = state.ticks ?? 0
    this.speed = state.speed ?? 1
    this.paused = state.paused ?? false
    this.carry = Math.max(0, Math.min(this.config.tickSeconds, state.carry ?? 0))
  }
}

export function turnTicks(roundSeconds: number, tickSeconds: number): number {
  return Math.max(1, Math.round(roundSeconds / tickSeconds))
}

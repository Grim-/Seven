export interface ClockConfig {
  hourSeconds: number
  hoursPerDay: number
}

export interface ClockState {
  time: number
}

export interface Calendar {
  day: number
  hour: number
  minute: number
  daylight: number
}

export class GameClock {
  time = 0

  constructor(readonly config: ClockConfig) {}

  get daySeconds(): number {
    return this.config.hourSeconds * this.config.hoursPerDay
  }

  advance(seconds: number): void {
    if (seconds > 0) this.time += seconds
  }

  calendar(): Calendar {
    const day = this.daySeconds
    const hour = this.config.hourSeconds
    const inDay = this.time % day
    const dayPart = inDay / day
    return {
      day: Math.floor(this.time / day) + 1,
      hour: Math.floor(inDay / hour),
      minute: Math.floor((inDay % hour) / (hour / 60)),
      daylight: Math.max(0, Math.sin((dayPart - 0.25) * Math.PI * 2) * 0.5 + 0.5)
    }
  }

  toJSON(): ClockState {
    return { time: this.time }
  }

  fromJSON(state: Partial<ClockState>): void {
    this.time = state.time ?? 0
  }
}

export function dawnsBetween(config: ClockConfig, dawnHour: number, from: number, to: number): number {
  const day = config.hourSeconds * config.hoursPerDay
  const dawn = dawnHour * config.hourSeconds
  return Math.max(0, Math.floor((to - dawn) / day) - Math.floor((from - dawn) / day))
}

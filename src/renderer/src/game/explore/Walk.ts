import type { Point } from '@shared/shapes'

export class Walk {
  private leg = 0
  private travelled = 0

  constructor(
    private at: Point,
    private points: Point[],
    private speed: number
  ) {}

  get done(): boolean {
    return this.leg >= this.points.length
  }

  get position(): Point {
    return this.at
  }

  get distance(): number {
    return this.travelled
  }

  get end(): Point {
    return this.points[this.points.length - 1] ?? this.at
  }

  step(dt: number): Point {
    let left = this.speed * dt
    while (left > 0 && !this.done) {
      const to = this.points[this.leg]
      const dx = to.x - this.at.x
      const dy = to.y - this.at.y
      const d = Math.hypot(dx, dy)
      if (d <= left) {
        this.at = { x: to.x, y: to.y }
        this.travelled += d
        left -= d
        this.leg++
      } else {
        this.at = { x: this.at.x + (dx / d) * left, y: this.at.y + (dy / d) * left }
        this.travelled += left
        left = 0
      }
    }
    return this.at
  }
}

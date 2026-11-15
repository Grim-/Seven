export const STEP = 1 / 60
const LONGEST_FRAME = 0.25

export class Loop {
  private frame = 0
  private last = 0
  private carry = 0
  private running = false

  constructor(
    private update: (dt: number) => void,
    private render: (alpha: number) => void,
    private shouldContinue: () => boolean = () => true
  ) {}

  get active(): boolean {
    return this.running
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    this.carry = 0
    this.frame = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.frame)
  }

  private tick = (now: number): void => {
    if (!this.running) return
    this.carry += Math.min(LONGEST_FRAME, (now - this.last) / 1000)
    this.last = now
    while (this.carry >= STEP) {
      this.update(STEP)
      this.carry -= STEP
    }
    this.render(this.carry / STEP)
    if (this.running && this.shouldContinue()) {
      this.frame = requestAnimationFrame(this.tick)
    } else {
      this.running = false
    }
  }
}

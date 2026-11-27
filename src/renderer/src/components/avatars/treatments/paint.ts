export class Buffers {
  private canvases: HTMLCanvasElement[] = []

  get(index: number, width: number, height: number, ratio: number, clear = true): CanvasRenderingContext2D {
    const canvas = (this.canvases[index] ??= document.createElement('canvas'))
    const pw = Math.max(1, Math.round(width * ratio))
    const ph = Math.max(1, Math.round(height * ratio))
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
    }
    const ctx = canvas.getContext('2d')!
    reset(ctx)
    if (clear) ctx.clearRect(0, 0, pw, ph)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    return ctx
  }

  clear(): void {
    for (const c of this.canvases) {
      c.width = 0
      c.height = 0
    }
    this.canvases = []
  }
}

export function reset(ctx: CanvasRenderingContext2D): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.filter = 'none'
}

export function tintInto(ctx: CanvasRenderingContext2D, source: CanvasImageSource, width: number, height: number, color: string): void {
  ctx.drawImage(source, 0, 0, width, height)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'
}

export function channelInto(ctx: CanvasRenderingContext2D, source: CanvasImageSource, width: number, height: number, color: string): void {
  ctx.drawImage(source, 0, 0, width, height)
  ctx.globalCompositeOperation = 'multiply'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(source, 0, 0, width, height)
  ctx.globalCompositeOperation = 'source-over'
}

export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

import type { Point, Size } from '@shared/shapes'

export type Cell = [number, number]

export class NavGrid {
  readonly blocked: Uint8Array

  constructor(
    readonly cols: number,
    readonly rows: number,
    readonly cell: Size
  ) {
    this.blocked = new Uint8Array(cols * rows)
  }

  static covering(area: Size, cell: Size): NavGrid {
    return new NavGrid(Math.max(1, Math.ceil(area.w / cell.w)), Math.max(1, Math.ceil(area.h / cell.h)), cell)
  }

  inside(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows
  }

  open(c: number, r: number): boolean {
    return this.inside(c, r) && this.blocked[r * this.cols + c] === 0
  }

  block(c: number, r: number, blocked = true): void {
    if (this.inside(c, r)) this.blocked[r * this.cols + c] = blocked ? 1 : 0
  }

  cellOf(p: Point): Cell {
    return [Math.floor(p.x / this.cell.w), Math.floor(p.y / this.cell.h)]
  }

  centre(c: number, r: number): Point {
    return { x: (c + 0.5) * this.cell.w, y: (r + 0.5) * this.cell.h }
  }

  nearestOpen(c: number, r: number): Cell | null {
    if (this.open(c, r)) return [c, r]
    const reach = Math.max(this.cols, this.rows)
    for (let ring = 1; ring <= reach; ring++) {
      let best: Cell | null = null
      let bestDistance = Infinity
      for (let dr = -ring; dr <= ring; dr++)
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring || !this.open(c + dc, r + dr)) continue
          const d = Math.hypot(dc * this.cell.w, dr * this.cell.h)
          if (d < bestDistance) {
            bestDistance = d
            best = [c + dc, r + dr]
          }
        }
      if (best) return best
    }
    return null
  }

  clear(a: Point, b: Point): boolean {
    let [c, r] = this.cellOf(a)
    const [ec, er] = this.cellOf(b)
    if (!this.open(c, r)) return false
    const dx = b.x - a.x
    const dy = b.y - a.y
    const sc = Math.sign(dx)
    const sr = Math.sign(dy)
    const stepX = dx ? this.cell.w / Math.abs(dx) : Infinity
    const stepY = dy ? this.cell.h / Math.abs(dy) : Infinity
    let tx = dx ? (sc > 0 ? (c + 1) * this.cell.w - a.x : a.x - c * this.cell.w) / Math.abs(dx) : Infinity
    let ty = dy ? (sr > 0 ? (r + 1) * this.cell.h - a.y : a.y - r * this.cell.h) / Math.abs(dy) : Infinity
    let left = Math.abs(ec - c) + Math.abs(er - r)
    while (left > 0 && (c !== ec || r !== er)) {
      if (Math.abs(tx - ty) < 1e-9) {
        if (!this.open(c + sc, r) || !this.open(c, r + sr)) return false
        c += sc
        r += sr
        tx += stepX
        ty += stepY
        left -= 2
      } else if (tx < ty) {
        c += sc
        tx += stepX
        left--
      } else {
        r += sr
        ty += stepY
        left--
      }
      if (!this.open(c, r)) return false
    }
    return true
  }
}

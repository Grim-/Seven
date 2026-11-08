import type { Point } from '@shared/shapes'
import type { NavGrid } from './grid'

const NEIGHBOURS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1]
]

class Heap {
  private items: number[] = []

  constructor(private score: Float64Array) {}

  get size(): number {
    return this.items.length
  }

  push(i: number): void {
    const a = this.items
    a.push(i)
    let at = a.length - 1
    while (at > 0) {
      const up = (at - 1) >> 1
      if (this.score[a[up]] <= this.score[a[at]]) break
      ;[a[up], a[at]] = [a[at], a[up]]
      at = up
    }
  }

  pop(): number {
    const a = this.items
    const top = a[0]
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let at = 0
      for (;;) {
        const l = at * 2 + 1
        const r = l + 1
        let low = at
        if (l < a.length && this.score[a[l]] < this.score[a[low]]) low = l
        if (r < a.length && this.score[a[r]] < this.score[a[low]]) low = r
        if (low === at) break
        ;[a[low], a[at]] = [a[at], a[low]]
        at = low
      }
    }
    return top
  }
}

function search(grid: NavGrid, start: [number, number], goal: [number, number]): number[] | null {
  const n = grid.cols * grid.rows
  const cost = new Float64Array(n).fill(Infinity)
  const score = new Float64Array(n).fill(Infinity)
  const from = new Int32Array(n).fill(-1)
  const done = new Uint8Array(n)
  const { w, h } = grid.cell
  const index = (c: number, r: number) => r * grid.cols + c
  const guess = (c: number, r: number) => Math.hypot((c - goal[0]) * w, (r - goal[1]) * h)
  const s = index(start[0], start[1])
  const g = index(goal[0], goal[1])
  const heap = new Heap(score)
  cost[s] = 0
  score[s] = guess(start[0], start[1])
  heap.push(s)
  while (heap.size) {
    const at = heap.pop()
    if (done[at]) continue
    if (at === g) break
    done[at] = 1
    const c = at % grid.cols
    const r = (at - c) / grid.cols
    for (const [dc, dr] of NEIGHBOURS) {
      const nc = c + dc
      const nr = r + dr
      if (!grid.open(nc, nr)) continue
      if (dc && dr && (!grid.open(c + dc, r) || !grid.open(c, r + dr))) continue
      const next = index(nc, nr)
      if (done[next]) continue
      const step = cost[at] + Math.hypot(dc * w, dr * h)
      if (step >= cost[next]) continue
      cost[next] = step
      from[next] = at
      score[next] = step + guess(nc, nr)
      heap.push(next)
    }
  }
  if (cost[g] === Infinity) return null
  const cells: number[] = []
  for (let at = g; at !== -1; at = from[at]) cells.unshift(at)
  return cells
}

export function findPath(grid: NavGrid, from: Point, to: Point): Point[] | null {
  const start = grid.nearestOpen(...grid.cellOf(from))
  const [gc, gr] = grid.cellOf(to)
  const goal = grid.nearestOpen(gc, gr)
  if (!start || !goal) return null
  const target = goal[0] === gc && goal[1] === gr ? to : grid.centre(goal[0], goal[1])
  const origin = start[0] === grid.cellOf(from)[0] && start[1] === grid.cellOf(from)[1] ? from : grid.centre(start[0], start[1])
  const points = origin === from ? [] : [origin]
  if (grid.clear(origin, target)) return [...points, target]
  const cells = search(grid, start, goal)
  if (!cells) return null
  const route = cells.map((i) => grid.centre(i % grid.cols, Math.floor(i / grid.cols)))
  route[0] = origin
  route[route.length - 1] = target
  let at = 0
  while (at < route.length - 1) {
    let far = at + 1
    while (far + 1 < route.length && grid.clear(route[at], route[far + 1])) far++
    points.push(route[far])
    at = far
  }
  return points
}

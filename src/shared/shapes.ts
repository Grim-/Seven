export interface Point {
  x: number
  y: number
}

export interface Size {
  w: number
  h: number
}

export interface Bounds extends Point, Size {}

export type ShapeKind = 'box' | 'outline'

export type ShapeForm = ({ kind: 'box' } & Bounds) | { kind: 'outline'; points: Point[] }

export interface Shape {
  id: string
  label: string
  title?: string
  form: ShapeForm
}

export function shapeBounds(form: ShapeForm): Bounds {
  if (form.kind === 'box') return { x: form.x, y: form.y, w: form.w, h: form.h }
  const xs = form.points.map((p) => p.x)
  const ys = form.points.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

export function movedForm(form: ShapeForm, dx: number, dy: number, size: Size): ShapeForm {
  const b = shapeBounds(form)
  const mx = Math.min(Math.max(dx, -b.x), size.w - b.x - b.w)
  const my = Math.min(Math.max(dy, -b.y), size.h - b.y - b.h)
  if (form.kind === 'box') return { ...form, x: form.x + mx, y: form.y + my }
  return { kind: 'outline', points: form.points.map((p) => ({ x: p.x + mx, y: p.y + my })) }
}

export function boxForm(a: Point, b: Point): ShapeForm {
  return { kind: 'box', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
}

export function tooSmall(form: ShapeForm, min: number): boolean {
  const b = shapeBounds(form)
  return b.w < min || b.h < min
}

export function formHas(form: ShapeForm, p: Point): boolean {
  if (form.kind === 'box') return p.x >= form.x && p.y >= form.y && p.x <= form.x + form.w && p.y <= form.y + form.h
  let inside = false
  const pts = form.points
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]
    const b = pts[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function smallestAt(forms: Record<string, ShapeForm>, p: Point): string | null {
  const area = (f: ShapeForm) => shapeBounds(f).w * shapeBounds(f).h
  const hits = Object.entries(forms).filter(([, f]) => formHas(f, p))
  return hits.sort((a, b) => area(a[1]) - area(b[1]))[0]?.[0] ?? null
}

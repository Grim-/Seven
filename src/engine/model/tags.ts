const OPEN = ['<|channel>thought\n', '<|channel>thought', '<|channel>', '<think>']
const CLOSE = ['<channel|>', '</think>']

export type SplitKind = 'text' | 'thought'

export class ThoughtTags {
  private inside = false
  private pending = ''

  push(text: string, emit: (kind: SplitKind, text: string) => void): void {
    this.pending += text
    for (;;) {
      const found = this.next()
      if (found) {
        const before = this.pending.slice(0, found.at)
        if (before) emit(this.inside ? 'thought' : 'text', before)
        this.pending = this.pending.slice(found.at + found.tag.length)
        if (found.open && !this.inside) this.inside = true
        else if (!found.open && this.inside) this.inside = false
        continue
      }
      const keep = this.partial()
      const out = this.pending.slice(0, this.pending.length - keep)
      if (out) emit(this.inside ? 'thought' : 'text', out)
      this.pending = this.pending.slice(this.pending.length - keep)
      return
    }
  }

  flush(emit: (kind: SplitKind, text: string) => void): void {
    if (this.pending) emit(this.inside ? 'thought' : 'text', this.pending)
    this.pending = ''
  }

  private next(): { at: number; tag: string; open: boolean } | null {
    let best: { at: number; tag: string; open: boolean } | null = null
    for (const [tags, open] of [
      [OPEN, true],
      [CLOSE, false]
    ] as const) {
      for (const tag of tags) {
        const at = this.pending.indexOf(tag)
        if (at < 0) continue
        if (!best || at < best.at || (at === best.at && tag.length > best.tag.length)) best = { at, tag, open }
      }
    }
    if (best && best.open && best.tag === '<|channel>' && this.pending.length - best.at < '<|channel>thought\n'.length && '<|channel>thought\n'.startsWith(this.pending.slice(best.at))) return null
    return best
  }

  private partial(): number {
    let keep = 0
    for (const tag of [...OPEN, ...CLOSE]) {
      for (let n = Math.min(tag.length - 1, this.pending.length); n > keep; n--) {
        if (tag.startsWith(this.pending.slice(-n))) {
          keep = n
          break
        }
      }
    }
    return keep
  }
}

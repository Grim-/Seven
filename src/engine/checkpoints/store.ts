import { removePath, writeUserFile } from '../util/fs'
import type { SessionFiles } from '../sessions/files'

interface Snapshot {
  path: string
  existed: boolean
  data: string | null
}

export class CheckpointStore {
  private seen = new Map<string, Set<string>>()

  constructor(private filesOf: (sessionId: string) => SessionFiles) {}

  private file(turnId: string): string {
    return `checkpoints/${turnId}.jsonl`
  }

  save(sessionId: string, turnId: string, absPath: string, previous: Buffer | null): void {
    const key = `${sessionId}/${turnId}`
    let set = this.seen.get(key)
    if (!set) {
      set = new Set(this.filesOf(sessionId).readLines<Snapshot>(this.file(turnId)).map((s) => s.path))
      this.seen.set(key, set)
    }
    if (set.has(absPath)) return
    set.add(absPath)
    this.filesOf(sessionId).appendLine(this.file(turnId), {
      path: absPath,
      existed: previous !== null,
      data: previous ? previous.toString('base64') : null
    } satisfies Snapshot)
  }

  files(sessionId: string, turnIds: string[]): string[] {
    const out = new Set<string>()
    for (const turnId of turnIds) for (const s of this.filesOf(sessionId).readLines<Snapshot>(this.file(turnId))) out.add(s.path)
    return [...out]
  }

  restore(sessionId: string, turnIdsOldestFirst: string[]): string[] {
    const restored = new Set<string>()
    for (const turnId of [...turnIdsOldestFirst].reverse()) {
      for (const snap of this.filesOf(sessionId).readLines<Snapshot>(this.file(turnId))) {
        if (snap.existed && snap.data !== null) {
          writeUserFile(snap.path, Buffer.from(snap.data, 'base64'))
        } else {
          removePath(snap.path)
        }
        restored.add(snap.path)
      }
      this.filesOf(sessionId).remove(this.file(turnId))
      this.seen.delete(`${sessionId}/${turnId}`)
    }
    return [...restored]
  }
}

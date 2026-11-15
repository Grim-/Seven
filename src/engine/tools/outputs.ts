import { noteFailure } from '../util/report'
import fs from 'node:fs'
import path from 'node:path'
import type { AssetMeta } from '@shared/types'
import { classify } from '../data/assets'
import { data } from '../data/hub'
import type { ToolContext } from './types'
import { displayPath } from './workspace'

const SKIP = new Set(['node_modules', '.git', '.venv', 'venv', '__pycache__', '.cache', '.next', 'dist', 'build', 'out-tsc', '.idea', '.vs'])
const MAX_DEPTH = 5
const MAX_ENTRIES = 8000
const MAX_NEW = 8
const MEDIA = new Set(['image', 'audio', 'video', 'pdf'])

export function findNewMedia(root: string, since: number): string[] {
  const found: string[] = []
  let seen = 0
  const walk = (dir: string, depth: number) => {
    if (depth > MAX_DEPTH || seen > MAX_ENTRIES || found.length >= MAX_NEW) return
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (++seen > MAX_ENTRIES || found.length >= MAX_NEW) return
      if (entry.name.startsWith('.') && entry.isDirectory()) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(full, depth + 1)
      } else if (entry.isFile() && MEDIA.has(classify(entry.name).kind)) {
        try {
          const stat = fs.statSync(full)
          if (Math.max(stat.mtimeMs, stat.birthtimeMs) >= since) found.push(full)
        } catch {
          continue
        }
      }
    }
  }
  walk(root, 0)
  return found
}

export function registerOutputs(ctx: ToolContext, root: string, since: number): AssetMeta[] {
  const out: AssetMeta[] = []
  for (const file of findNewMedia(root, since)) {
    try {
      out.push(
        data.assets.register(file, { tool: 'run_command', sessionId: ctx.sessionId, original: displayPath(ctx, file) }, {
          checkpoint: (abs, previous) => ctx.checkpoints.save(abs, previous)
        })
      )
    } catch (err) {
      noteFailure(err, 'tools', "Could not add a command's output file")
      continue
    }
  }
  return out
}

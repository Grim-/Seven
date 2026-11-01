import fs from 'node:fs'
import { ToolError, type ToolContext } from '../../engine/tools/types'
import { outputFile } from '../../engine/tools/budget'
import { readText } from '../../engine/util/fs'

function savedIds(dir: string | undefined): string[] {
  if (!dir) return []
  try {
    return fs
      .readdirSync(dir)
      .filter((n) => /^t_[a-z0-9]+\.txt$/i.test(n))
      .map((n) => n.slice(0, -4))
  } catch {
    return []
  }
}

export function isSavedId(ref: string): boolean {
  return /^t_[a-z0-9]+$/i.test(ref.trim())
}

function missing(id: string, dir: string | undefined): ToolError {
  const ids = savedIds(dir)
  return new ToolError(`No result ${id} in this chat.${ids.length ? ` Results here: ${ids.slice(-10).map((r) => `result ${r}`).join(', ')}.` : ''}`)
}

export function savedText(id: string, ctx: ToolContext): string {
  if (!ctx.budget) throw missing(id, undefined)
  const file = outputFile(ctx.budget.dir, id)
  if (!fs.existsSync(file)) throw missing(id, ctx.budget.dir)
  return readText(file)
}

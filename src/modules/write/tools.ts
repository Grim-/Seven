import fs from 'node:fs'
import { createTwoFilesPatch } from 'diff'
import type { DiffData } from '@shared/types'
import { gateWrite } from '../../engine/permissions/gate'
import { ToolError, str, type ToolContext, type ToolDef } from '../../engine/tools/types'
import { displayPath, isToolsFolder, resolveForWrite } from '../../engine/tools/workspace'
import { writeUserFile } from '../../engine/util/fs'

const MAX_WRITE_BYTES = 5 * 1024 * 1024

function requireFreshRead(ctx: ToolContext, abs: string, rel: string): void {
  const readAt = ctx.permissions.grants.reads.get(abs)
  if (readAt === undefined) throw new ToolError(`Read ${rel} with read_kind before changing it.`)
  if (fs.statSync(abs).mtimeMs !== readAt) throw new ToolError(`${rel} changed since you last read it. Read it again before changing it.`)
}

function patchFor(rel: string, before: string, after: string): string {
  return createTwoFilesPatch(rel, rel, before, after, '', '', { context: 3 })
}

function count(haystack: string, needle: string): number {
  let n = 0
  let at = haystack.indexOf(needle)
  while (at !== -1) {
    n++
    at = haystack.indexOf(needle, at + needle.length)
  }
  return n
}

function commit(ctx: ToolContext, abs: string, previous: Buffer | null, content: string): void {
  ctx.checkpoints.save(abs, previous)
  writeUserFile(abs, content)
  ctx.permissions.grants.reads.set(abs, fs.statSync(abs).mtimeMs)
}

const editFile: ToolDef = {
  name: 'edit_file',
  group: 'write',
  needsWorkspace: true,
  description:
    'Replace exact text in a file. old_string must match the file exactly, including indentation, and must appear only once unless replaceAll is true. Read the file first.',
  params: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to the workspace root, or @folder/... for a linked folder that allows writing' },
      old_string: { type: 'string', description: 'The exact text to replace' },
      new_string: { type: 'string', description: 'The replacement text' },
      replaceAll: { type: ['boolean', 'null'], description: 'true to replace every occurrence' }
    }
  },
  async execute(params, ctx) {
    const input = str(params, 'path')
    const abs = resolveForWrite(ctx, input)
    const rel = displayPath(ctx, abs)
    if (!fs.existsSync(abs)) throw new ToolError(`${rel} does not exist. Use write_file to create it.`)
    requireFreshRead(ctx, abs, rel)
    const previous = fs.readFileSync(abs)
    const before = previous.toString('utf8')
    const eol = before.includes('\r\n') ? '\r\n' : '\n'
    const toEol = (t: string) => t.replace(/\r\n/g, '\n').replace(/\n/g, eol)
    const oldText = toEol(typeof params.old_string === 'string' ? params.old_string : '')
    const newText = toEol(typeof params.new_string === 'string' ? params.new_string : '')
    if (!oldText) throw new ToolError('old_string is empty. To create or overwrite a whole file, use write_file.')
    if (oldText === newText) throw new ToolError('old_string and new_string are the same, so nothing would change.')
    const found = count(before, oldText)
    if (found === 0) throw new ToolError(`old_string was not found in ${rel}. Read the file again and copy the text exactly, including indentation.`)
    const all = params.replaceAll === true
    if (found > 1 && !all)
      throw new ToolError(`old_string appears ${found} times in ${rel}. Include more surrounding lines so it is unique, or set replaceAll to true.`)
    const after = all ? before.split(oldText).join(newText) : before.replace(oldText, () => newText)
    const patch = patchFor(rel, before, after)
    await gateWrite(ctx.permissions, { action: 'edit', relPath: rel, patch, toolsFolder: isToolsFolder(abs) })
    if (fs.statSync(abs).mtimeMs !== ctx.permissions.grants.reads.get(abs))
      throw new ToolError(`${rel} changed while waiting for approval. Read it again before changing it.`)
    commit(ctx, abs, previous, after)
    const data: DiffData = { path: rel, patch, created: false }
    return { text: `Edited ${rel}: replaced ${all ? found : 1} occurrence${all && found > 1 ? 's' : ''}.`, view: { kind: 'diff', title: rel, data } }
  }
}

const writeFile: ToolDef = {
  name: 'write_file',
  group: 'write',
  needsWorkspace: true,
  description: 'Create a file, or replace a whole file. To change part of an existing file, use edit_file instead. Read an existing file first.',
  params: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to the workspace root, or @folder/... for a linked folder that allows writing' },
      content: { type: 'string', description: 'The complete file content' }
    }
  },
  async execute(params, ctx) {
    const input = str(params, 'path')
    const content = typeof params.content === 'string' ? params.content : ''
    if (Buffer.byteLength(content) > MAX_WRITE_BYTES) throw new ToolError('That content is over 5 MB; write smaller files.')
    const abs = resolveForWrite(ctx, input)
    const rel = displayPath(ctx, abs)
    const exists = fs.existsSync(abs)
    if (exists) requireFreshRead(ctx, abs, rel)
    const previous = exists ? fs.readFileSync(abs) : null
    const before = previous ? previous.toString('utf8') : ''
    const eol = before.includes('\r\n') ? '\r\n' : '\n'
    const after = eol === '\r\n' ? content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n') : content
    const patch = patchFor(rel, before, after)
    await gateWrite(ctx.permissions, { action: 'write', relPath: rel, patch, toolsFolder: isToolsFolder(abs) })
    if (exists && fs.statSync(abs).mtimeMs !== ctx.permissions.grants.reads.get(abs))
      throw new ToolError(`${rel} changed while waiting for approval. Read it again before changing it.`)
    if (!exists && fs.existsSync(abs)) throw new ToolError(`${rel} was created by something else while waiting for approval. Read it first.`)
    commit(ctx, abs, previous, after)
    const lines = after.split('\n').length
    const data: DiffData = { path: rel, patch, created: !exists }
    return { text: `${exists ? 'Replaced' : 'Created'} ${rel} (${lines} lines).`, view: { kind: 'diff', title: rel, data } }
  }
}

export const WRITE_TOOLS: ToolDef[] = [editFile, writeFile]

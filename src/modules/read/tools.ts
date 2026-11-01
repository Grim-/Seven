import fs from 'node:fs'
import path from 'node:path'
import type { ExcerptData, FileListItem } from '@shared/types'
import { ToolError, optStr, str, type ToolContext, type ToolDef, type ToolOutput } from '../../engine/tools/types'
import { stripRef } from '@shared/ids'
import { DISK_ROOT, displayPath, isHidden, resolvePlace, resolveInWorkspace } from '../../engine/tools/workspace'
import { runRg } from '../../engine/tools/rg'
import { documentKind, documentText, unreadableFormat } from '../../engine/util/documents'

const MAX_LIST = 500
const MAX_MATCHES = 300

export function diskId(ctx: ToolContext, abs: string): string {
  const shown = displayPath(ctx, abs).replace(/\\/g, '/')
  if (shown.startsWith('@')) return shown.slice(1)
  return shown && shown !== '.' ? `${DISK_ROOT}/${shown}` : DISK_ROOT
}

function parentId(id: string): string {
  const parts = id.replace(/\/+$/, '').split('/')
  parts.pop()
  return parts.join('/') || '/'
}

export async function readDisk(ctx: ToolContext, id: string): Promise<{ id: string; text: string; view?: ToolOutput['view'] }> {
  if (!stripRef(id).replace(/[/\\.\s]/g, '')) {
    const roots = [...(ctx.workspace ? [DISK_ROOT] : []), ...ctx.folders.map((f) => f.name)]
    return { id: '/', text: roots.map((r) => `disk ${r}/`).join('\n') || '(no folders)' }
  }
  const target = resolveInWorkspace(ctx, stripRef(id).replace(/^\/+/, '') || '.')
  const canonical = diskId(ctx, target)
  if (!fs.existsSync(target)) throw new ToolError(`No disk ${canonical}. read_kind(disk, ${parentId(canonical)}) lists what ${parentId(canonical) === '/' ? 'there is' : parentId(canonical)} holds.`)
  if (fs.statSync(target).isDirectory()) {
    const entries = fs
      .readdirSync(target, { withFileTypes: true })
      .filter((e) => e.name !== '.git' && !isHidden(ctx, path.join(target, e.name)))
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    const items: FileListItem[] = entries.map((e) => {
      const full = path.join(target, e.name)
      const rel = displayPath(ctx, full)
      if (e.isDirectory()) return { path: rel, type: 'dir' }
      let size = 0
      try {
        size = fs.statSync(full).size
      } catch {
        size = 0
      }
      return { path: rel, type: 'file', size }
    })
    const lines = entries.map((e, i) => `disk ${diskId(ctx, path.join(target, e.name))}${e.isDirectory() ? '/' : ` (${items[i].size} bytes)`}`)
    return { id: canonical, text: lines.join('\n') || '(empty)', view: { kind: 'files', title: canonical, data: items } }
  }
  const buffer = fs.readFileSync(target)
  const kind = documentKind(target)
  const old = unreadableFormat(target)
  if (!kind && old) throw new ToolError(`${canonical} is ${old}, which can't be read. Ask the user to save it as PDF, .docx or .xlsx, or to paste the text.`)
  if (!kind && buffer.subarray(0, 8000).includes(0)) throw new ToolError(`${canonical} is a binary file, so it can't be read as text. If you can run commands, convert it to text first.`)
  const content = kind ? await documentText(kind, buffer, canonical) : buffer.toString('utf8')
  ctx.permissions.grants.reads.set(target, fs.statSync(target).mtimeMs)
  const lines = content.split(/\r?\n/)
  const data: ExcerptData = { path: displayPath(ctx, target), startLine: 1, endLine: lines.length, totalLines: lines.length, text: content }
  return { id: canonical, text: content, view: { kind: 'excerpt', title: canonical, data } }
}

const glob: ToolDef = {
  name: 'glob',
  group: 'read',
  needsWorkspace: true,
  description:
    'Find files by name pattern, for example "**/*.ts" or "src/**/config.*". Skips files ignored by .gitignore.',
  params: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern' },
      path: { type: ['string', 'null'], description: 'Folder to search in, relative to the workspace root, or @folder for a linked folder. null for the workspace root.' }
    }
  },
  async execute(params, ctx) {
    const { place, target: dir } = resolvePlace(ctx, optStr(params, 'path'))
    const root = place.root
    const pattern = str(params, 'pattern')
    const { lines, truncated } = await runRg(
      ['--files', '--hidden', '-g', '!.git', ...excludes(place.folder?.exclude), '-g', pattern, path.relative(root, dir) || '.'],
      root,
      ctx.signal,
      MAX_LIST
    )
    const files = lines.map((l) => prefixed(place.folder?.name, l.replace(/^\.[\\/]/, '').split(path.sep).join('/'))).sort()
    const items: FileListItem[] = files.map((f) => ({ path: f, type: 'file' }))
    return {
      text: files.length ? `${files.length}${truncated ? '+' : ''} files match ${pattern}:\n${files.join('\n')}` : `No files match ${pattern}`,
      view: { kind: 'files', title: pattern, data: items }
    }
  }
}

const grep: ToolDef = {
  name: 'grep',
  group: 'read',
  needsWorkspace: true,
  description:
    'Search file contents with a regular expression. Returns matching lines with file and line number, or only file names when filesOnly is true.',
  params: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regular expression (ripgrep syntax)' },
      path: { type: ['string', 'null'], description: 'Folder or file to search, relative to the workspace root, or @folder/... for a linked folder. null for the workspace root.' },
      fileGlob: { type: ['string', 'null'], description: 'Only search files matching this glob, for example "*.ts". null for all files.' },
      ignoreCase: { type: ['boolean', 'null'], description: 'true for a case-insensitive search' },
      filesOnly: { type: ['boolean', 'null'], description: 'true to list matching files instead of lines' }
    }
  },
  async execute(params, ctx) {
    const { place, target } = resolvePlace(ctx, optStr(params, 'path'))
    const root = place.root
    const pattern = str(params, 'pattern')
    const args = ['--hidden', '-g', '!.git', ...excludes(place.folder?.exclude), '--color', 'never', '--max-columns', '300', '--max-columns-preview']
    if (params.ignoreCase === true) args.push('-i')
    const fileGlob = optStr(params, 'fileGlob')
    if (fileGlob) args.push('-g', fileGlob)
    if (params.filesOnly === true) args.push('-l')
    else args.push('-n', '--no-heading')
    args.push('-e', pattern, path.relative(root, target) || '.')
    const { lines, truncated } = await runRg(args, root, ctx.signal, MAX_MATCHES)
    const cleaned = lines.map((l) => prefixed(place.folder?.name, l.replace(/^\.[\\/]/, '').replace(/\\/g, '/')))
    if (!cleaned.length) return { text: `No matches for ${pattern}. Try a simpler pattern, ignoreCase true, or a wider path.`, empty: true }
    const header = `${cleaned.length}${truncated ? '+' : ''} ${params.filesOnly === true ? 'files' : 'matches'} for ${pattern}:`
    return { text: `${header}\n${cleaned.join('\n')}`, view: { kind: 'text', title: `grep ${pattern}`, data: cleaned.join('\n') } }
  }
}

function excludes(globs: string[] | undefined): string[] {
  return (globs ?? []).flatMap((g) => {
    const clean = g.replace(/^\.?\//, '')
    const dir = clean.endsWith('/**') ? clean.slice(0, -3) : null
    return dir ? ['-g', `!${clean}`, '-g', `!${dir}`] : ['-g', `!${clean}`]
  })
}

function prefixed(folder: string | undefined, rel: string): string {
  return folder ? `@${folder}/${rel}` : rel
}

export const READ_TOOLS: ToolDef[] = [glob, grep]

export function canReadPaths(ctx: ToolContext): boolean {
  return ctx.groups.includes('read') && (Boolean(ctx.workspace) || ctx.folders.length > 0)
}


export function pathLike(raw: string, ctx: ToolContext): boolean {
  const text = raw.trim()
  if (/^@[a-z][\w.-]*:/i.test(text)) return false
  if (ctx.folders.some((f) => text === `@${f.name}` || text.startsWith(`@${f.name}/`))) return true
  return /[\\/]/.test(text) || /\.[a-z0-9]{1,8}$/i.test(text)
}

export function pathExists(raw: string, ctx: ToolContext): boolean {
  try {
    return fs.existsSync(resolveInWorkspace(ctx, raw))
  } catch {
    return false
  }
}

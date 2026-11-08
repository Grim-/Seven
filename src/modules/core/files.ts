import fs from 'node:fs'
import { secure } from '../../engine/util/secure'
import { writeUserFile } from '../../engine/util/fs'
import { displayPath, isToolsFolder, resolveForWrite } from '../../engine/tools/workspace'
import { gateWrite } from '../../engine/permissions/gate'
import { ToolError, optStr, str, type ToolDef } from '../../engine/tools/types'
import type { AssetMeta, PictureArea } from '@shared/types'
import { resolveFile } from '../../engine/library/files'
import { newId } from '../../engine/util/fs'
import { data } from '../../engine/data/hub'
import { documentKind, documentText, unreadableFormat } from '../../engine/util/documents'

const TEXT_KINDS = new Set(['text', 'code'])

function looksText(bytes: Buffer): boolean {
  return !bytes.subarray(0, 4096).includes(0)
}

export async function attachedText(meta: AssetMeta): Promise<string> {
  const bytes = data.assets.readBytes(meta)
  const doc = documentKind(meta.name, meta.mime)
  const old = unreadableFormat(meta.name)
  if (!doc && old) throw new ToolError(`${meta.name} is ${old}, which can't be read. Ask the user to save it as PDF, .docx or .xlsx, or to paste the text.`)
  if (!doc && !TEXT_KINDS.has(meta.kind) && !(meta.kind === 'file' && looksText(bytes))) {
    throw new ToolError(
      secure.enabled
        ? `${meta.name} is a ${meta.kind} file, not text, so it can't be read as text. To convert it with a command, copy it into the workspace with file_export first.`
        : `${meta.name} is a ${meta.kind} file, not text, so it can't be read as text. Its path is ${data.assets.filePath(meta)}; if you can run commands, convert it to text first.`
    )
  }
  return doc ? await documentText(doc, bytes, meta.name) : bytes.toString('utf8')
}

export function isTextAsset(meta: AssetMeta): boolean {
  return documentKind(meta.name, meta.mime) !== null || unreadableFormat(meta.name) !== null || TEXT_KINDS.has(meta.kind) || (meta.kind === 'file' && looksText(data.assets.readBytes(meta)))
}

const fileExport: ToolDef = {
  name: 'file_export',
  group: 'read',
  needsWorkspace: true,
  description: "Copy one of Seven's files (for example one the user attached) into the workspace as a normal, unencrypted file, so commands can open it. Seven's own copy stays in the vault.",
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The file id, e.g. "a_abc123"' },
      path: { type: ['string', 'null'], description: 'Where to put it, relative to the workspace. null for the file name in the workspace root.' }
    }
  },
  async execute(params, ctx) {
    const id = str(params, 'id').trim()
    const meta = data.assets.metaFor(id)
    if (!meta) throw new ToolError(`There is no file "${id}". Use the id from the attached files list.`)
    const target = resolveForWrite(ctx, optStr(params, 'path') ?? meta.name)
    const rel = displayPath(ctx, target)
    if (fs.existsSync(target)) throw new ToolError(`${rel} already exists in the workspace; give another path`)
    await gateWrite(ctx.permissions, { action: 'write', relPath: rel, patch: `Copy of ${meta.name} (${meta.size.toLocaleString()} bytes), unencrypted`, toolsFolder: isToolsFolder(target) })
    ctx.checkpoints.save(target, null)
    writeUserFile(target, data.assets.readBytes(meta))
    return `Copied ${meta.name} to ${rel}`
  }
}

function areasOf(value: unknown): PictureArea[] {
  if (!Array.isArray(value)) throw new ToolError('areas must be a list, e.g. [{"name": "door", "note": "", "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}], or null to keep them.')
  return value.map((a, i) => {
    const area = (a ?? {}) as Record<string, unknown>
    const name = typeof area.name === 'string' ? area.name.trim() : ''
    if (!name) throw new ToolError(`Area ${i + 1} has no name. Give each area a name.`)
    const n = (key: string) => (typeof area[key] === 'number' ? (area[key] as number) : Number.NaN)
    if ([n('x'), n('y'), n('w'), n('h')].some((v) => !Number.isFinite(v))) throw new ToolError(`Area "${name}" needs x, y, w and h as numbers from 0 to 1 (fractions of the picture's width and height).`)
    return { id: newId('area'), name, note: typeof area.note === 'string' ? area.note : '', x: n('x'), y: n('y'), w: n('w'), h: n('h') }
  })
}

const updateFile: ToolDef = {
  name: 'update_file',
  group: 'core',
  needsWorkspace: false,
  permission: 'ask',
  description: "Set a library file's description, and for pictures its named areas. Agents that can't see pictures read these instead.",
  params: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The file id or name' },
      description: { type: ['string', 'null'], description: 'What the file is or shows. null keeps the current one' },
      areas: {
        type: ['array', 'null'],
        description: 'Pictures only: named parts of the picture. Positions are fractions of the width and height, 0 to 1, from the top left. [] removes them; null keeps the current ones',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            note: { type: 'string' },
            x: { type: 'number' },
            y: { type: 'number' },
            w: { type: 'number' },
            h: { type: 'number' }
          }
        }
      }
    }
  },
  async execute(params) {
    const meta = resolveFile(str(params, 'id'), null, 'a file')
    const description = typeof params.description === 'string' ? params.description : (meta.description ?? '')
    const areas = params.areas === null || params.areas === undefined ? (meta.areas ?? []) : areasOf(params.areas)
    const next = data.assets.describe(meta.id, description, areas)
    return `Updated ${next.name}: ${next.description ? `description ${next.description.length} characters` : 'no description'}, ${next.areas?.length ?? 0} areas.`
  }
}

export const FILE_TOOLS: ToolDef[] = [fileExport, updateFile]

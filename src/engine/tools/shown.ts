import fs from 'node:fs'
import { data } from '../data/hub'
import { ToolError, type ToolContext } from './types'
import { displayPath, resolveInWorkspace } from './workspace'

export function canShowPaths(ctx: ToolContext): boolean {
  return Boolean(ctx.workspace) || ctx.folders.length > 0
}

export function registerShownFile(path: string, ctx: ToolContext): string {
  const abs = resolveInWorkspace(ctx, path)
  if (!fs.existsSync(abs)) throw new ToolError(`No such file: ${displayPath(ctx, abs)}`)
  if (fs.statSync(abs).isDirectory()) throw new ToolError(`${displayPath(ctx, abs)} is a folder. Put the paths of the files inside it in things instead, one path each.`)
  return data.assets.register(abs, { tool: 'show', sessionId: ctx.sessionId, original: displayPath(ctx, abs) }, {
    checkpoint: (file, previous) => ctx.checkpoints.save(file, previous)
  }).id
}

export function registerHtml(title: string, html: string, network: boolean, ctx: ToolContext): string {
  if (html.length > 2_000_000) throw new ToolError('That html is over 2 MB. Make it smaller, e.g. load libraries from cdnjs or jsdelivr instead of pasting them in.')
  const name = `${title.replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'page'}.html`
  const id = data.assets.registerBytes(name, Buffer.from(html, 'utf8'), { tool: 'show', sessionId: ctx.sessionId, original: null }).id
  return data.assets.setNetwork(id, network).id
}

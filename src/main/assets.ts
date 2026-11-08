import { isAssetId } from '@shared/ids'
import { net, protocol } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { isSealed, isVaultLocked } from '@shared/sealed'
import { dataDir } from './paths'
import { mainSecure } from './vault'

export const ASSET_SCHEME = 'seven-asset'

export function assetScheme(): Electron.CustomScheme {
  return { scheme: ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
}

function sealedFile(file: string): boolean {
  const fd = fs.openSync(file, 'r')
  try {
    const head = Buffer.alloc(4)
    return fs.readSync(fd, head, 0, 4, 0) === 4 && isSealed(head)
  } finally {
    fs.closeSync(fd)
  }
}

function serveSealed(file: string, mime: string, rangeHeader: string | null): Response {
  const size = mainSecure.size(file)
  const base = { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' }
  const m = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim()) : null
  if (!m || (m[1] === '' && m[2] === '')) {
    const body = mainSecure.readBytes(file)
    return new Response(new Uint8Array(body), { status: 200, headers: { ...base, 'Content-Length': String(body.length) } })
  }
  let start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1])
  let end = m[1] === '' ? size - 1 : m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  start = Math.max(0, start)
  end = Math.min(end, start + 4 * 1024 * 1024 - 1)
  const body = mainSecure.readRange(file, start, end)
  return new Response(new Uint8Array(body), { status: 206, headers: { ...base, 'Content-Length': String(body.length), 'Content-Range': `bytes ${start}-${start + body.length - 1}/${size}` } })
}

interface StoredAsset {
  name: string
  file: string
  mime: string
}

function assetRoot(): string {
  return path.join(dataDir, 'data', 'assets')
}

function storedAsset(id: string): StoredAsset | null {
  if (!isAssetId(id)) return null
  const root = assetRoot()
  const meta = JSON.parse(mainSecure.readText(path.join(root, id, 'meta.json'))) as { file: string; mime: string; stored?: string }
  const file = path.join(root, id, meta.stored ?? meta.file)
  const rel = path.relative(root, file)
  if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(file)) return null
  return { name: meta.file, file, mime: meta.mime || 'application/octet-stream' }
}

export function readImage(id: string): { bytes: Uint8Array<ArrayBuffer>; mime: string } | null {
  const found = storedAsset(id)
  if (!found || !found.mime.startsWith('image/')) return null
  const bytes = sealedFile(found.file) ? mainSecure.readBytes(found.file) : fs.readFileSync(found.file)
  return { bytes: Uint8Array.from(bytes), mime: found.mime }
}

export function handleAssets(): void {
  protocol.handle(ASSET_SCHEME, (request) => {
    const url = new URL(request.url)
    const id = url.hostname
    const name = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    if (!name || name.includes('/') || name.includes('\\') || name === '..' || name === '.') {
      return new Response('Not found', { status: 404 })
    }
    try {
      const found = storedAsset(id)
      if (!found || found.name !== name) return new Response('Not found', { status: 404 })
      if (!sealedFile(found.file)) return net.fetch(pathToFileURL(found.file).toString(), { headers: request.headers })
      return serveSealed(found.file, found.mime, request.headers.get('range'))
    } catch (err) {
      if (isVaultLocked(err)) return new Response('Locked', { status: 423 })
      return new Response('Not found', { status: 404 })
    }
  })
}

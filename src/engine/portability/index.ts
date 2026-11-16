import fs from 'node:fs'
import path from 'node:path'
import type { CarryAbout } from '@shared/carry'
import {
  sanitizeFileName,
  type KindPortabilityOption,
  type PortableConflictResolution,
  type PortableEntryRecord,
  type PortableExportItemSpec,
  type PortableExportRequest,
  type PortableExportResult,
  type PortableImportEntryResult,
  type PortableImportRequest,
  type PortableImportResult,
  type PortablePeekItem,
  type PortablePeekResult,
  type PortableSource
} from '@shared/portability'
import { data } from '../data/hub'
import { secure } from '../util/secure'
import { writeUserFile } from '../util/fs'
import { USER, kindNamed, type Kind } from '../library/kinds'
import { assetsIn, freeName, swapAssets } from '../library/packing'
import { isPng } from '../carry/png'
import {
  decodeBundleArchive,
  decodeCardPng,
  decodeJsonEnvelope,
  encodeBundleArchive,
  encodeCardPng,
  encodeJsonExport,
  isPortableJsonEnvelope,
  peekBundleArchive,
  peekCardPng,
  peekJsonEnvelope,
  type DecodedPayload,
  type PeekHeader
} from './codec'
import { buildCarryAbout, collectPortableBundle, estimatePortableBundle, isPortableKind } from './pack'
import { readPortabilityPrefs } from './prefs'

export interface PortableKindSummary {
  kind: string
  label: string
  plural: string
  exportable: boolean
  importable: boolean
  preferBundle: boolean
  bundleNote: string | null
  options: KindPortabilityOption[]
  entries: { id: string; title: string; summary: string }[]
}

export function portabilityDescribeKind(kindName: string): PortableKindSummary {
  const k = kindNamed(kindName)
  if (!k) throw new Error(`Unknown kind "${kindName}".`)
  const hits = k.search('', 10_000, USER).filter((h) => !k.isGenerated?.(h.id))
  return {
    kind: k.kind,
    label: k.label,
    plural: k.plural,
    exportable: k.exportable && k.portability?.canExport !== false,
    importable: isPortableKind(k),
    preferBundle: Boolean(k.portability?.preferBundle),
    bundleNote: k.portability?.bundleNote ?? null,
    options: k.portability?.options ?? [],
    entries: hits.map((h) => ({ id: h.id, title: h.title, summary: k.line(h.id, USER) }))
  }
}

export function portabilityEstimate(input: {
  items: PortableExportItemSpec[]
  text?: string | null
  includeDependencies: boolean
  format: PortableExportRequest['format']
}) {
  return estimatePortableBundle(input)
}

function resolvePicturePng(pictureId?: string | null, framedBase64?: string | null): Buffer {
  if (framedBase64) {
    const clean = framedBase64.replace(/^data:image\/png;base64,/, '')
    const bytes = Buffer.from(clean, 'base64')
    if (!isPng(bytes)) throw new Error('The framed card image is not a valid PNG.')
    return bytes
  }
  if (!pictureId) throw new Error('Choose a PNG picture to carry the export.')
  const meta = data.assets.get(pictureId)
  const bytes = data.assets.readBytes(meta)
  if (!isPng(bytes)) throw new Error(`${meta.name} is not a PNG picture.`)
  return bytes
}

function uniqueOutputFile(dir: string, subDir: string, baseName: string, ext: string, used: Set<string>): string {
  const folder = subDir ? path.join(dir, sanitizeFileName(subDir)) : dir
  const stem = sanitizeFileName(baseName, 'export')
  let candidate = path.join(folder, `${stem}${ext}`)
  for (let n = 2; used.has(candidate.toLowerCase()) || fs.existsSync(candidate); n++) {
    candidate = path.join(folder, `${stem}_${n}${ext}`)
  }
  used.add(candidate.toLowerCase())
  return candidate
}

function encodeOne(args: {
  format: PortableExportRequest['format']
  protection: PortableExportRequest['protection']
  password?: string
  about: CarryAbout
  entries: PortableEntryRecord[]
  text: string | null
  files: { meta: { id: string; name: string; size: number }; data: Buffer }[]
  pictureId?: string | null
  framedBase64?: string | null
}): Buffer {
  if (args.format === 'card') {
    const png = resolvePicturePng(args.pictureId, args.framedBase64)
    return encodeCardPng({
      png,
      about: args.about,
      entries: args.entries,
      text: args.text,
      files: args.files,
      protection: args.protection,
      password: args.password
    })
  }
  if (args.format === 'json') {
    return encodeJsonExport({
      about: args.about,
      entries: args.entries,
      text: args.text,
      files: args.files,
      protection: args.protection,
      password: args.password
    })
  }
  return encodeBundleArchive({
    about: args.about,
    entries: args.entries,
    text: args.text,
    files: args.files,
    protection: args.protection,
    password: args.password
  })
}

export function portabilityExport(req: PortableExportRequest): PortableExportResult {
  const textOnly = !req.items.length
  if (textOnly && !req.text?.trim()) {
    throw new Error('Select at least one entry or enter text to export.')
  }
  if (req.protection === 'password' && !req.password) {
    throw new Error('Enter a password to protect this export.')
  }

  const ext = req.format === 'card' ? '.png' : req.format === 'bundle' ? '.sevenpack' : '.json'

  if (textOnly || req.splitMode === 'single' || req.format === 'bundle') {
    const collected = req.items.length ? collectPortableBundle(req.items, req.includeDependencies) : null
    const entries = collected?.entries ?? []
    const files = collected?.files ?? []
    const about = collected?.about ?? buildCarryAbout([], req.text ?? '', 0)
    const buf = encodeOne({
      format: req.format,
      protection: req.protection,
      password: req.password,
      about,
      entries,
      text: req.items.length ? null : (req.text ?? ''),
      files,
      pictureId: req.pictureId,
      framedBase64: req.framedBase64
    })
    const outPath = req.outputPath.toLowerCase().endsWith(ext) ? req.outputPath : `${req.outputPath}${ext}`
    writeUserFile(outPath, buf)
    return {
      files: [outPath],
      entryCount: collected?.roots.length ?? 0,
      dependencyCount: entries.filter((e) => e.isDependency).length,
      assetCount: files.length,
      bytes: buf.length
    }
  }

  const dir = req.outputPath
  const usedPaths = new Set<string>()
  const writtenFiles: string[] = []
  let totalBytes = 0
  let depCount = 0
  const seenAssetIds = new Set<string>()

  const groups: { key: string; subDir: string; fileBase: string; items: PortableExportItemSpec[] }[] =
    req.splitMode === 'kind'
      ? [...new Set(req.items.map((i) => i.kind))].map((kindName) => {
          const k = kindNamed(kindName)
          return {
            key: kindName,
            subDir: '',
            fileBase: k?.plural ?? kindName,
            items: req.items.filter((i) => i.kind === kindName)
          }
        })
      : req.items.map((spec) => {
          const k = kindNamed(spec.kind)
          const title = k?.title(spec.id) ?? spec.id
          return {
            key: `${spec.kind}/${spec.id}`,
            subDir: k?.plural ?? spec.kind,
            fileBase: title,
            items: [spec]
          }
        })

  for (const g of groups) {
    const collected = collectPortableBundle(g.items, req.includeDependencies)
    for (const f of collected.files) seenAssetIds.add(f.meta.id)
    depCount += collected.entries.filter((e) => e.isDependency).length
    const buf = encodeOne({
      format: req.format,
      protection: req.protection,
      password: req.password,
      about: collected.about,
      entries: collected.entries,
      text: null,
      files: collected.files,
      pictureId: req.pictureId,
      framedBase64: req.framedByKey?.[g.key] ?? req.framedBase64
    })
    const target = uniqueOutputFile(dir, g.subDir, g.fileBase, ext, usedPaths)
    writeUserFile(target, buf)
    writtenFiles.push(target)
    totalBytes += buf.length
  }

  return {
    files: writtenFiles,
    entryCount: req.items.length,
    dependencyCount: depCount,
    assetCount: seenAssetIds.size,
    bytes: totalBytes
  }
}

function readSourceBytes(source: PortableSource): { bytes: Buffer; ext: string; text: string | null } {
  if ('text' in source) {
    const buf = Buffer.from(source.text, 'utf8')
    const ext = source.name ? path.extname(source.name).toLowerCase() : '.json'
    return { bytes: buf, ext, text: source.text }
  }
  if ('path' in source) {
    const bytes = fs.readFileSync(source.path)
    return { bytes, ext: path.extname(source.path).toLowerCase(), text: null }
  }
  const meta = data.assets.metaFor(source.asset)
  if (!meta) throw new Error('That file could not be found in Seven.')
  return { bytes: data.assets.readBytes(meta), ext: path.extname(meta.name).toLowerCase(), text: null }
}

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04])

function looksLikeZip(bytes: Buffer, ext: string): boolean {
  return ext === '.sevenpack' || ext === '.zip' || (bytes.length >= 4 && bytes.subarray(0, 4).equals(ZIP_MAGIC))
}

function rawJsonTitle(raw: Record<string, unknown>, fallback: string): string {
  for (const k of ['title', 'name', 'label']) {
    if (typeof raw[k] === 'string' && raw[k].trim()) return raw[k].trim()
  }
  return fallback
}

function rawJsonEntries(parsed: unknown, targetKind: string | null | undefined, sourceName: string): PortableEntryRecord[] {
  const list = Array.isArray(parsed) ? parsed : [parsed]
  const out: PortableEntryRecord[] = []
  list.forEach((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return
    const rec = item as Record<string, unknown>
    const kind = typeof rec.kind === 'string' && kindNamed(rec.kind) ? rec.kind : targetKind
    if (!kind) return
    const title = rawJsonTitle(rec, list.length > 1 ? `${sourceName} ${idx + 1}` : sourceName)
    const id = typeof rec.id === 'string' && rec.id ? rec.id : title
    const value = 'value' in rec && rec.value && typeof rec.value === 'object' ? rec.value : rec
    out.push({ kind, id, title, value, isDependency: false })
  })
  return out
}

function buildPeekItems(entries: PortableEntryRecord[]): PortablePeekItem[] {
  return entries.map((e, index) => {
    const k = kindNamed(e.kind)
    const missingModule = !k
    const importable = isPortableKind(k)
    const existingId = k ? k.resolve(e.title, USER) : null
    const exists = Boolean(existingId)
    const isDependency = Boolean(e.isDependency)
    const resolution: PortableConflictResolution = !importable ? 'skip' : exists && isDependency ? 'skip' : 'copy'
    return {
      index,
      kind: e.kind,
      label: k?.label ?? e.kind,
      id: e.id,
      title: e.title,
      isDependency,
      exists,
      existingId,
      importable,
      missingModule,
      resolution
    }
  })
}

async function peekOneSource(
  source: PortableSource,
  targetKind: string | null | undefined,
  password?: string
): Promise<PortablePeekResult> {
  const prefs = readPortabilityPrefs()
  const maxBytes = prefs.maxUnpackMb * 1024 * 1024
  const vaultConfigured = Boolean(secure.keys)
  const vaultUnlocked = Boolean(secure.keys?.privateKey)

  try {
    const { bytes, ext, text } = readSourceBytes(source)

    if (isPng(bytes)) {
      let header: PeekHeader | null
      let decoded: DecodedPayload | null = null
      if (password) {
        decoded = decodeCardPng(bytes, password)
        header = {
          version: decoded.version,
          protection: decoded.protection,
          savedAt: decoded.savedAt,
          about: decoded.about,
          locked: false,
          wrongVaultKey: false,
          body: decoded.body,
          fileData: decoded.fileData
        }
      } else {
        header = peekCardPng(bytes)
      }
      if (!header) {
        return {
          source,
          container: 'card',
          version: 3,
          protection: 'none',
          locked: false,
          vaultConfigured,
          vaultUnlocked,
          wrongVaultKey: false,
          savedAt: Date.now(),
          about: null,
          hasPicture: true,
          items: [],
          text: null,
          fileCount: 0,
          error: 'This PNG picture does not carry any Seven export data.'
        }
      }
      const items = header.body ? buildPeekItems(header.body.entries) : []
      return {
        source,
        container: 'card',
        version: header.version,
        protection: header.protection,
        locked: header.locked,
        vaultConfigured,
        vaultUnlocked,
        wrongVaultKey: header.wrongVaultKey,
        savedAt: header.savedAt,
        about: header.about,
        hasPicture: true,
        items,
        text: header.body?.text ?? null,
        fileCount: header.body?.files.length ?? 0
      }
    }

    if (looksLikeZip(bytes, ext)) {
      const header: PeekHeader = password
        ? await decodeBundleArchive(bytes, maxBytes, password).then((d) => ({
            version: d.version,
            protection: d.protection,
            savedAt: d.savedAt,
            about: d.about,
            locked: false,
            wrongVaultKey: false,
            body: d.body,
            fileData: d.fileData
          }))
        : await peekBundleArchive(bytes, maxBytes)
      const items = header.body ? buildPeekItems(header.body.entries) : []
      return {
        source,
        container: 'bundle',
        version: header.version,
        protection: header.protection,
        locked: header.locked,
        vaultConfigured,
        vaultUnlocked,
        wrongVaultKey: header.wrongVaultKey,
        savedAt: header.savedAt,
        about: header.about,
        hasPicture: false,
        items,
        text: header.body?.text ?? null,
        fileCount: header.body?.files.length ?? 0
      }
    }

    const rawText = text ?? bytes.toString('utf8')
    let parsed: unknown
    try {
      parsed = JSON.parse(rawText)
    } catch {
      return {
        source,
        container: 'text',
        version: 3,
        protection: 'none',
        locked: false,
        vaultConfigured,
        vaultUnlocked,
        wrongVaultKey: false,
        savedAt: Date.now(),
        about: { kind: null, label: 'Text', title: rawText.trim().slice(0, 60) || 'Text', also: [] },
        hasPicture: false,
        items: [],
        text: rawText,
        fileCount: 0
      }
    }

    if (isPortableJsonEnvelope(parsed)) {
      const header: PeekHeader = password
        ? (() => {
            const d = decodeJsonEnvelope(parsed, password)
            return {
              version: d.version,
              protection: d.protection,
              savedAt: d.savedAt,
              about: d.about,
              locked: false,
              wrongVaultKey: false,
              body: d.body,
              fileData: d.fileData
            }
          })()
        : peekJsonEnvelope(parsed)
      const items = header.body ? buildPeekItems(header.body.entries) : []
      return {
        source,
        container: 'json',
        version: header.version,
        protection: header.protection,
        locked: header.locked,
        vaultConfigured,
        vaultUnlocked,
        wrongVaultKey: header.wrongVaultKey,
        savedAt: header.savedAt,
        about: header.about,
        hasPicture: false,
        items,
        text: header.body?.text ?? null,
        fileCount: header.body?.files.length ?? 0
      }
    }

    const sourceLabel = 'path' in source ? path.basename(source.path, ext) : 'name' in source && source.name ? path.basename(source.name, ext) : 'Imported entry'
    const entries = rawJsonEntries(parsed, targetKind, sourceLabel)
    if (!entries.length) {
      throw new Error(
        targetKind
          ? `Could not match this JSON to ${kindNamed(targetKind)?.plural ?? targetKind}.`
          : 'This JSON is not a Seven export package. Open a specific kind (or pick a target kind) to import raw JSON directly.'
      )
    }
    return {
      source,
      container: 'raw-json',
      version: 3,
      protection: 'none',
      locked: false,
      vaultConfigured,
      vaultUnlocked,
      wrongVaultKey: false,
      savedAt: Date.now(),
      about: buildCarryAbout(entries, null, entries.length),
      hasPicture: false,
      items: buildPeekItems(entries),
      text: null,
      fileCount: 0
    }
  } catch (err) {
    return {
      source,
      container: 'json',
      version: 3,
      protection: 'none',
      locked: false,
      vaultConfigured,
      vaultUnlocked,
      wrongVaultKey: false,
      savedAt: Date.now(),
      about: null,
      hasPicture: false,
      items: [],
      text: null,
      fileCount: 0,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

export async function portabilityPeek(input: {
  sources: PortableSource[]
  targetKind?: string | null
  password?: string
}): Promise<PortablePeekResult[]> {
  return Promise.all(input.sources.map((s) => peekOneSource(s, input.targetKind, input.password)))
}

export async function portabilityImport(req: PortableImportRequest): Promise<PortableImportResult> {
  const prefs = readPortabilityPrefs()
  const maxBytes = prefs.maxUnpackMb * 1024 * 1024
  const { bytes, ext, text } = readSourceBytes(req.source)

  let pictureAssetId: string | null = null
  const keepPicture = (): string | null => {
    if ('asset' in req.source) return req.source.asset
    if ('path' in req.source && isPng(bytes)) {
      const added = data.assets.registerBytes(path.basename(req.source.path), bytes, {
        tool: 'portability',
        sessionId: null,
        original: path.basename(req.source.path)
      })
      return added.id
    }
    return null
  }

  if (req.keepPictureOnly) {
    pictureAssetId = keepPicture()
    return { imported: [], skipped: [], text: null, pictureAssetId }
  }

  let decoded: DecodedPayload
  if (isPng(bytes)) {
    decoded = decodeCardPng(bytes, req.password)
    if (req.keepPicture) pictureAssetId = keepPicture()
  } else if (looksLikeZip(bytes, ext)) {
    decoded = await decodeBundleArchive(bytes, maxBytes, req.password)
  } else {
    const rawText = text ?? bytes.toString('utf8')
    const parsed = JSON.parse(rawText) as unknown
    if (isPortableJsonEnvelope(parsed)) {
      decoded = decodeJsonEnvelope(parsed, req.password)
    } else {
      const sourceLabel = 'path' in req.source ? path.basename(req.source.path, ext) : 'name' in req.source && req.source.name ? path.basename(req.source.name, ext) : 'Imported entry'
      const entries = rawJsonEntries(parsed, req.targetKind, sourceLabel)
      if (!entries.length) throw new Error('Could not recognize any importable items in this JSON file.')
      decoded = {
        version: 3,
        protection: 'none',
        savedAt: Date.now(),
        about: buildCarryAbout(entries, null, entries.length),
        body: { entries, text: null, files: [] },
        fileData: new Map()
      }
    }
  }

  if (decoded.body.text !== null && !decoded.body.entries.length) {
    return { imported: [], skipped: [], text: decoded.body.text, pictureAssetId }
  }

  const assetIds = new Map<string, string>()
  for (const f of decoded.body.files) {
    const buf = decoded.fileData.get(f.id) ?? Buffer.alloc(0)
    const added = data.assets.registerBytes(f.name, buf, { tool: 'portability', sessionId: null, original: f.name })
    assetIds.set(f.id, added.id)
  }

  const resolutionMap = new Map((req.resolutions ?? []).map((r) => [r.index, r.mode]))
  const made: { kind: string; old: string; id: string }[] = []
  const imported: PortableImportEntryResult[] = []
  const skipped: { title: string; reason: string }[] = []
  const entryResolver = (old: string, kindName?: string) =>
    made.find((m) => m.old === old && (!kindName || m.kind === kindName))?.id ?? old

  decoded.body.entries.forEach((e, index) => {
    const k = kindNamed(e.kind)
    if (!isPortableKind(k)) {
      skipped.push({ title: e.title, reason: k ? `${k.label} cannot be imported` : `Missing module for ${e.kind}` })
      return
    }
    const existingId = k.resolve(e.title, USER)
    const defaultMode: PortableConflictResolution = existingId && e.isDependency ? 'skip' : (req.defaultMode ?? 'copy')
    const mode = resolutionMap.get(index) ?? defaultMode
    if (mode === 'skip') {
      if (existingId) made.push({ kind: e.kind, old: e.id, id: existingId })
      skipped.push({ title: e.title, reason: existingId ? 'Reused existing entry' : 'Skipped by user' })
      return
    }
    const replace = mode === 'replace' ? existingId : null
    const swappedValue = swapAssets(e.value, assetIds)
    const newId = k.unpack(swappedValue, { replace, parent: null, entry: entryResolver })
    made.push({ kind: e.kind, old: e.id, id: newId })
    const effectiveMode = replace ? 'replace' : 'copy'
    imported.push({ kind: e.kind, id: newId, title: k.title(newId), mode: effectiveMode })
  })

  return {
    imported,
    skipped,
    text: decoded.body.text,
    pictureAssetId
  }
}

export function portabilityDefaultAbout(entries: PortableEntryRecord[], text: string | null): CarryAbout {
  return buildCarryAbout(entries, text)
}

export function portabilityCollectAssets(entries: PortableEntryRecord[]): string[] {
  return assetsIn(entries.map((e) => e.value))
}

export function portabilityFreeName(name: string, taken: (n: string) => boolean): string {
  return freeName(name, taken)
}

export type KindLookup = Kind

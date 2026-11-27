import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Archive, Eye, EyeOff, FileCode2, FileDown, Frame, ImageIcon, ImagePlus, Images, Layers, Loader2, Lock, LockOpen, Plus, Shield, Trash2 } from 'lucide-react'
import { sanitizeFileName, type PortabilityEstimate, type PortabilityFormat, type PortabilitySplit, type PortableExportItemSpec, type ProtectionMode } from '@shared/portability'
import { showName, toId } from '@shared/ids'
import type { LibraryHit } from '@shared/types'
import { AlertBox, Button, Input, Modal, OptionTile, Segmented, Select, Textarea, Toggle } from '../ui'
import { useViewPlace } from '../../lib/viewPlace'
import { EntryPicker } from '../library/EntryPicker'
import { usePicturePick } from '../pictures/usePicturePick'
import type { PictureOptions } from '../data/PicturePicker'
import { FramePreview } from '../carry/save/FramePreview'
import { drawCarryFrame, frameLayout, type FrameInfo } from '../carry/save/drawCarryFrame'
import { readFramePalette } from '../carry/save/framePalette'
import { engine, main } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { failed } from '../../lib/notify'
import { canvasPngBase64 } from '../../lib/canvasPng'
import { useImageBitmap } from '../../lib/useImageBitmap'
import { useLibrary } from '../../lib/library'
import { toast } from '../../store/toasts'
import { useVault } from '../../store/vault'
import { useData } from '../../store/data'
import { useApp } from '../../store/app'
import { closePortableExport, type ExportBasketItem, type PortableExportState } from './portabilityStore'

const PNG = 'image/png'
const ANY_PICTURE: PictureOptions = { kinds: ['image'], what: 'a picture' }
const PNG_PICTURE: PictureOptions = { mimes: [PNG], what: 'a PNG picture' }

interface KindDescriptor {
  kind: string
  label: string
  plural: string
  exportable: boolean
  importable: boolean
  preferBundle: boolean
  bundleNote: string | null
  options: { id: string; label: string; description?: string; defaultValue: boolean }[]
  entries: { id: string; title: string; summary: string }[]
}

const FORMAT_OPTIONS: { value: PortabilityFormat; label: string; hint: string }[] = [
  { value: 'card', label: 'Card (.png)', hint: 'Embeds data inside a PNG picture card' },
  { value: 'json', label: 'JSON (.json)', hint: 'Readable JSON envelope file' },
  { value: 'bundle', label: 'Bundle (.sevenpack)', hint: 'Compressed archive with attachments' }
]

const SPLIT_OPTIONS: { value: PortabilitySplit; label: string; hint: string }[] = [
  { value: 'single', label: 'One file', hint: 'Everything combined into one export file' },
  { value: 'kind', label: 'One per kind', hint: 'Separate file for each kind in a folder' },
  { value: 'entry', label: 'One per entry', hint: 'Separate file per entry organised by kind' }
]

const PROTECTION_OPTIONS: { value: ProtectionMode; label: string; hint: string }[] = [
  { value: 'none', label: 'Anyone', hint: 'Any Seven installation can import this' },
  { value: 'password', label: 'Password', hint: 'Encrypted standalone archive — share password separately' },
  { value: 'vault', label: 'Vault key', hint: 'Locked to your personal Seven vault key only' }
]

function Label({ children }: { children: ReactNode }) {
  return <div className="font-label text-[10.5px] font-bold caps-20 text-accent-soft">{children}</div>
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

async function renderFramedCardBase64(bitmap: ImageBitmap, info: FrameInfo): Promise<string> {
  await document.fonts.ready
  const { width, height } = frameLayout(bitmap.width, bitmap.height)
  const offscreen = document.createElement('canvas')
  offscreen.width = width
  offscreen.height = height
  const ctx = offscreen.getContext('2d')
  if (!ctx) throw new Error('Could not draw card frame.')
  drawCarryFrame(ctx, bitmap, bitmap.width, bitmap.height, info, readFramePalette())
  return canvasPngBase64(offscreen)
}

function CardStage({
  bitmap,
  picture,
  framed,
  pngOk,
  info,
  pick,
  canvasRef
}: {
  bitmap: ImageBitmap | null
  picture: string | null
  framed: boolean
  pngOk: boolean
  info: FrameInfo
  pick: ReturnType<typeof usePicturePick>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}) {
  const size = bitmap ? (framed ? frameLayout(bitmap.width, bitmap.height) : bitmap) : null
  return (
    <div className="relative flex min-h-[280px] min-w-0 flex-col border border-line/60 bg-panel bg-[radial-gradient(circle_at_12%_8%,color-mix(in_srgb,var(--color-accent)_11%,transparent),transparent_45%),radial-gradient(circle_at_88%_92%,color-mix(in_srgb,var(--color-teal)_11%,transparent),transparent_45%)]">
      <div className="hud-scan pointer-events-none absolute inset-0" />
      <div className="relative flex min-h-[260px] flex-1 items-center justify-center p-5">
        {bitmap ? (
          <FramePreview bitmap={bitmap} info={info} framed={framed} canvasRef={canvasRef} />
        ) : picture ? (
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        ) : (
          <div className="bracket flex w-full max-w-md flex-col items-center gap-4 border border-dashed border-line px-6 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center border border-accent text-accent shadow-[0_0_24px_color-mix(in_srgb,var(--color-accent)_calc(30%*var(--glow)),transparent)]">
              <ImagePlus className="h-5 w-5" />
            </span>
            <div>
              <div className="font-label text-[11.5px] font-bold caps-20 text-accent">Pick a picture</div>
              <div className="mt-1 text-[12px] text-dim">{framed ? 'Any picture works: it gets a Seven card frame and saves as PNG.' : 'Without the frame, only PNG pictures can carry data.'}</div>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="primary" icon={<Images />} onClick={pick.fromSeven}>
                From Seven
              </Button>
              <Button size="sm" variant="secondary" icon={<ImagePlus />} onClick={pick.fromDisk}>
                From your computer…
              </Button>
            </div>
          </div>
        )}
      </div>
      {picture && (
        <div className="relative flex flex-wrap items-center gap-2 border-t border-line/50 tone-panel-70 px-3 py-2">
          <span className="font-label text-[10.5px] caps-16 text-dim">{size ? `${size.width} × ${size.height} px` : '…'}</span>
          {!pngOk && <span className="text-[11.5px] text-alert">Not a PNG — turn frame on or pick a PNG</span>}
          <span className="ml-auto flex gap-1.5">
            <Button size="sm" variant="ghost" icon={<Images />} onClick={pick.fromSeven}>
              From Seven
            </Button>
            <Button size="sm" variant="ghost" icon={<ImagePlus />} onClick={pick.fromDisk}>
              From disk…
            </Button>
          </span>
        </div>
      )}
    </div>
  )
}

export function PortableExportModal({ state }: { state: PortableExportState }) {
  const vault = useVault((s) => s.status)
  const portabilityPrefs = useApp((s) => s.settings?.portability)
  const { sections } = useLibrary('', 0)
  const exportableSections = useMemo(() => (sections ?? []).filter((s) => s.exportable && s.count > 0), [sections])

  const [mode, setMode] = useState<'items' | 'text'>(state.mode)
  const [basket, setBasket] = useState<ExportBasketItem[]>(state.items)
  const [text, setText] = useState(state.text)
  const [described, setDescribed] = useState<Record<string, KindDescriptor>>({})
  const [kindOptions, setKindOptions] = useState<Record<string, Record<string, boolean>>>({})
  const [includeDependencies, setIncludeDependencies] = useState(portabilityPrefs?.includeDependenciesByDefault ?? true)
  const [format, setFormat] = useState<PortabilityFormat>(state.defaultFormat ?? 'bundle')
  const [formatTouched, setFormatTouched] = useState(Boolean(state.defaultFormat))
  const [prefixKind, setPrefixKind] = useViewPlace('export.prefixKind', false)
  const [splitMode, setSplitMode] = useState<PortabilitySplit>('single')
  const [protection, setProtection] = useState<ProtectionMode>('none')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [addingKind, setAddingKind] = useState<string>('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerKind, setPickerKind] = useState<string | null>(null)

  const [picture, setPicture] = useState<string | null>(null)
  const [framed, setFramed] = useState(true)
  const [at] = useState(() => Date.now())
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const bitmap = useImageBitmap(picture)
  const mime = useData((s) => (picture ? s.assets.find((a) => a.id === picture)?.mime : undefined))
  const pick = usePicturePick(picture, setPicture, framed ? ANY_PICTURE : PNG_PICTURE)

  const [estimate, setEstimate] = useState<PortabilityEstimate | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const activeKinds = useMemo(() => [...new Set(basket.map((b) => b.kind))], [basket])

  useEffect(() => {
    const missing = activeKinds.filter((k) => !described[k])
    if (!missing.length) return
    let live = true
    void Promise.all(
      missing.map((kind) =>
        engine('portability.describeKind', { kind }).then((desc) => ({ kind, desc }))
      )
    )
      .then((results) => {
        if (!live) return
        setDescribed((prev) => {
          const next = { ...prev }
          for (const r of results) next[r.kind] = r.desc
          return next
        })
        setKindOptions((prev) => {
          const next = { ...prev }
          for (const r of results) {
            if (!next[r.kind]) {
              const defaults: Record<string, boolean> = {}
              for (const opt of r.desc.options) defaults[opt.id] = opt.defaultValue
              next[r.kind] = defaults
            }
          }
          return next
        })
      })
      .catch(failed('Could not inspect export kind'))
    return () => {
      live = false
    }
  }, [activeKinds, described])

  useEffect(() => {
    if (formatTouched || state.defaultFormat) return
    if (mode === 'text') {
      setFormat('card')
      return
    }
    const wantsBundle = activeKinds.some((k) => described[k]?.preferBundle)
    if (wantsBundle) setFormat('bundle')
    else if (activeKinds.length === 1 && basket.length === 1 && basket[0].id !== null) setFormat('card')
    else if (basket.length > 0) setFormat('bundle')
  }, [activeKinds, basket, described, formatTouched, mode, state.defaultFormat])

  const expandedItems: PortableExportItemSpec[] = useMemo(() => {
    if (mode === 'text') return []
    const seen = new Set<string>()
    const specs: PortableExportItemSpec[] = []
    for (const b of basket) {
      const opts = kindOptions[b.kind] ?? {}
      if (b.id === null) {
        const entries = described[b.kind]?.entries ?? []
        for (const e of entries) {
          const key = `${b.kind}/${e.id}`
          if (seen.has(key)) continue
          seen.add(key)
          specs.push({ kind: b.kind, id: e.id, options: opts })
        }
      } else {
        const key = `${b.kind}/${b.id}`
        if (seen.has(key)) continue
        seen.add(key)
        specs.push({ kind: b.kind, id: b.id, options: opts })
      }
    }
    return specs
  }, [basket, described, kindOptions, mode])

  useEffect(() => {
    if (mode === 'items' && !expandedItems.length) {
      setEstimate(null)
      setEstimateError(null)
      return
    }
    if (mode === 'text' && !text.trim()) {
      setEstimate(null)
      setEstimateError(null)
      return
    }
    let live = true
    setEstimating(true)
    const timer = setTimeout(() => {
      void engine('portability.estimate', {
        items: expandedItems,
        text: mode === 'text' ? text : null,
        includeDependencies,
        format
      })
        .then((est) => {
          if (!live) return
          setEstimate(est)
          setEstimateError(null)
          if (!formatTouched && !state.defaultFormat && (est.bundleRecommendedKinds.length > 0 || (format === 'card' && est.exceedsCardWarn))) {
            setFormat('bundle')
          }
        })
        .catch((err) => {
          if (!live) return
          setEstimateError(errorText(err))
          setEstimate(null)
        })
        .finally(() => {
          if (live) setEstimating(false)
        })
    }, 120)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [expandedItems, format, formatTouched, includeDependencies, mode, state.defaultFormat, text])

  const effectiveSplit: PortabilitySplit = mode === 'text' || expandedItems.length <= 1 ? 'single' : splitMode

  const firstItem = expandedItems[0]
  const firstDesc = firstItem ? described[firstItem.kind] : undefined
  const firstEntryTitle = firstItem ? (firstDesc?.entries.find((e) => e.id === firstItem.id)?.title ?? basket[0]?.title ?? firstItem.id) : ''

  const info: FrameInfo = useMemo(() => {
    if (mode === 'text') {
      return {
        label: 'Data',
        title: text.trim().split('\n')[0].slice(0, 60) || 'Data',
        also: 0,
        locked: protection !== 'none',
        at
      }
    }
    const label = activeKinds.length === 1 ? (firstDesc?.label ?? activeKinds[0]) : `${activeKinds.length} kinds`
    const title = expandedItems.length === 1 ? showName(firstEntryTitle) : `${expandedItems.length} entries`
    return {
      label,
      title: title || 'Seven export',
      also: estimate ? Math.max(0, estimate.dependencyCount + estimate.assetCount) : 0,
      locked: protection !== 'none',
      at
    }
  }, [activeKinds, at, estimate, expandedItems.length, firstDesc?.label, firstEntryTitle, mode, protection, text])

  const addEntryToBasket = (hit: LibraryHit) => {
    setBasket((prev) => {
      if (prev.some((p) => p.kind === hit.kind && (p.id === null || p.id === hit.id))) return prev
      return [...prev, { key: `${hit.kind}:${hit.id}:${Date.now()}`, kind: hit.kind, id: hit.id, title: hit.title }]
    })
    setPickerOpen(false)
  }

  const addWholeKind = (kind: string) => {
    if (!kind) return
    setBasket((prev) => {
      const filtered = prev.filter((p) => p.kind !== kind)
      return [...filtered, { key: `${kind}:*all*:${Date.now()}`, kind, id: null }]
    })
    setAddingKind('')
  }

  const pngOk = framed || mime === PNG
  const passwordValid = protection !== 'password' || (password.length >= 1 && password === confirmPassword)
  const vaultValid = protection !== 'vault' || vault.configured
  const hasPayload = mode === 'text' ? Boolean(text.trim()) : expandedItems.length > 0
  const cardReady = format !== 'card' || Boolean(picture && bitmap && pngOk)
  const ready = hasPayload && cardReady && passwordValid && vaultValid && !busy && !estimateError

  const allKindOptions = useMemo(() => {
    const out: { kind: string; kindLabel: string; opt: KindDescriptor['options'][number] }[] = []
    for (const k of activeKinds) {
      const d = described[k]
      if (!d) continue
      for (const opt of d.options) out.push({ kind: k, kindLabel: d.plural, opt })
    }
    return out
  }, [activeKinds, described])

  const defaultBaseName = useMemo(() => {
    if (mode === 'text') return 'data'
    if (expandedItems.length === 1 && firstItem) {
      const raw = sanitizeFileName(showName(firstEntryTitle) || firstItem.id)
      return prefixKind ? `${firstItem.kind}_${toId(raw) || raw}` : raw
    }
    if (activeKinds.length === 1 && firstDesc) {
      const raw = sanitizeFileName(firstDesc.plural.toLowerCase())
      return prefixKind ? `${firstDesc.kind}_${toId(raw) || raw}` : raw
    }
    return 'seven-export'
  }, [activeKinds.length, expandedItems.length, firstDesc, firstEntryTitle, firstItem, mode, prefixKind])

  const runExport = async () => {
    if (!ready) return
    const ext = format === 'card' ? '.png' : format === 'bundle' ? '.sevenpack' : '.json'
    const outputPath = effectiveSplit === 'single' ? await main('dialog.savePath', { name: `${defaultBaseName}${ext}` }) : await main('dialog.openFolder')
    if (!outputPath) return

    setBusy(true)
    try {
      let framedBase64: string | null = null
      let framedByKey: Record<string, string> | null = null

      if (format === 'card' && framed) {
        if (effectiveSplit === 'single') {
          framedBase64 = canvasRef.current ? await canvasPngBase64(canvasRef.current) : null
        } else if (bitmap) {
          framedByKey = {}
          if (effectiveSplit === 'kind') {
            for (const kindName of activeKinds) {
              const d = described[kindName]
              const count = expandedItems.filter((i) => i.kind === kindName).length
              framedByKey[kindName] = await renderFramedCardBase64(bitmap, {
                label: d?.plural ?? kindName,
                title: `${count} ${d ? (count === 1 ? d.label : d.plural) : kindName}`,
                also: 0,
                locked: protection !== 'none',
                at
              })
            }
          } else {
            for (const spec of expandedItems) {
              const d = described[spec.kind]
              const entryTitle = d?.entries.find((e) => e.id === spec.id)?.title ?? spec.id
              framedByKey[`${spec.kind}/${spec.id}`] = await renderFramedCardBase64(bitmap, {
                label: d?.label ?? spec.kind,
                title: showName(entryTitle),
                also: 0,
                locked: protection !== 'none',
                at
              })
            }
          }
        }
      }

      const result = await engine('portability.export', {
        items: expandedItems,
        text: mode === 'text' ? text : null,
        includeDependencies,
        format,
        splitMode: effectiveSplit,
        protection,
        password: protection === 'password' ? password : undefined,
        outputPath,
        pictureId: format === 'card' ? picture : null,
        framedBase64,
        framedByKey,
        prefixKind
      })

      toast.success(
        `Exported ${result.files.length} file${result.files.length === 1 ? '' : 's'}`,
        `${formatBytes(result.bytes)}${result.assetCount ? ` · ${result.assetCount} attachment${result.assetCount === 1 ? '' : 's'}` : ''}`
      )
      closePortableExport()
    } catch (err) {
      failed('Export failed')(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      width={1120}
      title="Portable Export"
      onClose={closePortableExport}
      bodyClassName="flex min-h-0 flex-1 p-0"
      footer={
        <>
          <span className="mr-auto self-center font-label text-[10.5px] caps-14 text-faint">
            {estimate
              ? `${estimate.rootCount} ${estimate.rootCount === 1 ? 'entry' : 'entries'}${estimate.dependencyCount ? ` + ${estimate.dependencyCount} linked` : ''}${estimate.assetCount ? ` · ${estimate.assetCount} files` : ''} · ~${formatBytes(format === 'bundle' ? estimate.compressedBytes : estimate.rawBytes)}`
              : estimating
                ? 'Estimating size…'
                : 'Choose items to export'}
          </span>
          <Button variant="ghost" onClick={closePortableExport}>
            Cancel
          </Button>
          <Button variant="primary" icon={busy ? <Loader2 className="animate-spin" /> : <FileDown />} disabled={!ready} onClick={() => void runExport()}>
            {effectiveSplit === 'single' ? 'Save export…' : 'Choose folder…'}
          </Button>
        </>
      }
    >
      <div className="grid min-h-0 w-full flex-1 grid-cols-[minmax(0,1fr)_360px] tablet:grid-cols-1">
        <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>What to export</Label>
            <Segmented value={mode} options={[{ value: 'items', label: 'Entries / Kinds' }, { value: 'text', label: 'Text or JSON' }]} onChange={setMode} />
          </div>

          {mode === 'text' ? (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Paste any text or JSON to package and optionally encrypt…"
              className="font-ui text-[12.5px]"
            />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5 border border-line/60 tone-panel-40 p-2.5">
                {basket.length === 0 ? (
                  <div className="py-3 text-center text-[12.5px] text-dim">Nothing in the export basket yet. Add an entry or a whole kind below.</div>
                ) : (
                  basket.map((item) => {
                    const d = described[item.kind]
                    const entryTitle = item.id === null ? `All ${d?.plural ?? item.kind} (${d?.entries.length ?? '…'})` : showName(d?.entries.find((e) => e.id === item.id)?.title ?? item.title ?? item.id)
                    return (
                      <div key={item.key} className="flex items-center gap-2 border border-line/40 tone-panel-50 px-2.5 py-1.5">
                        <span className="shrink-0 bg-accent/90 px-1.5 py-0.5 font-label text-[10px] font-bold caps-14 text-on-accent">
                          {d?.label ?? item.kind}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{entryTitle}</span>
                        <button
                          type="button"
                          title="Remove from basket"
                          onClick={() => setBasket((prev) => prev.filter((p) => p.key !== item.key))}
                          className="text-dim hover:text-alert"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })
                )}

                <div className="mt-1 flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Plus />}
                    onClick={() => {
                      setPickerKind(null)
                      setPickerOpen((v) => !v)
                    }}
                  >
                    Add entry…
                  </Button>
                  {exportableSections.length > 0 && (
                    <div className="min-w-[180px] flex-1">
                      <Select
                        value={addingKind}
                        onChange={addWholeKind}
                        options={[
                          { value: '', label: '+ Add entire kind…' },
                          ...exportableSections.map((s) => ({ value: s.kind, label: `${s.plural} (${s.count})` }))
                        ]}
                        className="h-8 text-[12px]"
                      />
                    </div>
                  )}
                </div>

                {pickerOpen && (
                  <div className="mt-2">
                    <EntryPicker inline kind={pickerKind} title="Pick an entry to add" onPick={addEntryToBasket} onClose={() => setPickerOpen(false)} />
                  </div>
                )}
              </div>

              {allKindOptions.length > 0 && (
                <div className="flex flex-col gap-1.5 border border-line/50 tone-panel-30 p-3">
                  <Label>Kind options</Label>
                  {allKindOptions.map(({ kind, kindLabel, opt }) => {
                    const checked = kindOptions[kind]?.[opt.id] ?? opt.defaultValue
                    return (
                      <div key={`${kind}.${opt.id}`} className="flex flex-col gap-0.5 py-0.5">
                        <Toggle
                          checked={checked}
                          onChange={(val) =>
                            setKindOptions((prev) => ({
                              ...prev,
                              [kind]: { ...(prev[kind] ?? {}), [opt.id]: val }
                            }))
                          }
                          label={activeKinds.length > 1 ? `${kindLabel}: ${opt.label}` : opt.label}
                        />
                        {opt.description && <div className="pl-11 text-[11.5px] text-dim">{opt.description}</div>}
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex flex-col gap-2 border border-line/50 tone-panel-30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Toggle checked={includeDependencies} onChange={setIncludeDependencies} label="Include linked dependencies" />
                  {estimate && (
                    <span className="font-ui text-[11px] text-secondary">
                      {estimate.dependencyCount} linked · {estimate.assetCount} assets
                    </span>
                  )}
                </div>
                <div className="pl-11 text-[11.5px] text-dim">
                  Bundles related characters, spells, maps, portraits, and files referenced by your selection so the import arrives complete.
                </div>
                {includeDependencies && estimate && estimate.dependencies.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5 pl-11">
                    {estimate.dependencies.slice(0, 12).map((dep) => (
                      <span key={`${dep.kind}/${dep.id}`} className="border border-line/50 tone-panel-50 px-1.5 py-0.5 font-ui text-[10.5px] text-dim">
                        {dep.label}: {showName(dep.title)}
                      </span>
                    ))}
                    {estimate.dependencies.length > 12 && (
                      <span className="px-1.5 py-0.5 font-ui text-[10.5px] text-faint">+{estimate.dependencies.length - 12} more</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {estimateError && <AlertBox>{estimateError}</AlertBox>}

          {estimate && estimate.warnings.length > 0 && (
            <AlertBox className="flex flex-col gap-2">
              <div>{estimate.warnings.join('\n')}</div>
              <div className="flex flex-wrap gap-2">
                {format !== 'bundle' && (estimate.exceedsCardWarn || estimate.exceedsJsonWarn || estimate.bundleRecommendedKinds.length > 0) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Archive />}
                    onClick={() => {
                      setFormat('bundle')
                      setFormatTouched(true)
                    }}
                  >
                    Switch to Bundle (.sevenpack)
                  </Button>
                )}
                {includeDependencies && estimate.dependencyCount > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setIncludeDependencies(false)}>
                    Exclude linked dependencies
                  </Button>
                )}
              </div>
            </AlertBox>
          )}

          {format === 'card' && (
            <CardStage bitmap={bitmap} picture={picture} framed={framed} pngOk={pngOk} info={info} pick={pick} canvasRef={canvasRef} />
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-l border-line/60 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-accent)_7%,transparent),transparent_45%)] p-4 tablet:border-l-0 tablet:border-t">
          <section className="flex flex-col gap-2">
            <Label>Format</Label>
            <Segmented
              value={format}
              options={FORMAT_OPTIONS}
              onChange={(v) => {
                setFormat(v)
                setFormatTouched(true)
              }}
            />
            <div className="flex items-start gap-2 text-[12px] text-dim">
              {format === 'card' && <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />}
              {format === 'json' && <FileCode2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />}
              {format === 'bundle' && <Archive className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />}
              <span>{FORMAT_OPTIONS.find((f) => f.value === format)?.hint}</span>
            </div>
            {format === 'card' && (
              <div className="mt-1">
                <OptionTile
                  icon={<Frame />}
                  title="Seven card frame"
                  hint="Adds a Seven header/footer border around the picture and outputs PNG."
                  checked={framed}
                  onChange={setFramed}
                />
              </div>
            )}
            {mode === 'items' && (
              <Toggle
                checked={prefixKind}
                onChange={setPrefixKind}
                label="Prefix filename with kind (e.g. sheet_valerius)"
              />
            )}
          </section>

          {mode === 'items' && expandedItems.length > 1 && (
            <section className="flex flex-col gap-2">
              <Label>Output layout</Label>
              <Segmented value={splitMode} options={SPLIT_OPTIONS} onChange={setSplitMode} />
              <div className="flex items-start gap-2 text-[12px] text-dim">
                <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />
                <span>{SPLIT_OPTIONS.find((s) => s.value === splitMode)?.hint}</span>
              </div>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <Label>Protection</Label>
            <Segmented value={protection} options={PROTECTION_OPTIONS} onChange={setProtection} />
            <div className="flex items-start gap-2 text-[12px] text-dim">
              {protection === 'none' && <LockOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-secondary" />}
              {protection === 'password' && <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />}
              {protection === 'vault' && <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />}
              <span>{PROTECTION_OPTIONS.find((p) => p.value === protection)?.hint}</span>
            </div>

            {protection === 'password' && (
              <div className="mt-1 flex flex-col gap-2 border border-line/50 tone-panel-40 p-2.5">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Encryption password"
                    className="pr-9"
                  />
                  <button
                    type="button"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dim hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                />
                {password && confirmPassword && password !== confirmPassword && (
                  <div className="text-[11.5px] text-alert">Passwords do not match.</div>
                )}
              </div>
            )}

            {protection === 'vault' && !vault.configured && (
              <AlertBox>Your local vault is not set up yet. Configure a vault in Settings, or choose Password protection for sharing.</AlertBox>
            )}
          </section>
        </aside>
      </div>
    </Modal>
  )
}

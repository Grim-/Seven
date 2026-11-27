import { useMemo, useState } from 'react'
import { Copy, FolderOpen, Pencil, RotateCcw, Search, Trash2 } from 'lucide-react'
import type { ImageHistoryEntry } from '@shared/types'
import { useData } from '../../store/data'
import { formatRelative } from '../../lib/format'
import { showInData } from '../../lib/library'
import { copyText } from '../../lib/notify'
import { Button, Input, StatusBadge, openMenu } from '../ui'
import { AssetMedia } from './AssetMedia'

export function ImageHistoryList({
  entries,
  selectedAssetId,
  onLoad,
  onEditAsset,
  onUseAsset,
  onRemove,
  onClear
}: {
  entries: ImageHistoryEntry[]
  selectedAssetId?: string | null
  onLoad: (entry: ImageHistoryEntry) => void
  onEditAsset?: (assetId: string) => void
  onUseAsset?: (assetId: string) => void
  onRemove: (id: string, deleteAsset?: boolean) => void
  onClear?: () => void
}) {
  const assets = useData((s) => s.assets)
  const assetSet = useMemo(() => new Set(assets.map((a) => a.id)), [assets])
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) =>
      `${e.prompt} ${e.negativePrompt ?? ''} ${e.modelName} ${e.contextTitle ?? ''} ${e.seed ?? ''}`.toLowerCase().includes(q)
    )
  }, [entries, query])

  if (entries.length === 0) {
    return (
      <div className="p-4 text-center text-[12.5px] text-faint">
        No saved prompts yet. Every image generation and edit saves its prompt, settings, and output in your vault here.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter saved prompts, models, contexts, or seeds…"
            className="h-8 pl-8 text-[12px]"
          />
        </div>
        {onClear && (
          <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={onClear}>
            Clear list
          </Button>
        )}
      </div>
      <div className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
        {shown.length === 0 ? (
          <div className="py-4 text-center text-[12px] text-faint">No prompts match &ldquo;{query.trim()}&rdquo;.</div>
        ) : (
          shown.map((entry) => {
            const exists = assetSet.has(entry.assetId)
            const active = selectedAssetId === entry.assetId
            return (
              <div
                key={entry.id}
                className={
                  active
                    ? 'flex gap-3 border border-accent/60 bg-accent/5 p-2.5'
                    : 'flex gap-3 border border-line/60 tone-well-35 p-2.5 hover:border-line-hover'
                }
              >
                <button
                  type="button"
                  disabled={!exists}
                  onClick={() => exists && onEditAsset?.(entry.assetId)}
                  className="h-20 w-20 shrink-0 overflow-hidden border border-line/60 tone-panel-60"
                  title={exists ? 'Preview / edit image' : 'Image file removed from Files'}
                >
                  {exists ? (
                    <AssetMedia id={entry.assetId} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center px-1 text-center font-ui text-[10px] text-faint">
                      Missing
                    </span>
                  )}
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5 font-ui text-[10.5px] text-dim">
                    <StatusBadge tone={entry.kind === 'edit' ? 'busy' : 'idle'}>
                      {entry.kind === 'edit' ? 'Edit' : 'Generate'}
                    </StatusBadge>
                    <span className="text-ink">{entry.modelName}</span>
                    <span>· {`${entry.width}×${entry.height}`}</span>
                    <span>· {entry.steps} steps</span>
                    <span>· CFG {entry.cfgScale}</span>
                    {entry.seed !== null && <span>· seed {entry.seed}</span>}
                    {entry.contextTitle && (
                      <span className="border border-line/60 px-1.5 py-px text-accent-soft">{entry.contextTitle}</span>
                    )}
                    <span className="ml-auto text-faint">{formatRelative(entry.createdAt)}</span>
                  </div>
                  <p className="line-clamp-3 whitespace-pre-wrap text-[12.5px] leading-snug text-ink">{entry.prompt}</p>
                  {entry.negativePrompt && (
                    <p className="line-clamp-1 font-ui text-[11px] text-dim">Negative: {entry.negativePrompt}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <Button size="sm" variant="badge" icon={<RotateCcw />} onClick={() => onLoad(entry)}>
                      Load prompt & settings
                    </Button>
                    <Button size="sm" variant="ghost" icon={<Copy />} onClick={() => void copyText(entry.prompt, 'Prompt copied')}>
                      Copy prompt
                    </Button>
                    {exists && onEditAsset && (
                      <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => onEditAsset(entry.assetId)}>
                        Edit / img2img
                      </Button>
                    )}
                    {exists && onUseAsset && (
                      <Button size="sm" variant="primary" onClick={() => onUseAsset(entry.assetId)}>
                        Use image
                      </Button>
                    )}
                    {exists && !onUseAsset && (
                      <Button size="sm" variant="ghost" icon={<FolderOpen />} onClick={() => showInData({ kind: 'asset', id: entry.assetId })}>
                        Files
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 />}
                      className="ml-auto"
                      onClick={(e) => {
                        if (!exists) return onRemove(entry.id, false)
                        openMenu(e, 'Delete prompt', [
                          { label: 'Remove prompt only', icon: <Trash2 />, onSelect: () => onRemove(entry.id, false) },
                          { label: 'Delete prompt & image', icon: <Trash2 />, danger: true, onSelect: () => onRemove(entry.id, true) }
                        ])
                      }}
                      title="Remove from history"
                    />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

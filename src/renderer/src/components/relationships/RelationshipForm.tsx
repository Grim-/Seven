import { useMemo } from 'react'
import { Link2, Unlink } from 'lucide-react'
import { categoryForKind, cleanAffinity, linkTagOf, parseLinkRef, stanceMeta, type RelationshipEntry } from '@shared/relationships'
import { pageKindOf } from '@shared/types'
import { showName } from '@shared/ids'
import { Button, Eyebrow, Input, Popover, SliderNumber, TagInput, Toggle } from '../ui'
import { BrowseList, type BrowseOption } from '../ui/BrowsePick'
import { LinkTextarea } from '../data/LinkTextarea'
import { MarkdownEditor } from '../data/MarkdownEditor'
import { cn } from '../../lib/cn'
import { useKindInfos } from '../../lib/kinds'
import { useAgents } from '../../store/agents'
import { useData } from '../../store/data'
import { CATEGORY_UIS, STANCE_UIS } from './styles'

function useEntryOptions(): BrowseOption[] {
  const pages = useData((s) => s.pages)
  const assets = useData((s) => s.assets)
  const agents = useAgents((s) => s.list)
  const kinds = useKindInfos()
  return useMemo(() => {
    const labels = new Map(kinds.map((k) => [k.kind, k.label]))
    return [
      ...agents.map((a) => ({ value: `agent/${a.id}`, label: a.name, group: labels.get('agent') ?? 'Agents', note: a.description || undefined })),
      ...pages.map((p) => {
        const kind = pageKindOf(p.type)
        return { value: `${kind}/${p.id}`, label: showName(p.title), group: labels.get(kind) ?? kind }
      }),
      ...assets.map((f) => ({ value: `file/${f.id}`, label: f.name, group: labels.get('file') ?? 'Files', note: f.kind }))
    ]
  }, [agents, pages, assets, kinds])
}

function Label({ children, title }: { children: string; title?: string }) {
  return (
    <span title={title} className="w-fit cursor-default">
      <Eyebrow>{children}</Eyebrow>
    </span>
  )
}

export function RelationshipForm({ value, onChange, autoFocus = false }: { value: RelationshipEntry; onChange: (next: RelationshipEntry) => void; autoFocus?: boolean }) {
  const options = useEntryOptions()
  const parsedRef = value.ref ? parseLinkRef(value.ref) : null
  const set = (patch: Partial<RelationshipEntry>) => onChange({ ...value, ...patch, updatedAt: Date.now() })

  const pickLink = (ref: string, close: () => void) => {
    const picked = options.find((o) => o.value === ref)
    const parsed = parseLinkRef(ref)
    const keepTarget = value.target.trim() && value.target !== (parsedRef ? showName(parsedRef.id) : '')
    set({ ref, target: keepTarget ? value.target : (picked?.label ?? showName(parsed?.id ?? ref)), category: parsed ? categoryForKind(parsed.kind) : value.category })
    close()
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-[minmax(24rem,1.25fr)_minmax(16rem,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-visible">
      <div className="flex min-w-0 flex-col gap-3 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
        <div className="flex flex-col gap-1.5">
          <Label title="Any character, place, object, faction or idea, or a linked Seven entry">Target</Label>
          <div className="flex items-center gap-1.5">
            <Input autoFocus={autoFocus} value={value.target} onChange={(e) => set({ target: e.target.value })} placeholder="Kestrel, Blackwood Pass, Magic" className="min-w-0 flex-1" />
            <Popover
              title="Link a Seven entry"
              side="bottom"
              align="end"
              className="w-[min(24rem,90vw)] p-2.5"
              triggerClassName="inline-flex h-9 items-center gap-1.5 border border-line/60 tone-well-50 px-2.5 font-label text-[11px] caps-5 text-secondary hover:border-secondary hover:text-ink"
              trigger={
                <>
                  <Link2 className="h-3.5 w-3.5" />
                  {parsedRef ? 'Relink' : 'Link'}
                </>
              }
            >
              {(close) => <BrowseList options={options} value={value.ref ?? null} onPick={(v) => pickLink(v, close)} />}
            </Popover>
          </div>
          {value.ref && (
            <button type="button" onClick={() => set({ ref: null })} title="Unlink (keep the name)" className="inline-flex w-fit items-center gap-1 border border-line/50 px-2 py-0.5 font-ui text-[10.5px] text-secondary hover:border-alert/60 hover:text-alert">
              <Unlink className="h-3 w-3" />
              {linkTagOf(value.ref)}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Category</Label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_UIS.map(({ id, label, Icon, chipClass }) => (
              <button key={id} type="button" onClick={() => set({ category: id })} className={cn('flex items-center gap-1.5 border px-2 py-1 font-label text-[10.5px] caps-5 transition-colors', value.category === id ? chipClass : 'border-line/50 text-dim hover:border-line hover:text-ink')}>
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Stance</Label>
          <div className="flex flex-wrap gap-1.5">
            {STANCE_UIS.map(({ id, label, badgeClass }) => (
              <button
                key={id}
                type="button"
                onClick={() => set({ stance: id, affinity: typeof value.affinity === 'number' ? stanceMeta(id).defaultAffinity : value.affinity })}
                className={cn('border px-2 py-1 font-label text-[10.5px] caps-5 transition-colors', value.stance === id ? badgeClass : 'border-line/50 text-dim hover:border-line hover:text-ink')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(13rem,1.15fr)] lg:grid-cols-1 xl:grid-cols-[minmax(0,0.85fr)_minmax(14rem,1.15fr)]">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label>Bond / role</Label>
            <Input value={value.role} onChange={(e) => set({ role: e.target.value })} placeholder="Mentor, Sanctuary, Sworn oath" />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label title="-100 to +100">Affinity</Label>
            {typeof value.affinity === 'number' ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="min-w-[10rem] flex-1">
                  <SliderNumber value={value.affinity} min={-100} max={100} step={5} onChange={(n) => set({ affinity: cleanAffinity(n) })} />
                </div>
                <Button size="sm" variant="ghost" className="shrink-0" onClick={() => set({ affinity: null })}>
                  Clear
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => set({ affinity: stanceMeta(value.stance).defaultAffinity })}>
                Track a score
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label title="Extra words that make recall bring this up">Tags</Label>
          <TagInput value={value.tags ?? []} onChange={(tags) => set({ tags })} />
        </div>

        <Toggle checked={value.pinned === true} onChange={(pinned) => set({ pinned: pinned || undefined })} label="Pinned to the prompt" />
      </div>

      <div className="flex min-h-[16rem] min-w-0 flex-col gap-3">
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          <Label title="What happened, why it matters, where they stand now">Notes</Label>
          <MarkdownEditor key={value.id} compact value={value.notes} onValue={(notes) => set({ notes })} placeholder="History, attitude, obligation…" className="min-h-0 flex-1" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label title="Kept out of summaries unless looked up">Secret</Label>
          <LinkTextarea rolls={false} rows={3} value={value.secret ?? ''} onValue={(secret) => set({ secret })} placeholder="Hidden motive, unspoken truth…" />
        </div>
      </div>
    </div>
  )
}

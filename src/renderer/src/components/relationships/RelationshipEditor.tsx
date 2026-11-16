import { useMemo, useState } from 'react'
import { Link2, Unlink } from 'lucide-react'
import {
  categoryForKind,
  cleanAffinity,
  cleanRelationship,
  linkTagOf,
  newRelationshipId,
  parseLinkRef,
  stanceMeta,
  type RelationCategory,
  type RelationStance,
  type RelationshipEntry
} from '@shared/relationships'
import { pageKindOf } from '@shared/types'
import { showName } from '@shared/ids'
import { Button, Field, Fold, Input, Modal, Popover, SliderNumber, TagInput, Toggle } from '../ui'
import { BrowseList, type BrowseOption } from '../ui/BrowsePick'
import { LinkTextarea } from '../data/LinkTextarea'
import { cn } from '../../lib/cn'
import { useKindInfos } from '../../lib/kinds'
import { useAgents } from '../../store/agents'
import { useData } from '../../store/data'
import { CATEGORY_UIS, STANCE_UIS } from './styles'

function makeBlank(category: RelationCategory = 'person'): RelationshipEntry {
  return {
    id: newRelationshipId(),
    target: '',
    category,
    role: '',
    stance: 'neutral',
    notes: '',
    updatedAt: Date.now()
  }
}

export function RelationshipEditor({
  open,
  initial,
  onSave,
  onClose
}: {
  open: boolean
  initial: RelationshipEntry | null
  onSave: (entry: RelationshipEntry) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<RelationshipEntry>(() => initial ?? makeBlank())
  const pages = useData((s) => s.pages)
  const assets = useData((s) => s.assets)
  const agents = useAgents((s) => s.list)
  const kinds = useKindInfos()

  const kindLabels = useMemo(() => new Map(kinds.map((k) => [k.kind, k.label])), [kinds])
  const entryOptions = useMemo<BrowseOption[]>(() => {
    const out: BrowseOption[] = []
    for (const a of agents) {
      out.push({ value: `agent/${a.id}`, label: a.name, group: kindLabels.get('agent') ?? 'Agents', note: a.description || undefined })
    }
    for (const p of pages) {
      const kind = pageKindOf(p.type)
      out.push({ value: `${kind}/${p.id}`, label: showName(p.title), group: kindLabels.get(kind) ?? kind })
    }
    for (const f of assets) {
      out.push({ value: `file/${f.id}`, label: f.name, group: kindLabels.get('file') ?? 'Files', note: f.kind })
    }
    return out
  }, [agents, pages, assets, kindLabels])

  const parsedRef = draft.ref ? parseLinkRef(draft.ref) : null
  const valid = Boolean(draft.target.trim())

  const pickLink = (value: string, close: () => void) => {
    const picked = entryOptions.find((o) => o.value === value)
    const parsed = parseLinkRef(value)
    setDraft((prev) => ({
      ...prev,
      ref: value,
      target: prev.target.trim() && prev.target !== (parsedRef ? showName(parsedRef.id) : '') ? prev.target : (picked?.label ?? showName(parsed?.id ?? value)),
      category: parsed ? categoryForKind(parsed.kind) : prev.category
    }))
    close()
  }

  const commit = () => {
    const cleaned = cleanRelationship({ ...draft, updatedAt: Date.now() })
    if (!cleaned) return
    onSave(cleaned)
    onClose()
  }

  return (
    <Modal
      open={open}
      wide
      title={initial ? `Edit · ${initial.target}` : 'Add relationship'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} onClick={commit}>
            {initial ? 'Save changes' : 'Add relationship'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Target" hint="Enter any character, place, object, faction, or abstract concept — or link a Seven entry.">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              autoFocus
              value={draft.target}
              onChange={(e) => setDraft((prev) => ({ ...prev, target: e.target.value }))}
              placeholder="e.g. Kestrel, Blackwood Pass, The Obsidian Key, Magic"
              className="min-w-[14rem] flex-1"
            />
            <Popover
              title="Link a Seven entry"
              side="bottom"
              align="end"
              className="w-[min(24rem,90vw)] p-2.5"
              triggerClassName="inline-flex h-9 items-center gap-1.5 border border-line/60 bg-black/50 px-3 font-mono text-[11px] uppercase tracking-wider text-teal hover:border-teal hover:text-white"
              trigger={
                <>
                  <Link2 className="h-3.5 w-3.5" />
                  {parsedRef ? 'Change link' : 'Link entry'}
                </>
              }
            >
              {(close) => <BrowseList options={entryOptions} value={draft.ref ?? null} onPick={(v) => pickLink(v, close)} />}
            </Popover>
            {draft.ref && (
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, ref: null }))}
                title="Remove Seven entry link (keep text label)"
                className="inline-flex h-9 items-center gap-1 border border-line/50 px-2.5 font-mono text-[10.5px] text-dim hover:border-alert/60 hover:text-alert"
              >
                <Unlink className="h-3 w-3" />
                {linkTagOf(draft.ref)}
              </button>
            )}
          </div>
        </Field>

        <Field label="Category" group>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_UIS.map(({ id, label, Icon, chipClass }) => {
              const on = draft.category === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, category: id }))}
                  className={cn(
                    'flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors',
                    on ? chipClass : 'border-line/50 text-dim hover:border-line hover:text-white'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Stance" group>
          <div className="flex flex-wrap gap-1.5">
            {STANCE_UIS.map(({ id, label, badgeClass }) => {
              const on = draft.stance === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      stance: id as RelationStance,
                      affinity: prev.affinity === undefined || prev.affinity === null ? undefined : stanceMeta(id).defaultAffinity
                    }))
                  }
                  className={cn(
                    'border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors',
                    on ? badgeClass : 'border-line/50 text-dim hover:border-line hover:text-white'
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Bond / Role" hint="e.g. Mentor, Sanctuary, Stolen blade, Sworn oath">
            <Input
              value={draft.role}
              onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value }))}
              placeholder="Short bond label"
            />
          </Field>

          <Field label="Affinity score (-100 to +100)" group>
            <div className="flex items-center gap-2">
              {typeof draft.affinity === 'number' ? (
                <>
                  <div className="min-w-0 flex-1">
                    <SliderNumber
                      value={draft.affinity}
                      min={-100}
                      max={100}
                      step={5}
                      onChange={(n) => setDraft((prev) => ({ ...prev, affinity: cleanAffinity(n) }))}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDraft((prev) => ({ ...prev, affinity: null }))}
                  >
                    Clear
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDraft((prev) => ({ ...prev, affinity: stanceMeta(prev.stance).defaultAffinity }))}
                >
                  Track numeric score ({stanceMeta(draft.stance).defaultAffinity >= 0 ? `+${stanceMeta(draft.stance).defaultAffinity}` : stanceMeta(draft.stance).defaultAffinity})
                </Button>
              )}
            </div>
          </Field>
        </div>

        <Field label="Notes" hint="What happened, why this bond matters, or current standing.">
          <LinkTextarea
            rolls={false}
            rows={3}
            value={draft.notes}
            onValue={(notes) => setDraft((prev) => ({ ...prev, notes }))}
            placeholder="Concise history, attitude, or obligation..."
          />
        </Field>

        <Fold label="Secret, tags & prompt pinning" defaultOpen={Boolean(draft.secret || draft.tags?.length || draft.pinned)}>
          <div className="flex flex-col gap-3 pt-1">
            <Toggle
              checked={draft.pinned === true}
              onChange={(pinned) => setDraft((prev) => ({ ...prev, pinned }))}
              label="Pin to default system prompt (always shown instead of recalled on demand)"
            />
            <Field label="Tags" hint="Extra keywords to help auto-recall surface this relationship.">
              <TagInput value={draft.tags ?? []} onChange={(tags) => setDraft((prev) => ({ ...prev, tags }))} />
            </Field>
            <Field label="Secret / hidden truth" hint="Kept out of summaries unless explicitly inspected.">
              <LinkTextarea
                rolls={false}
                rows={2}
                value={draft.secret ?? ''}
                onValue={(secret) => setDraft((prev) => ({ ...prev, secret }))}
                placeholder="Hidden motive, double-cross, or unspoken truth..."
              />
            </Field>
          </div>
        </Fold>
      </div>
    </Modal>
  )
}

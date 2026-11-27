import { Fragment, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { ABILITY_TEMPLATES, BUFF_TEMPLATES, CLASS_TEMPLATES, ITEM_TEMPLATES, TRAIT_TEMPLATES } from '@shared/game/defs'
import { SIGNAL_PAYLOAD_FIELDS, type ConditionDef } from '@shared/game/core'
import type { ParamSpec } from '@shared/game/core/params'
import { CONDITION_KINDS, explainOne } from '@shared/game/rules/conditions'
import { Button, Popover } from '../../ui'
import { BrowseList, type BrowseOption } from '../../ui/BrowsePick'
import { EffectTokenButton } from '../effects/EffectTokenButton'
import { useGameDefs } from '../useGameDefs'
import { useKnownGameTags } from '../useGameSuggestions'
import { registerParamEditor, type ParamEditorProps } from './registry'

const DEFAULTS: Record<string, ConditionDef> = {
  level: { type: 'level', min: 1 },
  class: { type: 'class', id: '', minLevel: 1, activeOnly: true },
  tag: { type: 'tag', tag: '' },
  trait: { type: 'trait', id: '', activeOnly: true },
  healthPct: { type: 'healthPct', max: 50 },
  stat: { type: 'stat', stat: '', min: 10 },
  hasBuff: { type: 'hasBuff', id: '', tag: '' },
  hasItem: { type: 'hasItem', id: '', tag: '', equipped: false },
  storyFlag: { type: 'storyFlag', key: '', value: '' },
  is: { type: 'is', field: '', value: '' },
  chance: { type: 'chance', percent: 50 },
  all: { type: 'all', conditions: [] },
  any: { type: 'any', conditions: [] },
  not: { type: 'not', condition: { type: 'level', min: 1 } }
}

const KIND_SPEC: ParamSpec = {
  kind: 'choice',
  choices: CONDITION_KINDS.map((k) => k.kind),
  labels: Object.fromEntries(CONDITION_KINDS.map((k) => [k.kind, k.label])),
  default: 'level',
  description: 'Condition type.'
}

function BrowseToken({
  value,
  emptyLabel,
  title,
  options,
  allowCustom = false,
  onChange
}: {
  value: string
  emptyLabel: string
  title: string
  options: BrowseOption[]
  allowCustom?: boolean
  onChange: (next: string) => void
}) {
  const chosen = options.find((o) => o.value === value)
  const display = chosen?.label ?? (value || emptyLabel)
  return (
    <Popover
      align="start"
      title={title}
      rootClassName="mx-0.5 inline-flex align-middle"
      className="notch-sm w-[min(26rem,94vw)] gap-3 p-3"
      triggerClassName={
        value
          ? 'inline-flex h-[26px] items-center gap-1.5 border border-[color-mix(in_srgb,var(--tone)_45%,transparent)] bg-[color-mix(in_srgb,var(--tone)_10%,transparent)] px-2 font-ui text-[13px] font-semibold text-ink hover:border-[var(--tone)]'
          : 'inline-flex h-[26px] items-center gap-1.5 border border-dashed border-line px-2 font-ui text-[13px] text-dim hover:border-dim hover:text-ink'
      }
      trigger={display}
    >
      {(close) => (
        <BrowseList
          options={options}
          value={value}
          allowCustom={allowCustom}
          placeholder={allowCustom ? 'Filter or type custom…' : 'Filter'}
          onPick={(next) => {
            onChange(next)
            close()
          }}
        />
      )}
    </Popover>
  )
}

function Token({ name, spec, value, onChange }: { name: string; spec: ParamSpec; value: unknown; onChange: (v: unknown) => void }) {
  return <EffectTokenButton name={name} spec={spec} value={value} onChange={onChange} />
}

const toOptions = (list: { id: string; name: string; notes?: string }[] | null | undefined, group: string): BrowseOption[] =>
  (list ?? []).map((d) => ({ value: d.id, label: d.name, group, note: d.notes || undefined }))

type SentenceBuilder = (cond: ConditionDef, patch: (next: ConditionDef) => void) => ReactNode

function ConditionSentence({ cond, onChange }: { cond: ConditionDef; onChange: (next: ConditionDef) => void }) {
  const classes = useGameDefs(CLASS_TEMPLATES).list
  const buffs = useGameDefs(BUFF_TEMPLATES).list
  const abilities = useGameDefs(ABILITY_TEMPLATES).list
  const items = useGameDefs(ITEM_TEMPLATES).list
  const traits = useGameDefs(TRAIT_TEMPLATES).list
  const damageTypes = useGameDefs('damage_type').list
  const knownTags = useKnownGameTags()

  const valueOptionsForField = (field: string): BrowseOption[] => {
    const map: Record<string, () => BrowseOption[]> = {
      type: () => toOptions(damageTypes, 'Damage types'),
      damageType: () => toOptions(damageTypes, 'Damage types'),
      buff: () => toOptions(buffs, 'Buffs'),
      item: () => toOptions(items, 'Items'),
      classId: () => toOptions(classes, 'Classes'),
      trait: () => toOptions(traits, 'Traits'),
      tag: () => knownTags.map((t) => ({ value: t, label: t, group: 'Tags' })),
      cause: () => [...toOptions(abilities, 'Abilities'), ...toOptions(buffs, 'Buffs'), ...toOptions(items, 'Items')]
    }
    return map[field]?.() ?? []
  }

  const builders: Record<string, SentenceBuilder> = {
    level: (c, patch) => (
      <>
        <Token
          name="class"
          spec={{ kind: 'template', templateKind: CLASS_TEMPLATES, default: '', description: 'Leave empty for character level, or pick a class.' }}
          value={c.class ?? ''}
          onChange={(v) => patch({ ...c, class: v || undefined })}
        />
        <span>level at least</span>
        <Token
          name="min"
          spec={{ kind: 'number', default: 1, min: 1, description: 'Minimum level required.' }}
          value={c.min ?? ''}
          onChange={(v) => patch({ ...c, min: typeof v === 'number' ? v : undefined })}
        />
        <span>and at most</span>
        <Token
          name="max"
          spec={{ kind: 'number', default: '', min: 1, description: 'Optional maximum level.' }}
          value={c.max ?? ''}
          onChange={(v) => patch({ ...c, max: typeof v === 'number' && v > 0 ? v : undefined })}
        />
      </>
    ),
    class: (c, patch) => (
      <>
        <span>has class</span>
        <Token
          name="id"
          spec={{ kind: 'template', templateKind: CLASS_TEMPLATES, default: '', description: 'Required class or specialization.' }}
          value={c.id ?? ''}
          onChange={(v) => patch({ ...c, id: String(v ?? '') })}
        />
        <span>at level</span>
        <Token
          name="minLevel"
          spec={{ kind: 'number', default: 1, min: 1, description: 'Minimum level in that class.' }}
          value={c.minLevel ?? 1}
          onChange={(v) => patch({ ...c, minLevel: Number(v || 1) })}
        />
        <span>active only</span>
        <Token
          name="activeOnly"
          spec={{ kind: 'flag', default: true, description: 'Must not currently be restricted.' }}
          value={Boolean(c.activeOnly)}
          onChange={(v) => patch({ ...c, activeOnly: Boolean(v) })}
        />
      </>
    ),
    tag: (c, patch) => (
      <>
        <span>has tag</span>
        <Token
          name="tag"
          spec={{ kind: 'gameTag', default: '', description: 'Tag on entity, active class, active trait, or buff.' }}
          value={c.tag ?? ''}
          onChange={(v) => patch({ ...c, tag: String(v ?? '') })}
        />
      </>
    ),
    trait: (c, patch) => (
      <>
        <span>has trait</span>
        <Token
          name="id"
          spec={{ kind: 'template', templateKind: TRAIT_TEMPLATES, default: '', description: 'Required trait.' }}
          value={c.id ?? ''}
          onChange={(v) => patch({ ...c, id: String(v ?? '') })}
        />
        <span>active only</span>
        <Token
          name="activeOnly"
          spec={{ kind: 'flag', default: true, description: 'Require the trait to currently be active.' }}
          value={c.activeOnly !== false}
          onChange={(v) => patch({ ...c, activeOnly: Boolean(v) })}
        />
      </>
    ),
    healthPct: (c, patch) => (
      <>
        <span>between</span>
        <Token
          name="min"
          spec={{ kind: 'number', default: 0, min: 0, max: 100, description: 'Minimum health percentage.' }}
          value={c.min ?? ''}
          onChange={(v) => patch({ ...c, min: typeof v === 'number' ? v : undefined })}
        />
        <span>% and</span>
        <Token
          name="max"
          spec={{ kind: 'number', default: 50, min: 0, max: 100, description: 'Maximum health percentage.' }}
          value={c.max ?? ''}
          onChange={(v) => patch({ ...c, max: typeof v === 'number' ? v : undefined })}
        />
        <span>%</span>
      </>
    ),
    stat: (c, patch) => (
      <>
        <span>stat</span>
        <Token
          name="stat"
          spec={{ kind: 'template', templateKind: 'stat', default: '', description: 'Stat to compare.' }}
          value={c.stat ?? ''}
          onChange={(v) => patch({ ...c, stat: String(v ?? '') })}
        />
        <span>at least</span>
        <Token
          name="min"
          spec={{ kind: 'number', default: 10, description: 'Minimum stat value.' }}
          value={c.min ?? ''}
          onChange={(v) => patch({ ...c, min: typeof v === 'number' ? v : undefined })}
        />
        <span>at most</span>
        <Token
          name="max"
          spec={{ kind: 'number', default: '', description: 'Optional maximum stat value.' }}
          value={c.max ?? ''}
          onChange={(v) => patch({ ...c, max: typeof v === 'number' ? v : undefined })}
        />
      </>
    ),
    hasBuff: (c, patch) => (
      <>
        <span>buff</span>
        <Token
          name="id"
          spec={{ kind: 'template', templateKind: BUFF_TEMPLATES, default: '', description: 'Specific buff template.' }}
          value={c.id ?? ''}
          onChange={(v) => patch({ ...c, id: String(v ?? '') })}
        />
        <span>or tag</span>
        <Token
          name="tag"
          spec={{ kind: 'gameTag', default: '', description: 'Any buff carrying this tag.' }}
          value={c.tag ?? ''}
          onChange={(v) => patch({ ...c, tag: String(v ?? '') })}
        />
      </>
    ),
    hasItem: (c, patch) => (
      <>
        <span>item</span>
        <Token
          name="id"
          spec={{ kind: 'template', templateKind: ITEM_TEMPLATES, default: '', description: 'Item template.' }}
          value={c.id ?? ''}
          onChange={(v) => patch({ ...c, id: String(v ?? '') })}
        />
        <span>or tag</span>
        <Token
          name="tag"
          spec={{ kind: 'gameTag', default: '', description: 'Any item carrying this tag.' }}
          value={c.tag ?? ''}
          onChange={(v) => patch({ ...c, tag: String(v ?? '') })}
        />
        <span>equipped only</span>
        <Token
          name="equipped"
          spec={{ kind: 'flag', default: false, description: 'Require item to be equipped.' }}
          value={Boolean(c.equipped)}
          onChange={(v) => patch({ ...c, equipped: Boolean(v) })}
        />
      </>
    ),
    storyFlag: (c, patch) => (
      <>
        <span>flag</span>
        <Token
          name="key"
          spec={{ kind: 'storyFlag', default: '', description: 'Story or world flag key.' }}
          value={c.key ?? ''}
          onChange={(v) => patch({ ...c, key: String(v ?? '') })}
        />
        <span>equals</span>
        <Token
          name="value"
          spec={{ kind: 'text', default: '', description: 'Optional expected value (blank checks truthiness).' }}
          value={c.value ?? ''}
          onChange={(v) => patch({ ...c, value: String(v ?? '') || undefined })}
        />
      </>
    ),
    is: (c, patch) => {
      const field = String(c.field || '')
      const valOpts = valueOptionsForField(field)
      const valStr = c.value !== undefined ? String(c.value) : ''
      return (
        <>
          <span>field</span>
          <BrowseToken
            value={field}
            emptyLabel="field"
            title="Signal payload field"
            allowCustom
            options={SIGNAL_PAYLOAD_FIELDS.map((f) => ({ value: f.id, label: f.label, group: f.group, note: f.note }))}
            onChange={(next) => patch({ ...c, field: next })}
          />
          <span>==</span>
          {valOpts.length > 0 ? (
            <BrowseToken
              value={valStr}
              emptyLabel="value"
              title="Expected field value"
              allowCustom
              options={valOpts}
              onChange={(next) => patch({ ...c, value: next })}
            />
          ) : (
            <Token
              name="value"
              spec={{ kind: 'text', default: '', description: 'Expected value.' }}
              value={valStr}
              onChange={(v) => patch({ ...c, value: String(v ?? '') })}
            />
          )}
        </>
      )
    },
    chance: (c, patch) => (
      <>
        <Token
          name="percent"
          spec={{ kind: 'number', default: 50, min: 0, max: 100, description: 'Percent chance (0–100).' }}
          value={c.percent ?? 50}
          onChange={(v) => patch({ ...c, percent: Number(v ?? 50) })}
        />
        <span>%</span>
      </>
    ),
    all: () => <span>of the following must match:</span>,
    any: () => <span>of the following may match:</span>,
    not: () => <span>the following must not match:</span>
  }

  const render = builders[cond.type]
  return <Fragment>{render ? render(cond, onChange) : null}</Fragment>
}

export function ConditionsListEditor({
  value,
  onChange,
  single = false
}: {
  value: ConditionDef[]
  onChange: (next: ConditionDef[]) => void
  single?: boolean
}) {
  const list = Array.isArray(value) ? value : []
  return (
    <div className="flex flex-col gap-1.5 [--tone:var(--color-accent)]">
      {list.map((cond, i) => {
        const nested = cond.type === 'all' || cond.type === 'any' || cond.type === 'not'
        return (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="notch-sm group flex items-start gap-2 border border-l-[3px] border-card-hover border-l-accent/80 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--color-accent)_7%,var(--color-card)),var(--color-card)_60%)] px-2.5 py-1.5 text-[14px] leading-[28px] text-ink/90 hover:border-ink/15">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-1">
                <EffectTokenButton
                  name="type"
                  spec={KIND_SPEC}
                  value={cond.type}
                  onChange={(kind) => {
                    const k = String(kind)
                    onChange(list.map((c, j) => (j === i ? { ...(DEFAULTS[k] ?? { type: k }) } : c)))
                  }}
                />
                <ConditionSentence cond={cond} onChange={(next) => onChange(list.map((c, j) => (j === i ? next : c)))} />
              </div>
              {(!single || list.length > 1) && (
                <button
                  type="button"
                  title="Remove condition"
                  onClick={() => onChange(list.filter((_, j) => j !== i))}
                  className="mt-0.5 grid h-[26px] w-[26px] shrink-0 place-items-center text-faint opacity-60 hover:text-alert group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {nested && (
              <div className="ml-4 border-l border-accent/35 pl-2.5">
                {cond.type === 'not' ? (
                  <ConditionsListEditor
                    value={cond.condition ? [cond.condition as ConditionDef] : []}
                    single
                    onChange={(next) =>
                      onChange(list.map((c, j) => (j === i ? { ...c, condition: next[0] ?? { type: 'level', min: 1 } } : c)))
                    }
                  />
                ) : (
                  <ConditionsListEditor
                    value={Array.isArray(cond.conditions) ? (cond.conditions as ConditionDef[]) : []}
                    onChange={(next) => onChange(list.map((c, j) => (j === i ? { ...c, conditions: next } : c)))}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
      {(!single || list.length === 0) && (
        <Button size="sm" variant="ghost" icon={<Plus />} className="self-start" onClick={() => onChange([...list, { ...DEFAULTS.level }])} title="Add condition">
          Add condition
        </Button>
      )}
    </div>
  )
}

export function ConditionsSummary({ value }: { value: ConditionDef[] }) {
  if (!value.length) return null
  return <span className="font-ui text-[11px] text-dim">{value.map(explainOne).join(' · ')}</span>
}

function ConditionsParam({ value, onChange }: ParamEditorProps) {
  const list = Array.isArray(value) ? (value as ConditionDef[]) : []
  return <ConditionsListEditor value={list} onChange={(next) => onChange(next)} />
}

registerParamEditor('conditions', { Editor: ConditionsParam, wide: true })

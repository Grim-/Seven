import { useState, useMemo } from 'react'
import type { DefType, GameDef } from '@shared/game/defs/defs'
import type { ParamSchema } from '@shared/game/core/params'
import { Field, Input, Textarea } from '../ui'
import { ParamFields } from './ParamFields'
import { paramEditor } from './params'
import { Zap, Clock, Coins, Package, Layers, Sparkles, BookOpen, Shield } from 'lucide-react'

export function GameDefEditor({
  type,
  def,
  made,
  onChange
}: {
  type: DefType
  def: GameDef
  made: boolean
  onChange: (next: GameDef) => void
}) {
  const [showNotes, setShowNotes] = useState(Boolean(def.notes))

  // Separate non-component params from pieces
  const { piecesSchema, propertySchemas } = useMemo(() => {
    const all = type.params
    const piecesKey = 'comps' in all ? 'comps' : 'components' in all ? 'components' : null
    const pieces = piecesKey ? { [piecesKey]: all[piecesKey] } : {}

    if (type.type === 'game_ability') {
      const timingKeys = ['action', 'cooldown', 'range', 'weaponRange']
      const costKeys = ['cost', 'itemCost', 'uses']
      const timing: ParamSchema = {}
      const costs: ParamSchema = {}
      const others: ParamSchema = {}

      for (const [k, v] of Object.entries(all)) {
        if (k === piecesKey) continue
        if (timingKeys.includes(k)) timing[k] = v
        else if (costKeys.includes(k)) costs[k] = v
        else others[k] = v
      }

      return {
        piecesSchema: pieces,
        propertySchemas: [
          {
            title: 'Action Economy & Reach',
            icon: Clock,
            schema: timing,
            description: 'Turn action speed, cooldown in seconds, and targeting range or weapon reach.'
          },
          {
            title: 'Activation Costs & Consumables',
            icon: Zap,
            schema: costs,
            description: 'Resource pools spent (Mana, Stamina), item charges, and inventory consumables.'
          },
          ...(Object.keys(others).length > 0
            ? [{ title: 'Additional Properties', icon: Layers, schema: others, description: '' }]
            : [])
        ]
      }
    }

    if (type.type === 'game_item') {
      const specKeys = ['value', 'weight', 'maxStack']
      const behaviorKeys = ['grantsWhen', 'usedUp']
      const specs: ParamSchema = {}
      const behavior: ParamSchema = {}
      const others: ParamSchema = {}

      for (const [k, v] of Object.entries(all)) {
        if (k === piecesKey) continue
        if (specKeys.includes(k)) specs[k] = v
        else if (behaviorKeys.includes(k)) behavior[k] = v
        else others[k] = v
      }

      return {
        piecesSchema: pieces,
        propertySchemas: [
          {
            title: 'Physical Specifications & Commerce',
            icon: Coins,
            schema: specs,
            description: 'Gold valuation, carrying weight in pounds, and inventory stack limit.'
          },
          {
            title: 'Item Behavior & Availability',
            icon: Package,
            schema: behavior,
            description: 'Whether it is consumed on use, and whether abilities inside work while carried or worn.'
          },
          ...(Object.keys(others).length > 0
            ? [{ title: 'Additional Properties', icon: Layers, schema: others, description: '' }]
            : [])
        ]
      }
    }

    if (type.type === 'game_buff') {
      const buffKeys = ['duration', 'maxStacks', 'potency']
      const buffParams: ParamSchema = {}
      const others: ParamSchema = {}

      for (const [k, v] of Object.entries(all)) {
        if (k === piecesKey) continue
        if (buffKeys.includes(k)) buffParams[k] = v
        else others[k] = v
      }

      return {
        piecesSchema: pieces,
        propertySchemas: [
          {
            title: 'Duration & Stacking Rules',
            icon: Sparkles,
            schema: buffParams,
            description: 'How long the condition lasts in seconds, maximum active stacks, and baseline potency.'
          },
          ...(Object.keys(others).length > 0
            ? [{ title: 'Additional Properties', icon: Layers, schema: others, description: '' }]
            : [])
        ]
      }
    }

    // Generic fallback for any other definition types
    const others: ParamSchema = {}
    for (const [k, v] of Object.entries(all)) {
      if (k === piecesKey) continue
      others[k] = v
    }

    return {
      piecesSchema: pieces,
      propertySchemas:
        Object.keys(others).length > 0
          ? [{ title: 'Specifications & Attributes', icon: Layers, schema: others, description: '' }]
          : []
    }
  }, [type])

  const piecesKey = 'comps' in piecesSchema ? 'comps' : 'components' in piecesSchema ? 'components' : null
  const piecesSpec = piecesKey ? piecesSchema[piecesKey] : null
  const piecesEditor = piecesSpec ? paramEditor(piecesSpec.kind) : null

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Identity & Name Command Deck */}
      <div className="flex flex-col gap-3 border border-line bg-black/60 p-4">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
          <Field label="Name">
            <Input
              autoFocus={!def.name}
              value={def.name}
              onChange={(e) => onChange({ ...def, name: e.target.value })}
              placeholder={`Name of the ${type.label.toLowerCase()} (e.g. ${
                type.type === 'game_ability' ? 'Cure Wounds' : type.type === 'game_item' ? 'Shortsword' : 'Poisoned'
              })`}
              className="h-10 text-[14px] font-semibold"
            />
          </Field>
          <Field
            label="ID (Code Reference)"
            hint={
              made
                ? 'Stable identifier used in combat formulas, AI rules, and scripts.'
                : 'Generated from name. Rules, formulas and items use it.'
            }
          >
            <div className="flex items-center gap-1">
              <Input value={def.id} readOnly className="h-10 font-mono text-[12.5px] text-accent/80 bg-black" />
            </div>
          </Field>
        </div>

        {/* Notes & Lore Toggle */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-line/40">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-dim uppercase tracking-wider flex items-center gap-1">
              <BookOpen className="h-3 w-3 text-accent" /> Notes & Flavor Text
            </span>
            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="text-accent/80 hover:text-accent underline"
            >
              {showNotes ? 'Hide notes' : 'Add narrative notes'}
            </button>
          </div>
          {showNotes && (
            <Textarea
              value={def.notes}
              onChange={(e) => onChange({ ...def, notes: e.target.value })}
              placeholder="What this is for, narrative flavor text, lore, or tactical instructions for agents and players..."
              className="min-h-20 text-[12.5px]"
            />
          )}
        </div>
      </div>

      {/* 2. Structured Tactical / Property Panels (Top Half) */}
      {propertySchemas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {propertySchemas.map((section, idx) => {
            const Icon = section.icon
            return (
              <div key={idx} className="flex flex-col gap-3 border border-line bg-black/60 p-4">
                <div className="flex items-center gap-2 border-b border-line/40 pb-2">
                  <Icon className="h-4 w-4 text-accent shrink-0" />
                  <span className="font-semibold text-[12px] font-mono uppercase tracking-wider text-white">
                    {section.title}
                  </span>
                </div>
                {section.description && (
                  <span className="text-[11.5px] text-dim leading-snug -mt-1">{section.description}</span>
                )}
                <div className="pt-1">
                  <ParamFields
                    schema={section.schema}
                    values={def.values}
                    onChange={(values) => onChange({ ...def, values: { ...def.values, ...values } })}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 3. Dedicated Building Blocks / Pieces Canvas */}
      {piecesKey && piecesSpec && piecesEditor && (
        <div className="flex flex-col gap-3 border border-line bg-black/60 p-4">
          <div className="flex flex-col gap-1 border-b border-line/40 pb-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              <span className="font-semibold text-[13px] font-mono uppercase tracking-wider text-white">
                {piecesSpec.label ?? 'Pieces'} · Functional Building Blocks
              </span>
            </div>
            <span className="text-[12px] text-dim leading-snug">
              {piecesSpec.description ??
                'Active effects, weapon stats, passive armor, and AI utility triggers that snap together to create this entity.'}
            </span>
          </div>

          <div className="pt-1">
            <piecesEditor.Editor
              spec={piecesSpec}
              value={def.values[piecesKey]}
              onChange={(next) => onChange({ ...def, values: { ...def.values, [piecesKey]: next } })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

import { BUFF_TEMPLATES, CHARACTER_TEMPLATES, CLASS_TEMPLATES, ITEM_TEMPLATES, TRAIT_TEMPLATES, defTypes } from '@shared/game/defs'
import { toId } from '@shared/ids'
import { getSheet, sheetIds } from '../../engine/library/sheets'
import { ToolError, type ToolDef } from '../../engine/tools/types'
import { paramsSchema } from '../../engine/tools/effectSchema'
import { checkKeys, registerSchemaSource } from '../../engine/tools/schemaSources'
import { almanacs } from '../../engine/almanac/store'
import { worlds } from '../../engine/worlds/store'
import { noteFailure } from '../../engine/util/report'
import {
  applyCharacterBuff,
  awardCharacterXp,
  changeResource,
  equipCharacterItem,
  giveItem,
  inspectCharacterGame,
  joinCharacter,
  leaveCharacter,
  removeCharacterBuff,
  setCharacterClass,
  setCharacterTrait,
  takeItem,
  triggerStoryMoment,
  unequipCharacterSlot,
  useAbility,
  useCharacterItem
} from './characters'
import { gameDefs } from './store'
import { saves } from '../../engine/worlds/saves'
import { advanceWorldTime, longRest, shortRest } from '../../engine/worlds/time'

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

function journalForSheet(sheetRef: string, text: string): void {
  try {
    const s = getSheet(sheetRef)
    const save = s.save ? saves.read(s.save) : null
    if (save && worlds.exists(save.world)) {
      worlds.addJourney(save.world, s.id, 'action', text)
    }
  } catch (err) {
    noteFailure(err, 'worlds', 'Could not journal character milestone')
  }
}

function almanacRecordForSheet(sheetRef: string, title: string, summary: string, detail?: string): void {
  try {
    const s = getSheet(sheetRef)
    const save = s.save ? saves.read(s.save) : null
    if (!save?.almanacId) return
    const where = save.characters[s.id]?.where || s.story.where || ''
    almanacs.recordEntry(save.almanacId, {
      kind: 'milestone',
      title,
      summary,
      outcome: detail || summary,
      who: [`@sheet:${s.id}`],
      where
    })
  } catch (err) {
    noteFailure(err, 'almanac', 'Could not record story trigger to Almanac')
  }
}

function resolveSpeaker(ref: string): { sheet: string; name: string } {
  const clean = ref.replace(/^@?sheet:/i, '').trim()
  if (!clean) return { sheet: '', name: 'Character' }
  try {
    const s = getSheet(clean)
    return { sheet: s.id, name: s.title || s.id }
  } catch {
    const lower = clean.toLowerCase()
    for (const { id } of sheetIds()) {
      try {
        const s = getSheet(id)
        if (s.id.toLowerCase() === lower || s.title.toLowerCase() === lower) {
          return { sheet: s.id, name: s.title || s.id }
        }
      } catch {
        // Ignore unreadable sheet
      }
    }
    return { sheet: toId(clean), name: clean }
  }
}

async function promptPendingOffers(
  sheet: string,
  offers: Array<{ classId: string; label: string; prompt: string }>,
  ctx: Parameters<ToolDef['execute']>[1]
): Promise<string[]> {
  const accepted: string[] = []
  for (const offer of offers) {
    const ok = await ctx.ui.ask('confirm', {
      message: `${offer.prompt} (${offer.label})`,
      confirmLabel: 'Unlock Class',
      cancelLabel: 'Save for Later'
    })
    if (ok === true) {
      setCharacterClass(sheet, { action: 'accept_offer', classId: offer.classId, reason: 'clutch_confirm' })
      accepted.push(offer.label)
    }
  }
  return accepted
}

const GAME_DEF_SCOPE = 'game_def'

registerSchemaSource({
  id: GAME_DEF_SCOPE,
  entries: (on) =>
    on('game')
      ? defTypes().map((t) => ({ name: t.kind ?? t.type, summary: t.description, params: { type: 'object' as const, properties: { notes: { type: ['string', 'null'] }, values: paramsSchema(t.params) } } }))
      : []
})

export const gameTools: ToolDef[] = [
  {
    name: 'award_xp',
    group: 'game',
    needsWorkspace: false,
    description:
      'Award XP to a character (which automatically cascades the same XP to every class the character owns), or target one specific classId. Prompts the user if a clutch class unlock triggers.',
    params: {
      type: 'object',
      properties: {
        sheet: { type: 'string', description: 'Character sheet id or name' },
        amount: { type: 'number', description: 'Positive XP amount to award' },
        classId: { type: ['string', 'null'], description: 'Optional single class id to award XP to instead of whole character' },
        reason: { type: ['string', 'null'], description: 'Reason logged to the character Story Sheet' }
      },
      required: ['sheet', 'amount']
    },
    async execute(params, ctx) {
      const sheet = str(params.sheet)
      const amount = Math.round(num(params.amount, 0))
      const classId = str(params.classId) || undefined
      const reason = str(params.reason) || undefined
      const res = awardCharacterXp(sheet, { amount, classId, reason })
      journalForSheet(sheet, `Gained ${res.gained} XP${reason ? ` (${reason})` : ''}`)
      const accepted = await promptPendingOffers(sheet, res.offers, ctx)
      const extra = accepted.length ? ` Unlocked classes: ${accepted.join(', ')}.` : ''
      const pending = res.offers.length - accepted.length
      const pendingNote = pending > 0 ? ` ${pending} clutch class offer(s) waiting in the Classes panel.` : ''
      return `Awarded ${res.gained} XP (Level ${res.level}, ${res.xp} XP toward next; ${res.classUpdated} classes updated).${extra}${pendingNote}`
    }
  },
  {
    name: 'set_character_class',
    group: 'game',
    needsWorkspace: false,
    description:
      'Grant, permanently remove, set level on, or accept/dismiss a clutch unlock offer for a character class or specialization.',
    params: {
      type: 'object',
      properties: {
        sheet: { type: 'string', description: 'Character sheet id or name' },
        action: { enum: ['add', 'remove', 'level', 'accept_offer', 'dismiss_offer'], description: 'Operation to perform' },
        classId: { type: 'string', description: 'Class template id' },
        level: { type: ['number', 'null'], description: 'Optional initial/target level' },
        bypassConditions: { type: ['boolean', 'null'], description: 'Bypass unlock conditions (DM/override)' },
        reason: { type: ['string', 'null'], description: 'Optional reason logged to the Story Sheet' }
      },
      required: ['sheet', 'action', 'classId']
    },
    forAgent: () => {
      const ids = gameDefs.list(CLASS_TEMPLATES).map((d) => d.id)
      return {
        params: {
          type: 'object',
          properties: {
            sheet: { type: 'string', description: 'Character sheet id or name' },
            action: { enum: ['add', 'remove', 'level', 'accept_offer', 'dismiss_offer'], description: 'Operation to perform' },
            classId: ids.length ? { enum: ids, description: 'Class template id' } : { type: 'string', description: 'Class template id' },
            level: { type: ['number', 'null'], description: 'Optional initial/target level' },
            bypassConditions: { type: ['boolean', 'null'], description: 'Bypass unlock conditions (DM/override)' },
            reason: { type: ['string', 'null'], description: 'Optional reason logged to the Story Sheet' }
          },
          required: ['sheet', 'action', 'classId']
        }
      }
    },
    async execute(params) {
      const sheet = str(params.sheet)
      const res = setCharacterClass(sheet, {
        action: str(params.action) as 'add' | 'remove' | 'level' | 'accept_offer' | 'dismiss_offer',
        classId: str(params.classId),
        level: typeof params.level === 'number' ? params.level : undefined,
        bypassConditions: params.bypassConditions === true,
        reason: str(params.reason) || undefined
      })
      journalForSheet(sheet, res.message)
      return res.message
    }
  },
  {
    name: 'set_character_trait',
    group: 'game',
    needsWorkspace: false,
    description: 'Grant, remove, or reset cooldown/uses on an innate passive trait for a character.',
    params: {
      type: 'object',
      properties: {
        sheet: { type: 'string', description: 'Character sheet id or name' },
        action: { enum: ['add', 'remove', 'reset'], description: 'Operation to perform' },
        traitId: { type: 'string', description: 'Trait template id' },
        permanent: { type: ['boolean', 'null'], description: 'Keep this trait even if a granting class is lost' },
        reason: { type: ['string', 'null'], description: 'Optional reason logged to the Story Sheet' }
      },
      required: ['sheet', 'action', 'traitId']
    },
    forAgent: () => {
      const ids = gameDefs.list(TRAIT_TEMPLATES).map((d) => d.id)
      return {
        params: {
          type: 'object',
          properties: {
            sheet: { type: 'string', description: 'Character sheet id or name' },
            action: { enum: ['add', 'remove', 'reset'], description: 'Operation to perform' },
            traitId: ids.length ? { enum: ids, description: 'Trait template id' } : { type: 'string', description: 'Trait template id' },
            permanent: { type: ['boolean', 'null'], description: 'Keep this trait even if a granting class is lost' },
            reason: { type: ['string', 'null'], description: 'Optional reason logged to the Story Sheet' }
          },
          required: ['sheet', 'action', 'traitId']
        }
      }
    },
    async execute(params) {
      const sheet = str(params.sheet)
      const res = setCharacterTrait(sheet, {
        action: str(params.action) as 'add' | 'remove' | 'reset',
        traitId: str(params.traitId),
        permanent: params.permanent === true,
        reason: str(params.reason) || undefined
      })
      journalForSheet(sheet, res.message)
      return res.message
    }
  },
  {
    name: 'story_trigger',
    group: 'game',
    needsWorkspace: false,
    description:
      'Trigger a story moment signal on a character, log it to their Story Sheet, re-check class restrictions, and prompt any clutch class unlocks.',
    params: {
      type: 'object',
      properties: {
        sheet: { type: 'string', description: 'Character sheet id or name' },
        tag: { type: ['string', 'null'], description: 'Story flag/tag key for condition checks' },
        summary: { type: 'string', description: 'Short headline recorded to the character Story Sheet' },
        detail: { type: ['string', 'null'], description: 'Optional detailed description of the story moment' },
        flags: { type: ['object', 'null'], description: 'Optional story flag key-value map evaluated against conditions' }
      },
      required: ['sheet', 'summary']
    },
    async execute(params, ctx) {
      const sheet = str(params.sheet)
      const summary = str(params.summary)
      const detail = str(params.detail) || undefined
      const res = triggerStoryMoment(sheet, {
        tag: str(params.tag) || undefined,
        summary,
        detail,
        flags: params.flags && typeof params.flags === 'object' ? (params.flags as Record<string, unknown>) : undefined
      })
      almanacRecordForSheet(sheet, summary, summary, detail)
      const accepted = await promptPendingOffers(sheet, res.offers, ctx)
      const offerNote = res.offers.length
        ? ` Triggered ${res.offers.length} clutch unlock offer(s)${accepted.length ? ` (unlocked: ${accepted.join(', ')})` : ''}.`
        : ''
      return `Logged story moment (${res.logged} Story Sheet entry).${offerNote}`
    }
  },
  {
    name: 'character_speak',
    group: 'game',
    needsWorkspace: false,
    description: 'Have a character speak dialogue aloud in the current scene.',
    params: {
      type: 'object',
      properties: {
        world: { type: 'string', description: 'World id' },
        character: { type: 'string', description: 'Character sheet id or name' },
        dialogue: { type: 'string', description: 'Exact words the character speaks aloud' }
      },
      required: ['world', 'character', 'dialogue']
    },
    async execute(params, ctx) {
      const world = str(params.world)
      const dialogue = str(params.dialogue)
      if (!world) throw new ToolError('world is required')
      if (!dialogue) throw new ToolError('dialogue cannot be empty')
      const speaker = resolveSpeaker(str(params.character))
      ctx.viewEvents?.([{ kind: 'speak', data: { sheet: speaker.sheet, name: speaker.name, dialogue } }], speaker.name, world)
      return `${speaker.name}: "${dialogue}"`
    }
  },
  {
    name: 'advance_time',
    group: 'game',
    needsWorkspace: false,
    description: 'Move a world\'s game clock on when in-world time passes (travel, searching, waiting, sleeping).',
    params: {
      type: 'object',
      properties: {
        world: { type: 'string', description: 'World id' },
        minutes: { type: 'number', description: 'Minutes that pass' }
      },
      required: ['world', 'minutes']
    },
    async execute(params) {
      const minutes = Number(params.minutes)
      if (!(minutes > 0)) throw new ToolError('minutes must be more than 0')
      const save = saves.current(str(params.world))
      if (!save) throw new ToolError(`There is no save of ${str(params.world)}`)
      advanceWorldTime(save.id, minutes * 60, 'agent', Object.keys(save.characters))
      return `${minutes} min passed.`
    }
  },
  {
    name: 'short_rest',
    group: 'game',
    needsWorkspace: false,
    description: 'The party in a world takes a short rest (1 h). Characters may spend hit dice to heal.',
    params: {
      type: 'object',
      properties: {
        world: { type: 'string', description: 'World id' },
        hitDice: { type: 'object', additionalProperties: { type: 'number' }, description: 'Character sheet id to hit dice spent' }
      },
      required: ['world']
    },
    async execute(params) {
      const save = saves.current(str(params.world))
      if (!save) throw new ToolError(`There is no save of ${str(params.world)}`)
      const raw = params.hitDice && typeof params.hitDice === 'object' ? (params.hitDice as Record<string, unknown>) : {}
      const party = Object.keys(save.characters)
      shortRest(save.id, party, Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v) || 0])))
      for (const sheet of party) journalForSheet(sheet, 'Took a short rest')
      return 'Short rest taken.'
    }
  },
  {
    name: 'long_rest',
    group: 'game',
    needsWorkspace: false,
    description: 'The party in a world takes a long rest (8 h).',
    params: {
      type: 'object',
      properties: { world: { type: 'string', description: 'World id' } },
      required: ['world']
    },
    async execute(params) {
      const save = saves.current(str(params.world))
      if (!save) throw new ToolError(`There is no save of ${str(params.world)}`)
      const party = Object.keys(save.characters)
      longRest(save.id, party)
      for (const sheet of party) journalForSheet(sheet, 'Took a long rest')
      return 'Long rest taken.'
    }
  },
  {
    name: 'character_game_state',
    group: 'game',
    needsWorkspace: false,
    description: 'Inspect a character\'s full live Game RPG state: resources (HP/Mana/Stamina), stats, classes + pending offers, traits, inventory, equipped slots, active buffs, and usable abilities.',
    params: {
      type: 'object',
      properties: {
        sheet: { type: 'string', description: 'Character sheet id or name' }
      },
      required: ['sheet']
    },
    async execute(params) {
      return inspectCharacterGame(str(params.sheet))
    }
  },
  {
    name: 'character_game',
    group: 'game',
    needsWorkspace: false,
    description: 'Operate a character\'s live Game RPG components: join/leave the game, adjust Health/Mana/Stamina/resources, give/take/equip/unequip/use items, apply/remove buffs, or use abilities.',
    params: {
      type: 'object',
      properties: {
        sheet: { type: 'string', description: 'Character sheet id or name' },
        action: {
          enum: ['join', 'leave', 'resource', 'give_item', 'take_item', 'equip_item', 'unequip_slot', 'use_item', 'apply_buff', 'remove_buff', 'use_ability'],
          description: 'Runtime operation'
        },
        templateId: { type: ['string', 'null'], description: 'Character template id for join (defaults to first template)' },
        resourceId: { type: ['string', 'null'], description: 'Stat/resource id (e.g. health, mana, stamina)' },
        amount: { type: ['number', 'null'], description: 'Delta (e.g. -10 or +15) for resource, or stack count for items/buffs' },
        setValue: { type: ['number', 'null'], description: 'Exact target value for resource' },
        itemId: { type: ['string', 'null'], description: 'Game item template id or name' },
        gold: { type: ['number', 'null'], description: 'Gold delta for give_item' },
        slot: { type: ['string', 'null'], description: 'Equipment slot id (e.g. mainHand, chest, bag)' },
        buffId: { type: ['string', 'null'], description: 'Game buff template id for apply_buff/remove_buff' },
        abilityId: { type: ['string', 'null'], description: 'Ability id, uid, or name for use_ability' },
        target: { type: ['string', 'null'], description: 'Optional target character sheet id or name for use_item/use_ability' }
      },
      required: ['sheet', 'action']
    },
    forAgent: () => {
      const tpls = gameDefs.list(CHARACTER_TEMPLATES).map((d) => d.id)
      const items = gameDefs.list(ITEM_TEMPLATES).map((d) => d.id)
      const buffs = gameDefs.list(BUFF_TEMPLATES).map((d) => d.id)
      const resources = gameDefs.list('stat').filter((s) => (s as { group?: string }).group === 'resource').map((s) => s.id)
      return {
        params: {
          type: 'object',
          properties: {
            sheet: { type: 'string', description: 'Character sheet id or name' },
            action: {
              enum: ['join', 'leave', 'resource', 'give_item', 'take_item', 'equip_item', 'unequip_slot', 'use_item', 'apply_buff', 'remove_buff', 'use_ability'],
              description: 'Runtime operation'
            },
            templateId: tpls.length ? { enum: [...tpls, null], description: 'Character template id for join' } : { type: ['string', 'null'], description: 'Character template id for join' },
            resourceId: resources.length ? { enum: [...resources, null], description: 'Resource stat id' } : { type: ['string', 'null'], description: 'Stat/resource id' },
            amount: { type: ['number', 'null'], description: 'Delta for resource, or count for items' },
            setValue: { type: ['number', 'null'], description: 'Exact target value for resource' },
            itemId: items.length ? { enum: [...items, null], description: 'Item template id' } : { type: ['string', 'null'], description: 'Game item template id or name' },
            gold: { type: ['number', 'null'], description: 'Gold delta for give_item' },
            slot: { type: ['string', 'null'], description: 'Equipment slot id' },
            buffId: buffs.length ? { enum: [...buffs, null], description: 'Buff template id' } : { type: ['string', 'null'], description: 'Game buff template id' },
            abilityId: { type: ['string', 'null'], description: 'Ability id, uid, or name for use_ability' },
            target: { type: ['string', 'null'], description: 'Optional target character sheet id or name' }
          },
          required: ['sheet', 'action']
        }
      }
    },
    async execute(params) {
      const sheet = str(params.sheet)
      const action = str(params.action)
      const amount = typeof params.amount === 'number' && Number.isFinite(params.amount) ? params.amount : undefined
      const handlers: Record<string, () => string> = {
        join: () => {
          const tpl = str(params.templateId) || gameDefs.list(CHARACTER_TEMPLATES)[0]?.id || 'adventurer'
          joinCharacter(sheet, tpl)
          return `${sheet} joined the game using template "${tpl}".`
        },
        leave: () => {
          leaveCharacter(sheet)
          return `${sheet} left the game.`
        },
        resource: () => {
          const setVal = typeof params.setValue === 'number' && Number.isFinite(params.setValue) ? params.setValue : undefined
          if (amount === undefined && setVal === undefined) throw new ToolError('Give amount or setValue for resource.')
          const r = changeResource(sheet, { resourceId: str(params.resourceId) || 'health', delta: amount, setValue: setVal })
          return `${sheet} ${r.label}: ${Math.round(r.from)} -> ${Math.round(r.to)}/${Math.round(r.max)}.`
        },
        give_item: () => {
          const item = str(params.itemId)
          const gold = typeof params.gold === 'number' && Number.isFinite(params.gold) ? Math.round(params.gold) : 0
          if (!item && gold <= 0) throw new ToolError('Give itemId or positive gold for give_item.')
          const res = giveItem(sheet, item, Math.max(1, Math.round(amount ?? 1)), gold)
          return `Gave ${sheet}${res.given ? ` ${res.given}x ${item}` : ''}${res.gold ? ` ${res.gold} gold` : ''}.`
        },
        take_item: () => {
          const item = str(params.itemId)
          if (!item) throw new ToolError('Give itemId for take_item.')
          const taken = takeItem(sheet, item, Math.max(1, Math.round(amount ?? 1)))
          return `Took ${taken}x ${item} from ${sheet}.`
        },
        equip_item: () => {
          const item = str(params.itemId)
          if (!item) throw new ToolError('Give itemId for equip_item.')
          return equipCharacterItem(sheet, item, str(params.slot) || undefined)
        },
        unequip_slot: () => {
          const slot = str(params.slot)
          if (!slot) throw new ToolError('Give slot for unequip_slot.')
          return unequipCharacterSlot(sheet, slot)
        },
        use_item: () => {
          const item = str(params.itemId)
          if (!item) throw new ToolError('Give itemId for use_item.')
          const targetSheet = str(params.target) ? getSheet(str(params.target)).id : undefined
          return useCharacterItem(sheet, item, targetSheet)
        },
        apply_buff: () => {
          const buff = str(params.buffId)
          if (!buff) throw new ToolError('Give buffId for apply_buff.')
          return applyCharacterBuff(sheet, buff)
        },
        remove_buff: () => {
          const buff = str(params.buffId)
          if (!buff) throw new ToolError('Give buffId for remove_buff.')
          return removeCharacterBuff(sheet, buff)
        },
        use_ability: () => {
          const ability = str(params.abilityId)
          if (!ability) throw new ToolError('Give abilityId for use_ability.')
          const targetId = str(params.target) ? getSheet(str(params.target)).id : null
          return useAbility(sheet, ability, targetId ? { sheet: targetId } : null, null, null, 0)
        }
      }
      const fn = handlers[action]
      if (!fn) throw new ToolError(`Unknown action "${action}".`)
      return fn()
    }
  },
  {
    name: 'save_game_def',
    group: 'game',
    needsWorkspace: false,
    description: 'Create or update any shared Game definition: class, trait, buff, item, stat, damage_type, check, slot, formula, clock, or character/creature template.',
    params: {
      type: 'object',
      properties: {
        type: { enum: defTypes().map((d) => d.kind ?? d.type), description: 'Game definition kind' },
        id: { type: ['string', 'null'], description: 'Existing id or omitted to create from name' },
        name: { type: 'string', description: 'Display name' },
        data: { type: 'object', description: `fields: inspect_schema(${GAME_DEF_SCOPE}, <type>)` }
      },
      required: ['type', 'name']
    },
    async execute(params) {
      const defType = gameDefs.typeOf(str(params.type))
      const defKind = defType.type
      const shown = defType.kind ?? defType.type
      const name = str(params.name)
      const existing = str(params.id) ? gameDefs.find(defKind, str(params.id)) : gameDefs.find(defKind, name)
      const extra = params.data && typeof params.data === 'object' && !Array.isArray(params.data) ? (params.data as Record<string, unknown>) : {}
      checkKeys(GAME_DEF_SCOPE, shown, extra)
      if (extra.values && typeof extra.values === 'object' && !Array.isArray(extra.values)) checkKeys(GAME_DEF_SCOPE, shown, extra.values as Record<string, unknown>, [], ['values'])
      const payload = {
        ...(existing ?? {}),
        ...extra,
        id: existing?.id ?? (str(params.id) || toId(name)),
        name
      }
      const saved = gameDefs.save(defKind, payload, existing?.id ?? null)
      return `${existing ? 'Updated' : 'Created'} ${shown} "${saved.name}" (${saved.id}).`
    }
  }
]

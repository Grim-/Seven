import type { ToolDef } from '../../engine/tools/types'
import { awardCharacterXp, setCharacterClass, setCharacterTrait, triggerStoryMoment } from './characters'

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

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
    async execute(params) {
      const res = setCharacterClass(str(params.sheet), {
        action: str(params.action) as 'add' | 'remove' | 'level' | 'accept_offer' | 'dismiss_offer',
        classId: str(params.classId),
        level: typeof params.level === 'number' ? params.level : undefined,
        bypassConditions: params.bypassConditions === true,
        reason: str(params.reason) || undefined
      })
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
    async execute(params) {
      const res = setCharacterTrait(str(params.sheet), {
        action: str(params.action) as 'add' | 'remove' | 'reset',
        traitId: str(params.traitId),
        permanent: params.permanent === true,
        reason: str(params.reason) || undefined
      })
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
      const res = triggerStoryMoment(sheet, {
        tag: str(params.tag) || undefined,
        summary: str(params.summary),
        detail: str(params.detail) || undefined,
        flags: params.flags && typeof params.flags === 'object' ? (params.flags as Record<string, unknown>) : undefined
      })
      const accepted = await promptPendingOffers(sheet, res.offers, ctx)
      const offerNote = res.offers.length
        ? ` Triggered ${res.offers.length} clutch unlock offer(s)${accepted.length ? ` (unlocked: ${accepted.join(', ')})` : ''}.`
        : ''
      return `Logged story moment (${res.logged} Story Sheet entry).${offerNote}`
    }
  }
]

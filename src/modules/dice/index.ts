import type { ModuleFactory } from '../../engine/modules/sdk'
import type { ToolDef } from '../../engine/tools/types'
import { roll } from './dice'
import { presentationTool } from '../../engine/present/define'
import { actionResultText, cleanAction } from '@shared/actions'
import { rollFor } from '../../engine/actions'
import { journalAction } from '../../engine/worlds/journeys'
import { agentAccess } from '../../engine/agents/access'

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: ToolDef): void }): void {
      tools.add({
        name: 'roll',
        group: 'dice',
        needsWorkspace: false,
        command: true,
        maxRepeats: 20,
        activity: () => 'rolling dice',
        description: 'Roll dice for real. dice is like "1d20", "2d6+3", "4d6kh3" (keep highest), "2d20kl1" (keep lowest), "3d6!" (exploding), "d%". why is shown with the result.',
        params: {
          type: 'object',
          properties: {
            dice: { type: 'string' },
            why: { type: ['string', 'null'], description: 'What the roll is for' }
          }
        },
        execute: async (params) => {
          try {
            const r = roll(sdk.params.str(params, 'dice'))
            const why = sdk.params.optStr(params, 'why')
            return `${why ? `${why}: ` : ''}${r.expr} = ${r.total} (${r.detail})`
          } catch (err) {
            throw new sdk.ToolError(err instanceof Error ? err.message : String(err))
          }
        }
      })
      tools.add(actionCheck)
    }
  }

const CHECK = {
  type: 'object',
  properties: {
    against: { type: ['string', 'null'], description: 'A stat, save or skill on the D&D sheet, e.g. charisma, dexterity save, deception; null for plain chance' },
    difficulty: { type: ['number', 'null'], description: '0 easy to 1 hard; null is 0.5' },
    base: { type: ['number', 'null'], description: 'Base DC; null is 10' },
    pass: { type: ['string', 'null'], description: 'What happens if this check decides it and passes' },
    fail: { type: ['string', 'null'], description: 'What happens if this check decides it and fails' }
  }
} as const

const actionCheck = presentationTool({
  type: 'action',
  group: 'dice',
  fixed: true,
  description: 'Roll an action a character attempts, against their D&D sheet. Seven rolls every check and tells you the outcome to play out. For a choice between options, ask instead; never roll a choice.',
  fields: {
    attempt: { type: 'string', description: 'What is being attempted' },
    character: { type: ['string', 'null'], description: 'Whose sheet to check; null is the character you play' },
    needs: { enum: ['any', 'all'], description: 'any: the character tries one of the checks (say which with try); all: every check is rolled and must pass' },
    try: { type: ['integer', 'null'], description: 'With any: the number of the check the character tries, from 0; null is the first' },
    checks: { type: 'array', minItems: 1, maxItems: 6, items: CHECK },
    pass: { type: 'string', description: 'What happens on success' },
    fail: { type: 'string', description: 'What happens on failure' }
  },
  title: (f) => (typeof f.attempt === 'string' ? f.attempt : 'Action'),
  run: async (f, ctx) => {
    const character = typeof f.character === 'string' && f.character.trim() ? f.character : (agentAccess.get(ctx.agentId ?? '')?.sheet ?? null)
    const result = rollFor(cleanAction(f), character, typeof f.try === 'number' ? f.try : null)
    journalAction(agentAccess.get(ctx.agentId ?? '')?.world?.worldId ?? null, result)
    return { text: actionResultText(result), fields: { result } }
  }
})

export default factory

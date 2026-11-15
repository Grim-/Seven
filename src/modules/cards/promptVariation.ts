import { cardVariationDefs } from '../../engine/cards/variations'
import { rollText } from '../../engine/library/kinds'

const s = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const b = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined)
const patchStr = (d: Record<string, unknown>, key: string, cur: unknown): string => (key in d ? (d[key] === null ? '' : (s(d[key]) ?? s(cur) ?? '')) : (s(cur) ?? ''))
const patchBool = (d: Record<string, unknown>, key: string, cur: unknown): boolean => (key in d ? (d[key] === null ? false : (b(d[key]) ?? b(cur) ?? false)) : (b(cur) ?? false))

cardVariationDefs.add({
  id: 'prompt',
  module: 'cards',
  name: 'Prompt',
  order: 0,
  data: () => ({
    type: 'object',
    properties: {
      whatHappens: { type: 'string', description: 'on the card, told to the agent' },
      agentInstructions: { type: ['string', 'null'], description: 'only for the agent: how to play it out' },
      hideAgentInstructions: { type: ['boolean', 'null'] },
      requiresPlayerResponse: { type: ['boolean', 'null'], description: 'whoever plays it says what they do' },
      playerHookHint: { type: ['string', 'null'], description: 'shown when asking what they do' }
    }
  }),
  apply: (card, d) => ({
    ...card,
    prompt: '',
    happens: 'whatHappens' in d ? (d.whatHappens === null ? '' : (s(d.whatHappens) ?? s(card.happens) ?? s(card.prompt) ?? '')) : (s(card.happens) ?? s(card.prompt) ?? ''),
    instructions: patchStr(d, 'agentInstructions', card.instructions),
    hideInstructions: patchBool(d, 'hideAgentInstructions', card.hideInstructions),
    ask: patchBool(d, 'requiresPlayerResponse', card.ask),
    askHint: patchStr(d, 'playerHookHint', card.askHint)
  }),
  canPlay: () => true,
  play: async (card, ctx) => {
    const rawHappens = s(card.happens) || s(card.prompt) || s(card.text) || ctx.cardName
    const happens = rawHappens.trim() ? rollText(rawHappens).text : ctx.cardName
    const rawInstr = s(card.instructions) ?? ''
    const instr = rawInstr.trim() ? rollText(rawInstr).text : ''
    const lines = [happens, ...(instr ? [`Instructions: ${instr}`] : [])]
    return { mode: 'prompt', tone: 'cyan', label: 'Played', detail: ctx.target.name, lines, effects: [], view: [] }
  }
})

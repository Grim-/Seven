import { cardVariationDefs } from '../../engine/cards/variations'

const s = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const b = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined)

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
    happens: s(d.whatHappens) ?? card.happens ?? s(card.prompt) ?? '',
    instructions: s(d.agentInstructions) ?? card.instructions ?? '',
    hideInstructions: b(d.hideAgentInstructions) ?? card.hideInstructions ?? false,
    ask: b(d.requiresPlayerResponse) ?? card.ask ?? false,
    askHint: s(d.playerHookHint) ?? card.askHint ?? ''
  })
})

import { agentSide } from '@shared/cardDecks'
import { data } from '../data/hub'
import { getSheet } from '../library/sheets'
import { ToolError, type ToolContext } from '../tools/types'
import { CARD_TYPE, findDeckCard, takeCard } from './decks'
import { resolveCardParticipants } from './targets'
import { liveCardVariations, type CardPlayContext, type CardPlayOutcome, type CardRaw } from './variations'

export interface PlayedAgentCard {
  card: string
  mode: string
  target: string
  world: string | null
  hideInstructions: boolean
  outcome: CardPlayOutcome
}

export async function playCardForAgent(
  cardQuery: string,
  targetQuery: string | null,
  say: string | null,
  ctx: ToolContext
): Promise<PlayedAgentCard> {
  const { agent, world, playerSheet, caster, target } = resolveCardParticipants(targetQuery, ctx)
  const side = agentSide(agent)
  const cardName = findDeckCard(side, cardQuery)
  const meta = data.pages.find(cardName, (p) => p.type === CARD_TYPE)
  if (!meta) throw new ToolError(`Card "${cardName}" no longer exists.`)
  const page = data.pages.get(meta.id)
  const raw = ((page.data as CardRaw | null) ?? { name: page.title }) as CardRaw
  const playCtx: CardPlayContext = {
    card: raw,
    cardName: page.title,
    say: say?.trim() ?? '',
    world,
    playerSheet,
    caster,
    target,
    casterSheet: caster.sheetId ? getSheet(caster.sheetId) : null,
    targetSheet: target.sheetId ? getSheet(target.sheetId) : null,
    tool: ctx
  }
  const variation = [...liveCardVariations()]
    .sort((a, b) => (b.order ?? 0) - (a.order ?? 0))
    .find((v) => v.play && (v.canPlay?.(raw, playCtx) ?? true))
  if (!variation?.play) throw new ToolError(`No playable variation is active for "${page.title}".`)
  takeCard(side, page.title)
  const outcome = await variation.play(raw, playCtx)
  return {
    card: page.title,
    mode: outcome.mode,
    target: target.name,
    world,
    hideInstructions: raw.hideInstructions === true,
    outcome
  }
}

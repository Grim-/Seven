import { findTarget } from '@shared/actions'
import { cleanGameplay, HIT_EVENT, MISS_EVENT, type GameplayCard } from '@shared/gameplayCard'
import { failed } from '../../lib/notify'
import { CardPlayed } from '../cards/CardPlayed'
import type { Card } from '../cards/model'
import { sheetTarget } from '../../game/sheetTarget'
import type { PlayTarget } from '../../game/targets'
import { playText, surfaceOf, type PlayWhere } from './playStore'
import { effectLines, runCardEffects } from './cardEffects'
import { storedPiece } from '@shared/game/components'

const ROLL_MS = 800
const wait = (ms: number) => new Promise((done) => window.setTimeout(done, ms))
const signed = (n: number) => `${n < 0 ? '-' : '+'} ${Math.abs(n)}`

async function strike(card: Card, g: GameplayCard, target: PlayTarget, where: PlayWhere): Promise<void> {
  const surface = surfaceOf(where)
  surface.roll(null)
  await wait(ROLL_MS)
  const mine = where.sheet ? await sheetTarget(where.sheet, where.sheet).checks?.() : undefined
  const using = g.check ? findTarget(mine ?? [], g.check) : null
  const bonus = g.bonus + (using?.bonus ?? 0)
  const defence = g.defence ? ((await target.defence?.(g.defence)) ?? null) : null
  const dc = defence ?? g.dc
  const roll = 1 + Math.floor(Math.random() * 20)
  const total = roll + bonus
  const hit = total >= dc
  surface.roll(roll)
  const event = hit ? HIT_EVENT : MISS_EVENT
  const done = await runCardEffects([...storedPiece(g.hit, HIT_EVENT), ...storedPiece(g.miss, MISS_EVENT), ...g.effects].filter((d) => d.on === event), event, where)
  const effects = effectLines(done)
  let detail = `${total} vs ${dc}`
  for (const r of done?.results ?? []) if (r.target === target.id && typeof r.values.from === 'number' && typeof r.values.to === 'number') detail = `${target.name}: ${r.values.from} → ${r.values.to} HP`
  const lines = ['GAMEPLAY RESULT (rolled, not a choice)', `Target: ${target.link ?? target.name}.`, `${using?.label ?? 'Check'}: rolled ${roll} ${signed(bonus)} = ${total} (dc: ${dc}${defence !== null ? ", the target's defence" : ''}). ${hit ? 'Hit' : 'Missed'}.`, ...effects, 'Play this out.']
  const text = playText(where, lines.join('\n'))
  if (where.onText) where.onText(text)
  else surface.show(card.name, <CardPlayed text={text} where={where} />)
  surface.settle({ tone: hit ? 'ok' : 'alert', label: hit ? 'Hit' : 'Miss', detail, effects })
}

export function playGameplay(card: Card, where: PlayWhere): void {
  if (!where.target) return
  void strike(card, cleanGameplay(card.raw.gameplay), where.target, where).catch(failed('Could not play the card'))
}

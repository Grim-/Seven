import { showName } from '@shared/ids'
import { cardPlayed, type DeckRef } from '@shared/cardDecks'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { moduleOn } from '../../lib/moduleOn'
import { ActionBar } from '../ui'
import { PLAYED, playText, surfaceOf, type PlayWhere } from '../play/playStore'
import { AttemptPrompt } from './AttemptPrompt'
import { CardPlayed } from './CardPlayed'
import { playText as cardText, type Card } from './model'
import { cardVariations, type CardVariation } from './variations'
import { TargetPicker } from '../play/TargetPicker'
import type { PlayTarget } from '../../game/targets'

async function spend(card: Card, ref: DeckRef): Promise<boolean> {
  try {
    await engine('decks.take', { ref, card: card.name })
    return true
  } catch (err) {
    failed('Could not play the card')(err)
    return false
  }
}

async function rolled(text: string): Promise<string> {
  return text.trim() ? (await engine('library.rollText', { text })).text : ''
}

async function promptText(card: Card): Promise<string> {
  const happens = await rolled(card.happens || card.prompt || (typeof card.raw.text === 'string' ? card.raw.text : card.name))
  const instructions = await rolled(card.instructions)
  return [`What happens: ${happens}`, instructions && `Agent instructions: ${instructions}`].filter(Boolean).join('\n')
}

async function play(card: Card, ref: DeckRef, where: PlayWhere, said: string, form: CardVariation | null): Promise<void> {
  const surface = surfaceOf(where)
  if (!(await spend(card, ref))) return surface.close()
  const played: PlayWhere = { ...where, deck: ref, lead: cardPlayed(card.name, where.sheet ?? null, said) }
  if (form) return form.play(card, played)
  const text = await promptText(card)
  if (!where.onText) return surface.show(card.name, <CardPlayed text={text} where={played} />)
  where.onText(playText(played, text))
  surface.settle(PLAYED)
}

function pickForm(card: Card, where: PlayWhere): Promise<CardVariation | null | undefined> {
  const list = cardVariations.on(moduleOn).filter((v) => v.has(card.raw) && v.playable(card))
  if (list.length < 2) return Promise.resolve(list[0] ?? null)
  const surface = surfaceOf(where)
  return new Promise((done) =>
    surface.show(
      `Play ${showName(card.name)} as`,
      <ActionBar
        row
        items={[
          ...list.map((v) => ({
            label: v.label,
            onSelect: () => {
              surface.clear()
              done(v)
            }
          })),
          {
            label: 'Cancel',
            onSelect: () => {
              surface.close()
              done(undefined)
            }
          }
        ]}
      />
    )
  )
}

function pickTarget(where: PlayWhere): Promise<PlayTarget | null> {
  const surface = surfaceOf(where)
  return new Promise((done) =>
    surface.show(
      'At whom?',
      <TargetPicker
        context={{ world: where.world ?? null, sheet: where.sheet ?? null, agents: where.agents }}
        onPick={(target) => {
          surface.clear()
          done(target)
        }}
        onCancel={() => {
          surface.close()
          done(null)
        }}
      />
    )
  )
}

function ask(card: Card, where: PlayWhere): Promise<string | null> {
  const surface = surfaceOf(where)
  return new Promise((done) =>
    surface.show(
      showName(card.name),
      <AttemptPrompt
        hint={card.askHint.trim() || cardText(card)}
        playLabel={`Play ${showName(card.name)}`}
        onGo={(said) => {
          surface.clear()
          done(said)
        }}
        onCancel={() => {
          surface.close()
          done(null)
        }}
      />
    )
  )
}

export async function playCard(card: Card, ref: DeckRef, where: PlayWhere, chosen?: CardVariation | null): Promise<string | null> {
  const form = chosen !== undefined ? chosen : await pickForm(card, where)
  if (form === undefined) return null
  const target = form?.target?.(card) ? await pickTarget(where) : null
  if (form?.target?.(card) && !target) return null
  const said = card.ask ? await ask(card, where) : ''
  if (said !== null) void play(card, ref, target ? { ...where, target } : where, said, form)
  return said
}

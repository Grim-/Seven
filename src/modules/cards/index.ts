import type { JsonObjectSchema } from '../../engine/tools/schema'
import { CARD_VARIATION_SCOPE, cardVariationDefs, liveCardVariations, type CardVariationDef } from '../../engine/cards/variations'
import { checkKeys } from '../../engine/tools/schemaSources'
import { moduleOnForAgent } from '../../engine/modules/isOn'
import './promptVariation'
import type { ModuleFactory, ModulePage, ModuleViewResult } from '../../engine/modules/sdk'
import type { ToolContext, ToolDef } from '../../engine/tools/types'
import { cleanSvg } from '@shared/svg'
import { FIELD_TYPES, PLACES, cardText, fieldId, readLayout, type CardLayout, type CardValue } from '@shared/cards'
import { actionText } from '@shared/actions'
import { decisionText } from '@shared/decisions'
import { agentSide, totalOf, userSide, type DeckOwner, type DeckRef, type DeckEntry } from '@shared/cardDecks'
import { chatPlayer } from '@shared/types'
import { data } from '../../engine/data/hub'
import { vaultEvents } from '../../engine/util/secure'
import { isVaultLocked } from '@shared/sealed'
import { rollText } from '../../engine/library/kinds'
import { getSheet } from '../../engine/library/sheets'
import { addCard, addSet, deckCards, setDeckOwner, takeCard } from '../../engine/cards/decks'
import { playCardForAgent } from '../../engine/cards/play'
import { agentAccess } from '../../engine/agents/access'
import { worlds } from '../../engine/worlds/store'
import { ifMissing } from '../../engine/util/report'
import { CardError, cleanCard, cleanDeck, cleanLayout, cleanSet, type CardData, type CardSetData } from './clean'
import html from './cards.html?raw'
import { linkFor } from '@shared/text'
import { drawn } from '@shared/random'

type Json = Record<string, unknown>

const MOVED = 'setsMoved'

const makeCardParams = (variations: CardVariationDef[]): JsonObjectSchema => {
  return {
    type: 'object',
    properties: {
      card: { type: 'string', description: 'its name' },
      variation: {
        oneOf: [
          { type: 'null' },
          {
            type: 'object',
            properties: {
              type: { enum: variations.map((v) => v.id) },
              data: { type: ['object', 'null'], description: `fields: inspect_schema(${CARD_VARIATION_SCOPE}, <type>); null removes it` }
            },
            required: ['type', 'data']
          }
        ]
      },
      text: { type: ['string', 'null'], description: 'flavour' },
      art: { type: ['string', 'null'] },
      color: { type: ['string', 'null'] },
      layout: { type: ['string', 'null'], description: 'Card layout name (defaults to "basic")' },
      values: { oneOf: [{ type: 'null' }, { type: 'object', properties: {}, additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }, { type: 'array', items: { type: 'string' } }] } }] }
    }
  }
}
const LINK = /^@[\w.:-]+?:"?(.+?)"?$/

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    async init(): Promise<void> {
      this.moveSets()
    }

    private moveSets(): void {
      try {
        if (this.storage.get(MOVED, false)) return
        for (const p of data.pages.ofType('cards:deck')) {
          const page = data.pages.get(p.id)
          data.pages.retype(p.id, 'cards:set', cleanSet({ name: page.title, ...((page.data as Json | null) ?? {}) }))
        }
        this.storage.set(MOVED, true)
      } catch (err) {
        if (isVaultLocked(err)) vaultEvents.once('unlocked', () => this.moveSets())
        else this.log.error('Could not move the old decks to card sets:', err instanceof Error ? err.message : String(err))
      }
    }

    private fail(err: unknown): never {
      if (err instanceof CardError) throw new sdk.ToolError(err.message)
      throw err
    }

    private cardPage(ref: string): ModulePage | null {
      return this.pages.find('card', ref)
    }

    private named(type: string, ref: string, what: string): ModulePage {
      const page = this.pages.find(type, ref)
      if (page) return page
      const list = this.pages.list(type).map((p) => p.title)
      throw new sdk.ToolError(`There is no ${what} "${ref}". ${list.length ? `Use one of these: ${list.join(', ')}.` : `There are no ${what}s yet.`}`)
    }

    private layout(ref: string): CardLayout {
      const page = this.named('layout', ref, 'card layout')
      return readLayout(page.data, page.title)
    }

    private checkValues(layout: CardLayout, raw: unknown): Record<string, CardValue> {
      const given = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Json) : {}
      const fields = layout.fields.map((f) => `${f.label} (${f.type}${f.options.length ? `: ${f.options.join(', ')}` : ''})`).join(', ')
      const out: Record<string, CardValue> = {}
      for (const [key, value] of Object.entries(given)) {
        const field = layout.fields.find((f) => f.id === key || fieldId(f.label) === fieldId(key))
        if (!field) throw new sdk.ToolError(`${layout.name} has no field "${key}". Its fields: ${fields}.`)
        if (value === null) out[field.id] = null
        else if (field.type === 'number') {
          const n = typeof value === 'number' ? value : Number(value)
          if (!Number.isFinite(n)) throw new sdk.ToolError(`${field.label} is a number; got "${String(value)}".`)
          out[field.id] = n
        } else if (field.type === 'list') out[field.id] = (Array.isArray(value) ? value : [value]).map(String)
        else if (field.type === 'choice') {
          const pick = field.options.find((o) => o.toLowerCase() === String(value).toLowerCase())
          if (!pick) throw new sdk.ToolError(`${field.label} must be one of: ${field.options.join(', ')}.`)
          out[field.id] = pick
        } else out[field.id] = String(value)
      }
      return out
    }

    private missingCards(entries: DeckEntry[]): string[] {
      return entries.filter((c) => !this.cardPage(c.card)).map((c) => c.card)
    }

    private chatDeck(ctx: ToolContext): DeckRef {
      if (!ctx.sessionId || !ctx.agentId) throw new sdk.ToolError('Cards can only be given or taken in a chat with an agent.')
      const agent = agentAccess.get(ctx.agentId)
      const world = agent?.world?.worldId ?? null
      return userSide(chatPlayer(agent, world ? ifMissing(() => worlds.meta(world).player, null) : null))
    }

    private looted(repo: string): string {
      const rolled = rollText(`@repo:"${repo}"#random`)
      const hit = rolled.rolled[0]
      if (!hit || hit.error) throw new sdk.ToolError(hit?.error ?? `Could not roll the repo "${repo}".`)
      const value = hit.value.trim()
      return LINK.exec(value)?.[1] ?? value
    }

    define(tools: { add(tool: ToolDef): void }): void {
      const add = (tool: Omit<ToolDef, 'group' | 'needsWorkspace'>) => tools.add({ group: 'cards', needsWorkspace: false, ...tool })

      add({
        name: 'make_card',
        activity: () => 'making a card',
        description: 'Make or change a card. variation adds or replaces one of its variations; call again for another. layout: a card layout name, basic if unsure; values: its fields by name. art: a short glyph or an <svg>.',
        params: makeCardParams(cardVariationDefs.all()),
        forAgent: (scope) => ({ params: makeCardParams(cardVariationDefs.on((m) => moduleOnForAgent(m, scope.agentId))) }),
        execute: async (params, ctx) => {
          try {
            const raw = params as Json
            const name = sdk.params.str(params, 'card')
            const existing = this.cardPage(name)
            let next: Json = { ...((existing?.data as Json | undefined) ?? {}), name: existing?.title ?? name }
            if (raw.text === null) next.text = ''
            else if (typeof raw.text === 'string') next.text = raw.text
            if (raw.color === null) next.color = null
            else if (typeof raw.color === 'string') next.color = raw.color
            if (raw.art === null) next.art = ''
            else if (typeof raw.art === 'string') next.art = raw.art.includes('<svg') ? cleanSvg(raw.art) : raw.art
            const prevLayout = typeof next.layout === 'string' && next.layout ? next.layout : null
            if (raw.layout === null) next = { ...next, layout: null, values: {} }
            else {
              const layoutRef = sdk.params.optStr(params, 'layout')
              const layoutTitle = layoutRef ? this.named('layout', layoutRef, 'card layout').title : prevLayout
              const prevValues = raw.values === null || (layoutRef && layoutTitle !== prevLayout) ? {} : ((next.values as Record<string, CardValue> | undefined) ?? {})
              const patchValues = raw.values && typeof raw.values === 'object' ? (layoutTitle ? this.checkValues(this.layout(layoutTitle), raw.values) : (() => { throw new sdk.ToolError('Set layout before setting card values.') })()) : {}
              if (layoutRef || 'values' in raw) next = { ...next, layout: layoutTitle, values: { ...prevValues, ...patchValues } }
            }
            const v = raw.variation && typeof raw.variation === 'object' && !Array.isArray(raw.variation) ? (raw.variation as Json) : null
            if (v) {
              const def = cardVariationDefs.on((m) => moduleOnForAgent(m, ctx.agentId)).find((d) => d.id === v.type)
              if (!def) throw new CardError(`No card variation "${String(v.type)}".`)
              if (v.data === null) {
                if (!def.remove) throw new CardError(`A card always has ${def.name}.`)
                next = def.remove(next)
              } else {
                const given = v.data && typeof v.data === 'object' && !Array.isArray(v.data) ? (v.data as Json) : {}
                checkKeys(CARD_VARIATION_SCOPE, def.id, given)
                next = def.apply(next, given)
              }
            }
            const card = cleanCard(next)
            const page = existing ? this.pages.save(existing.id, card) : this.pages.create('card', card.name, card)
            return `${existing ? 'Changed' : 'Made'} ${linkFor('card', page.title)}.`
          } catch (err) {
            this.fail(err)
          }
        }
      })

      add({
        name: 'make_card_set',
        activity: () => 'making a card set',
        description: 'Make or change a card set: a template of cards (by name) with how many of each. Decks can start from it.',
        params: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            cards: { type: 'array', items: { type: 'object', properties: { card: { type: 'string' }, count: { type: 'integer' } } } }
          }
        },
        execute: async (params) => {
          try {
            const set = cleanSet(params)
            const missing = this.missingCards(set.cards)
            if (missing.length) throw new sdk.ToolError(`These are not cards yet: ${missing.join(', ')}. Make them with make_card first.`)
            const existing = this.pages.find('set', set.name)
            const page = existing ? this.pages.save(existing.id, set) : this.pages.create('set', set.name, set)
            return `${existing ? 'Changed' : 'Made'} the card set ${linkFor('card_set', page.title)} with ${totalOf(set.cards)} cards.`
          } catch (err) {
            this.fail(err)
          }
        }
      })

      add({
        name: 'give_card',
        activity: () => 'giving a card',
        description: "Give the user a card for the deck they play in this chat. card is a card name; or repo is a repo of card names, rolled for a random one (loot). You never see their deck.",
        params: { type: 'object', properties: { card: { type: ['string', 'null'] }, repo: { type: ['string', 'null'] }, count: { type: ['integer', 'null'] } } },
        execute: async (params, ctx) => {
          const repo = sdk.params.optStr(params, 'repo')
          const card = sdk.params.optStr(params, 'card') ?? (repo ? this.looted(repo) : null)
          if (!card) throw new sdk.ToolError('Give card (a card name) or repo (a repo of card names).')
          const count = Math.max(1, sdk.params.optInt(params, 'count') ?? 1)
          addCard(this.chatDeck(ctx), card, count)
          return `The user gains ${count > 1 ? `${count}× ` : ''}${linkFor('card', card)}.`
        }
      })

      add({
        name: 'take_card',
        activity: () => 'taking a card',
        description: 'Take one card away from the deck the user plays in this chat, by name.',
        params: { type: 'object', properties: { card: { type: 'string' } } },
        execute: async (params, ctx) => {
          const card = sdk.params.str(params, 'card')
          takeCard(this.chatDeck(ctx), card)
          return `The user loses ${linkFor('card', card)}.`
        }
      })

      add({
        name: 'play_card',
        activity: () => 'playing a card',
        description: 'Play a card from your deck. target can be "user", "self", a character sheet, a creature, or a map object (omitted targets the user). Seven selects Gameplay, Roleplay, or Prompt automatically.',
        params: {
          type: 'object',
          properties: {
            card: { type: 'string', description: 'card name or link from your deck' },
            target: { type: ['string', 'null'], description: '"user", "self", or target name; omitted targets user' },
            say: { type: ['string', 'null'], description: 'short in-character line displayed on the played card' }
          },
          required: ['card']
        },
        execute: async (params, ctx) => {
          const say = sdk.params.optStr(params, 'say')
          const played = await playCardForAgent(sdk.params.str(params, 'card'), sdk.params.optStr(params, 'target'), say, ctx)
          ctx.addElement?.({
            type: 'card_play',
            data: {
              card: played.card,
              said: say ?? '',
              outcome: {
                tone: played.outcome.tone,
                label: played.outcome.label,
                detail: played.outcome.detail,
                effects: played.outcome.effects
              },
              hidden: played.hideInstructions
            }
          })
          ctx.viewEvents?.(played.outcome.view, played.card, played.world)
          return [`PLAYED ${linkFor('card', played.card)} [${played.mode}] -> ${played.target}`, ...played.outcome.lines, 'Play this out in your reply.'].join('\n')
        }
      })

      add({
        name: 'make_card_layout',
        activity: () => 'making a card layout',
        description: 'Create or update a card layout template defining custom typed fields and where they render on a card.',
        params: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Layout name, e.g. Spell' },
            color: { type: ['string', 'null'], description: 'Hex accent color, e.g. #2dd4bf' },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  type: { enum: [...FIELD_TYPES] },
                  place: { enum: [...PLACES] },
                  options: { type: ['array', 'null'], items: { type: 'string' }, description: 'Choice options when type is choice' }
                },
                required: ['label']
              }
            }
          },
          required: ['name', 'fields']
        },
        execute: async (params) => {
          try {
            const layout = cleanLayout(params)
            const existing = this.pages.find('layout', layout.name)
            const page = existing ? this.pages.save(existing.id, layout) : this.pages.create('layout', layout.name, layout)
            return `${existing ? 'Updated' : 'Created'} card layout ${linkFor('card_layout', page.title)} with ${layout.fields.length} fields.`
          } catch (err) {
            this.fail(err)
          }
        }
      })

      add({
        name: 'manage_deck',
        activity: () => 'managing card deck',
        description: 'Inspect or modify cards in your own deck ("self"), the user deck ("user"), a character sheet deck ("character"), or a named deck ("deck"): list contents, add/remove cards, deal a card set, or reassign deck owner.',
        params: {
          type: 'object',
          properties: {
            action: { enum: ['list', 'add_card', 'remove_card', 'deal_set', 'set_owner'], description: 'Operation to perform' },
            side: { enum: ['self', 'user', 'character', 'deck'], description: 'Target deck holder (default "self")' },
            sheet: { type: ['string', 'null'], description: 'Character sheet name/id when side is "character" (or ownerType is "character")' },
            deck: { type: ['string', 'null'], description: 'Named deck page title/id when side is "deck" or action is "set_owner"' },
            card: { type: ['string', 'null'], description: 'Card name for add_card/remove_card' },
            set: { type: ['string', 'null'], description: 'Card set name for deal_set' },
            count: { type: ['integer', 'null'], description: 'Card quantity (default 1)' },
            ownerType: { enum: ['user', 'agent', 'character', 'none'], description: 'New owner kind for set_owner' },
            ownerId: { type: ['string', 'null'], description: 'Agent or character id/name for set_owner' }
          },
          required: ['action']
        },
        execute: async (params, ctx) => {
          const action = sdk.params.str(params, 'action')
          const side = sdk.params.optStr(params, 'side') || 'self'
          const count = Math.max(1, sdk.params.optInt(params, 'count') ?? 1)
          const resolveRef = (): DeckRef => {
            if (side === 'deck') {
              const ref = sdk.params.str(params, 'deck')
              return { deck: this.named('deck', ref, 'card deck').id }
            }
            if (side === 'character') {
              const ref = sdk.params.str(params, 'sheet')
              return { character: getSheet(ref).id }
            }
            if (side === 'user') {
              return ctx.agentId ? this.chatDeck(ctx) : { user: true }
            }
            if (!ctx.agentId) throw new sdk.ToolError('Pass side ("user", "character", or "deck") outside an agent chat.')
            const agent = agentAccess.get(ctx.agentId)
            if (!agent) throw new sdk.ToolError('Agent not found.')
            return agentSide(agent)
          }

          if (action === 'set_owner') {
            const deckPage = this.named('deck', sdk.params.str(params, 'deck'), 'card deck')
            const ownerType = sdk.params.str(params, 'ownerType')
            const ownerId = sdk.params.optStr(params, 'ownerId') ?? sdk.params.optStr(params, 'sheet')
            let owner: DeckOwner | null = null
            if (ownerType === 'user') owner = { user: true }
            else if (ownerType === 'agent') {
              const targetAgent = ownerId ? agentAccess.list().find((a) => a.id === ownerId || a.name.toLowerCase() === ownerId.toLowerCase()) : ctx.agentId ? agentAccess.get(ctx.agentId) : null
              if (!targetAgent) throw new sdk.ToolError(`No agent "${ownerId ?? ''}".`)
              owner = { agent: targetAgent.id }
            } else if (ownerType === 'character') {
              if (!ownerId) throw new sdk.ToolError('Give ownerId or sheet when ownerType is "character".')
              owner = { character: getSheet(ownerId).id }
            }
            setDeckOwner(deckPage.id, owner)
            return `Updated owner of deck ${linkFor('card_deck', deckPage.title)} to ${ownerType}.`
          }

          const ref = resolveRef()
          if (action === 'list') {
            const entries = deckCards(ref)
            if (!entries.length) return `Deck (${side}) is empty.`
            return `Deck (${side}) cards (${totalOf(entries)} total): ${entries.map((e) => `${e.card} x${e.count}`).join(', ')}.`
          }
          if (action === 'add_card') {
            const card = sdk.params.str(params, 'card')
            const deckId = addCard(ref, card, count)
            return `Added ${count}x ${linkFor('card', card)} to ${deckId}.`
          }
          if (action === 'remove_card') {
            const card = sdk.params.str(params, 'card')
            let removed = 0
            for (let i = 0; i < count; i++) {
              takeCard(ref, card)
              removed++
            }
            return `Removed ${removed}x ${linkFor('card', card)} from deck (${side}).`
          }
          if (action === 'deal_set') {
            const setPage = this.named('set', sdk.params.str(params, 'set'), 'card set')
            addSet(ref, setPage.id)
            return `Dealt card set ${linkFor('card_set', setPage.title)} into deck (${side}).`
          }
          throw new sdk.ToolError(`Unknown deck action "${action}".`)
        }
      })
    }

    private entriesView(entries: DeckEntry[]) {
      return entries.map((e) => ({ count: e.count, card: (this.cardPage(e.card)?.data as CardData | undefined) ?? { name: e.card, text: '(missing card)', art: '' } }))
    }

    async pageView(type: string, page: ModulePage): Promise<ModuleViewResult> {
      if (type === 'layout') return { html, values: { mode: 'layout', data: readLayout(page.data, page.title), text: this.pageText(type, page) } }
      if (type === 'set' || type === 'deck') {
        const list = type === 'set' ? cleanSet({ name: page.title, ...((page.data as Json | null) ?? {}) }) : cleanDeck({ name: page.title, ...((page.data as Json | null) ?? {}) })
        return { html, values: { mode: 'counts', name: list.name, cards: this.entriesView(list.cards), json: JSON.stringify(list, null, 2) } }
      }
      return { html, values: { mode: 'card', data: page.data ? page.data : { name: page.title }, text: this.pageText(type, page), json: JSON.stringify(page.data, null, 2) } }
    }

    async onPageAction(type: string, _page: ModulePage, name: string, payload: unknown): Promise<{ message?: string; data?: unknown } | string | void> {
      if (name !== 'save') return
      try {
        const parsed = JSON.parse(String(((payload ?? {}) as Json).json ?? ''))
        const value = type === 'card' ? cleanCard(parsed) : type === 'set' ? cleanSet(parsed) : type === 'deck' ? cleanDeck(parsed) : cleanLayout(parsed)
        return { message: 'Saved.', data: value }
      } catch (err) {
        if (err instanceof SyntaxError) return `That is not valid JSON: ${err.message}`
        if (err instanceof CardError) return err.message
        throw err
      }
    }

    pageRoll(type: string, page: ModulePage): string | null {
      return this.pageDraw(type, page, 1)?.[0] ?? null
    }

    pageDraw(type: string, page: ModulePage, count: number): string[] | null {
      if (type !== 'set') return null
      const set = cleanSet({ name: page.title, ...((page.data as Json | null) ?? {}) })
      const pile = set.cards.flatMap((c) => Array.from({ length: c.count }, () => c.card))
      if (!pile.length) throw new sdk.ToolError(`The card set ${set.name} has no cards yet. Add some with make_card_set first.`)
      return drawn(pile, count).map((name) => linkFor('card', name))
    }

    pageText(type: string, page: ModulePage): string {
      if (type === 'layout') {
        const l = readLayout(page.data, page.title)
        return `Card layout ${l.name}: ${l.fields.map((f) => `${f.label} (${f.type}${f.options.length ? `: ${f.options.join(', ')}` : ''})`).join(', ') || 'no fields yet'}`
      }
      if (type === 'set') {
        const s = (page.data as CardSetData | null) ?? { name: page.title, cards: [] }
        return `Card set ${s.name}: ${s.cards.map((c) => `${c.count}× ${c.card}`).join(', ') || 'empty'}`
      }
      if (type === 'deck') return `Card deck ${page.title}: the user's cards, kept from you.`
      if (!page.data) return `${page.title}: an empty card`
      const c = cleanCard({ name: page.title, ...(page.data as Json) })
      const layoutPage = c.layout ? this.pages.find('layout', c.layout) : null
      const face = layoutPage ? cardText(c.name, readLayout(layoutPage.data, layoutPage.title), c.values, (id) => data.assets.metaFor(id)?.description ?? data.assets.metaFor(id)?.name ?? id) : `${c.name}${c.text ? `: ${c.text}` : ''}`
      const use = c.use === 'action' && c.action ? `Action card:\n${actionText(c.action)}` : c.use === 'decision' && c.decision ? `Decision card:\n${decisionText(c.decision)}` : `Generic card. Prompt: ${c.prompt || '(none)'}`
      const variations = liveCardVariations().flatMap((v) => v.text?.(page.data as Json) ?? [])
      return [face, use, ...variations].join('\n')
    }
  }

export default factory

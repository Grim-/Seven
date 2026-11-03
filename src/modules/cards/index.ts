import type { GbnfJsonSchema } from 'node-llama-cpp'
import type { ModuleFactory, ModulePage, ModuleViewResult } from '../../engine/modules/sdk'
import type { ToolContext, ToolDef } from '../../engine/tools/types'
import { cleanSvg } from '@shared/svg'
import { cardText, fieldId, readLayout, type CardLayout, type CardValue } from '@shared/cards'
import { CHANCE, actionText, checkNames } from '@shared/actions'
import { decisionText } from '@shared/decisions'
import { totalOf, type DeckRef, type DeckEntry } from '@shared/cardDecks'
import { data } from '../../engine/data/hub'
import { vaultEvents } from '../../engine/util/secure'
import { isVaultLocked } from '@shared/sealed'
import { rollText } from '../../engine/library/kinds'
import { addCard, takeCard } from '../../engine/cards/decks'
import { CardError, cleanCard, cleanDeck, cleanLayout, cleanSet, type CardData, type CardSetData } from './clean'
import html from './cards.html?raw'
import { linkFor } from '@shared/text'
import { drawn } from '@shared/random'

type Json = Record<string, unknown>

const MOVED = 'setsMoved'
const CHECK: GbnfJsonSchema = { type: 'object', properties: { against: { oneOf: [{ type: 'null' }, { enum: [CHANCE, ...checkNames().map((c) => c.id)] }] }, difficulty: { type: ['number', 'null'] }, base: { type: ['number', 'null'] }, pass: { type: ['string', 'null'] }, fail: { type: ['string', 'null'] } } }
const ACTION: GbnfJsonSchema = { type: 'object', properties: { attempt: { type: 'string' }, needs: { enum: ['any', 'all'] }, checks: { type: 'array', items: CHECK }, pass: { type: 'string' }, fail: { type: 'string' } } }
const DECISION: GbnfJsonSchema = { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, own: { type: 'boolean' }, decider: { type: ['string', 'null'] } } }
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
      return { chat: ctx.sessionId, agent: ctx.agentId }
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
        description: 'Make or change a card. use is generic (prompt is sent as the user\'s message when played), action (rolled against the character\'s stats) or decision (a choice). layout is a card layout name use basic if unsure; values sets its fields by name. art can be a short glyph or an <svg>.',
        params: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            use: { enum: ['generic', 'action', 'decision'] },
            prompt: { type: ['string', 'null'] },
            action: { oneOf: [{ type: 'null' }, ACTION] },
            decision: { oneOf: [{ type: 'null' }, DECISION] },
            text: { type: ['string', 'null'] },
            art: { type: ['string', 'null'] },
            color: { type: ['string', 'null'] },
            layout: { type: ['string', 'null'] },
            values: { oneOf: [{ type: 'null' }, { type: 'object', properties: {}, additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }, { type: 'array', items: { type: 'string' } }] } }] }
          }
        },
        execute: async (params) => {
          try {
            const raw = params as Json
            const layoutRef = sdk.params.optStr(params, 'layout')
            const values = layoutRef ? this.checkValues(this.layout(layoutRef), raw.values) : {}
            const card = cleanCard({ ...raw, layout: layoutRef ? this.named('layout', layoutRef, 'card layout').title : null, values, art: typeof raw.art === 'string' && raw.art.includes('<svg') ? cleanSvg(raw.art) : raw.art })
            const existing = this.cardPage(card.name)
            const page = existing ? this.pages.save(existing.id, card) : this.pages.create('card', card.name, card)
            return `${existing ? 'Changed' : 'Made'} ${linkFor('cards.card', page.title)}.`
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
            if (missing.length) throw new sdk.ToolError(`These are not cards yet: ${missing.join(', ')}. Make them with cards_card first.`)
            const existing = this.pages.find('set', set.name)
            const page = existing ? this.pages.save(existing.id, set) : this.pages.create('set', set.name, set)
            return `${existing ? 'Changed' : 'Made'} the card set ${linkFor('cards.set', page.title)} with ${totalOf(set.cards)} cards.`
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
          return `The user gains ${count > 1 ? `${count}× ` : ''}${linkFor('cards.card', card)}.`
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
          return `The user loses ${linkFor('cards.card', card)}.`
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
      if (!pile.length) throw new sdk.ToolError(`The card set ${set.name} has no cards yet. Add some with cards_set first.`)
      return drawn(pile, count).map((name) => linkFor('cards.card', name))
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
      return `${face}\n${use}`
    }
  }

export default factory

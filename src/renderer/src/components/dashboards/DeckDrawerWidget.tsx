import { useMemo, useRef, useState, type MouseEvent } from 'react'
import { ArrowDownToLine, Eye, EyeOff, Hand, Layers, Play, RotateCcw, Shuffle, Sparkles, Trash2 } from 'lucide-react'
import { addCards, totalOf, userSide, type DeckEntry, type DeckRef } from '@shared/cardDecks'
import { showName, toId } from '@shared/ids'
import type { WidgetSource } from '@shared/types'
import { Button, EmptyState, FaceCount, Field, Select, Toggle, openMenu, type MenuEvent, type MenuItem } from '../ui'
import { cn } from '../../lib/cn'
import { openEntry } from '../../lib/library'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { chatCanAnswer } from '../../lib/sendOrQueue'
import { focusedConversation, openConversations, useAgentIdOf, useFocusedConversation } from '../../lib/conversation'
import { registerWidgetUi, type WidgetBodyProps, type WidgetEditorProps } from '../../registries/widgets'
import { useAgents } from '../../store/agents'
import { useDashboards } from '../../store/dashboards'
import { useData, usePage } from '../../store/data'
import { useSessions } from '../../store/sessions'
import { toast } from '../../store/toasts'
import { entryMenuAt } from '../../views/data/entryMenu'
import { useChatPlayer } from '../chat/useChatPlayer'
import type { PlayWhere } from '../play/playStore'
import { CardBack } from '../cards/CardBack'
import { LiveCard } from '../cards/LiveCard'
import { chatPlay } from '../cards/cardPlay'
import { CARD_TYPE, DECK_TYPE, SET_TYPE, readCard, readCounts, useTypePages, type Card } from '../cards/model'
import { playCard } from '../cards/playCard'
import { stageSurface } from '../cards/playStage'
import { useDeckInUse } from '../cards/useDeckInUse'
import { useHeldCards } from '../cards/useHeldCards'

interface DrawerCardEntry {
  uid: string
  card: string
  faceUp: boolean
}

interface DrawerState {
  deck: string
  faceUp: boolean
  consume: boolean
  showHand: boolean
  tray: DrawerCardEntry[]
  discard: string[]
}

const MAX_TRAY_CARDS = 60

function parseDrawerSource(source: WidgetSource): DrawerState {
  const rawTray = Array.isArray(source.tray) ? source.tray : []
  const tray: DrawerCardEntry[] = []
  for (const item of rawTray) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const rec = item as Record<string, unknown>
    const card = typeof rec.card === 'string' ? rec.card.trim() : ''
    if (!card) continue
    const uid = typeof rec.uid === 'string' && rec.uid.trim() ? rec.uid.trim() : `d-${tray.length}`
    tray.push({ uid, card, faceUp: rec.faceUp !== false })
    if (tray.length >= MAX_TRAY_CARDS) break
  }
  const discard = Array.isArray(source.discard)
    ? source.discard.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim()).slice(0, MAX_TRAY_CARDS)
    : []
  return {
    deck: typeof source.deck === 'string' ? source.deck.trim() : '',
    faceUp: source.faceUp !== false,
    consume: source.consume !== false,
    showHand: source.showHand !== false,
    tray,
    discard
  }
}

function toWidgetSource(state: DrawerState): WidgetSource {
  return {
    kind: 'deck_drawer',
    deck: state.deck,
    faceUp: state.faceUp,
    consume: state.consume,
    showHand: state.showHand,
    tray: state.tray,
    discard: state.discard
  }
}

function makeUid(): string {
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function drawWeighted(entries: DeckEntry[], count: number, consume: boolean): string[] {
  const pool = entries.map((e) => ({ ...e }))
  const picked: string[] = []
  for (let i = 0; i < count; i++) {
    const total = totalOf(pool)
    if (total <= 0) break
    let roll = Math.random() * total
    let chosen = pool[pool.length - 1].card
    for (const entry of pool) {
      roll -= entry.count
      if (roll < 0) {
        chosen = entry.card
        break
      }
    }
    picked.push(chosen)
    if (consume) {
      const next = addCards(pool, chosen, -1)
      pool.splice(0, pool.length, ...next)
    }
  }
  return picked
}

function menuEventFrom(e: MouseEvent): MenuEvent {
  return { preventDefault() {}, stopPropagation() {}, clientX: e.clientX, clientY: e.clientY }
}

function stackLayers(remaining: number, isSet: boolean): number {
  if (isSet || remaining >= 10) return 3
  if (remaining >= 3) return 2
  if (remaining >= 1) return 1
  return 0
}

function DeckSourcePill({
  label,
  remaining,
  isSet,
  onPick
}: {
  label: string
  remaining: number
  isSet: boolean
  onPick: (e: MouseEvent) => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      title="Switch draw deck or card set"
      className="flex min-w-0 items-center gap-1.5 border border-line/60 bg-black/45 px-2 py-0.5 font-mono text-[10.5px] text-white/90 hover:border-accent hover:text-accent"
    >
      <Layers className="h-3 w-3 shrink-0 text-teal/80" />
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 font-bold text-accent">{isSet ? '∞' : remaining}</span>
    </button>
  )
}

function DrawPedestal({
  hasDeck,
  isSet,
  remaining,
  faceUp,
  onDraw,
  onToggleFaceUp,
  onReturnMenu
}: {
  hasDeck: boolean
  isSet: boolean
  remaining: number
  faceUp: boolean
  onDraw: (n: number) => void
  onToggleFaceUp: () => void
  onReturnMenu: (e: MouseEvent) => void
}) {
  const layers = hasDeck ? stackLayers(remaining, isSet) : 0
  const empty = !hasDeck || (!isSet && remaining <= 0)
  return (
    <div className="flex shrink-0 items-center justify-between gap-2.5 border border-line/40 bg-black/35 p-2 @[340px]:flex-col @[340px]:justify-center">
      <button
        type="button"
        disabled={empty}
        onClick={() => onDraw(1)}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onReturnMenu(e)
        }}
        title={empty ? 'Deck is empty' : 'Click to draw 1 card (right-click for refill options)'}
        className={cn(
          'group relative block w-14 shrink-0 transition-transform @[340px]:w-20',
          empty ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0'
        )}
      >
        {layers >= 3 && <span aria-hidden className="pointer-events-none absolute inset-0 translate-x-1.5 translate-y-1.5 border border-line/45 bg-bg/90" />}
        {layers >= 2 && <span aria-hidden className="pointer-events-none absolute inset-0 translate-x-0.5 translate-y-0.5 border border-line/65 bg-bg/95" />}
        <div className="relative">
          {empty ? (
            <div className="flex aspect-[5/7] w-full flex-col items-center justify-center border border-dashed border-line/60 bg-black/40 p-1 text-center font-mono text-[9px] uppercase tracking-wider text-faint">
              Empty
            </div>
          ) : (
            <CardBack className="w-full" />
          )}
          {hasDeck && (
            <span className="absolute bottom-1 right-1 border border-line/70 bg-black/85 px-1 py-0.5 font-mono text-[9.5px] font-bold leading-none text-accent">
              {isSet ? 'SET' : remaining}
            </span>
          )}
        </div>
      </button>

      <div className="flex flex-wrap justify-end gap-1 @[340px]:w-full @[340px]:justify-center">
        <Button size="sm" variant="primary" icon={<Sparkles />} disabled={empty} onClick={() => onDraw(1)} title="Draw 1 card">
          Draw
        </Button>
        <Button size="sm" variant="ghost" disabled={empty || (!isSet && remaining < 2)} onClick={() => onDraw(3)} title="Draw up to 3 cards">
          ×3
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={faceUp ? <Eye /> : <EyeOff />}
          onClick={onToggleFaceUp}
          title={faceUp ? 'Drawn cards reveal face-up (click to draw face-down)' : 'Drawn cards land face-down (click to draw face-up)'}
        />
        <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={onReturnMenu} title="Return cards or refill deck" />
      </div>
    </div>
  )
}

function TrayCardTile({
  entry,
  cardId,
  disabled,
  canKeepHand,
  onFlip,
  onPlay,
  onKeep,
  onReturn,
  onMenu
}: {
  entry: DrawerCardEntry
  cardId: string | null
  disabled: boolean
  canKeepHand: boolean
  onFlip: () => void
  onPlay: () => void
  onKeep: () => void
  onReturn: () => void
  onMenu: (e: MouseEvent) => void
}) {
  return (
    <div
      onDoubleClick={() => {
        if (entry.faceUp && cardId && !disabled) onPlay()
      }}
      onContextMenu={onMenu}
      className="group relative flex flex-col gap-1"
    >
      {entry.faceUp ? (
        <div className="relative overflow-hidden transition-transform duration-150 group-hover:-translate-y-0.5">
          {cardId ? (
            <LiveCard id={cardId} className="w-full" />
          ) : (
            <div className="flex aspect-[5/7] w-full items-center justify-center border border-line/50 bg-black/50 p-2 text-center font-mono text-[10px] text-dim">
              {showName(entry.card)}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onFlip}
          title={`Flip ${showName(entry.card)} face-up`}
          className="relative block w-full overflow-hidden text-left transition-transform duration-150 hover:-translate-y-0.5"
        >
          <CardBack className="w-full" />
          <span className="absolute inset-x-1.5 bottom-2 border border-accent/45 bg-black/80 py-0.5 text-center font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-accent">
            Tap to flip
          </span>
        </button>
      )}

      <div className="flex items-center justify-center gap-0.5 opacity-85 transition-opacity group-hover:opacity-100">
        {entry.faceUp && cardId && (
          <button
            type="button"
            disabled={disabled}
            onClick={onPlay}
            title="Play this card in chat"
            className="flex flex-1 items-center justify-center gap-1 border border-accent/50 bg-accent/15 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-accent hover:bg-accent/25 disabled:opacity-40"
          >
            <Play className="h-2.5 w-2.5" />
            Play
          </button>
        )}
        <button
          type="button"
          onClick={onFlip}
          title={entry.faceUp ? 'Flip face-down' : 'Flip face-up'}
          className="border border-line/50 bg-black/45 px-1.5 py-0.5 text-dim hover:border-line hover:text-white"
        >
          {entry.faceUp ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
        </button>
        {canKeepHand && (
          <button
            type="button"
            onClick={onKeep}
            title="Keep in player hand"
            className="border border-line/50 bg-black/45 px-1.5 py-0.5 text-teal/80 hover:border-teal/60 hover:text-teal"
          >
            <ArrowDownToLine className="h-2.5 w-2.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onReturn}
          title="Return to deck / discard"
          className="border border-line/50 bg-black/45 px-1.5 py-0.5 text-dim hover:border-alert/60 hover:text-alert"
        >
          <RotateCcw className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  )
}

function HandTrayList({
  handId,
  hasRef,
  entries,
  disabled,
  onStartHand,
  onPlayCard,
  onMoveToTray,
  onMenuCard
}: {
  handId: string | null
  hasRef: boolean
  entries: DeckEntry[]
  disabled: boolean
  onStartHand: () => void
  onPlayCard: (card: Card) => void
  onMoveToTray: (cardName: string) => void
  onMenuCard: (e: MouseEvent, cardId: string, cardName: string) => void
}) {
  const held = useHeldCards(entries)
  if (!hasRef) {
    return <div className="p-2 font-mono text-[11px] text-dim">Open or focus a chat to connect a player hand.</div>
  }
  if (!handId) {
    return (
      <EmptyState
        title="No player hand yet"
        action={
          <Button size="sm" variant="primary" icon={<Hand />} onClick={onStartHand}>
            Start hand deck
          </Button>
        }
      >
        Create a live hand for this chat or keep cards drawn from your deck.
      </EmptyState>
    )
  }
  if (!held.length) {
    return <div className="p-2 font-mono text-[11px] text-dim">Hand is empty. Draw cards into the tray and click keep-to-hand.</div>
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(5.75rem,1fr))] gap-2">
      {held.map((h) => (
        <HandTile
          key={h.id}
          cardId={h.id}
          count={h.count}
          disabled={disabled}
          onPlayCard={onPlayCard}
          onMoveToTray={onMoveToTray}
          onMenu={(e, name) => onMenuCard(e, h.id, name)}
        />
      ))}
    </div>
  )
}

function HandTile({
  cardId,
  count,
  disabled,
  onPlayCard,
  onMoveToTray,
  onMenu
}: {
  cardId: string
  count: number
  disabled: boolean
  onPlayCard: (card: Card) => void
  onMoveToTray: (name: string) => void
  onMenu: (e: MouseEvent, name: string) => void
}) {
  const page = usePage(cardId)
  const card = page ? readCard(page.data, page.title) : null
  return (
    <div
      onDoubleClick={() => {
        if (card && !disabled) onPlayCard(card)
      }}
      onContextMenu={(e) => {
        if (card) onMenu(e, card.name)
      }}
      className="group relative flex flex-col gap-1"
    >
      <div className="relative overflow-hidden transition-transform duration-150 group-hover:-translate-y-0.5">
        <LiveCard id={cardId} className="w-full" />
        <FaceCount count={count > 1 ? count : undefined} />
      </div>
      {card && (
        <div className="flex items-center gap-0.5 opacity-85 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPlayCard(card)}
            title="Play from hand into chat"
            className="flex flex-1 items-center justify-center gap-1 border border-accent/50 bg-accent/15 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-accent hover:bg-accent/25 disabled:opacity-40"
          >
            <Play className="h-2.5 w-2.5" />
            Play
          </button>
          <button
            type="button"
            onClick={() => onMoveToTray(card.name)}
            title="Place 1 copy onto the tray"
            className="border border-line/50 bg-black/45 px-1.5 py-0.5 text-dim hover:border-line hover:text-white"
          >
            <Layers className="h-2.5 w-2.5" />
          </button>
        </div>
      )}
    </div>
  )
}

function DeckDrawerBody({ dashboard, widget }: WidgetBodyProps) {
  const parsed = useMemo(() => parseDrawerSource(widget.source), [widget.source])
  const [local, setLocal] = useState<DrawerState | null>(null)
  const [tab, setTab] = useState<'tray' | 'hand'>('tray')
  const latestRef = useRef(parsed)
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())
  const state = local ?? parsed

  if (!local) latestRef.current = parsed

  const decks = useTypePages(DECK_TYPE)
  const sets = useTypePages(SET_TYPE)
  const cards = useTypePages(CARD_TYPE)
  const cardById = useMemo(() => new Map(cards.map((c) => [toId(c.title), c])), [cards])

  const sourcePage = usePage(state.deck || null)
  const isSet = sourcePage?.type === SET_TYPE
  const isDeck = sourcePage?.type === DECK_TYPE
  const counts = useMemo(() => (sourcePage ? readCounts(sourcePage.data, sourcePage.title) : null), [sourcePage])
  const entries = useMemo(() => (counts ? counts.cards.filter((e) => e.count > 0) : []), [counts])
  const remaining = totalOf(entries)

  const focusedConv = useFocusedConversation()
  const conv = focusedConv ?? openConversations()[0] ?? null
  const agentId = useAgentIdOf(conv)
  const agent = useAgents((s) => s.list.find((a) => a.id === agentId) ?? null)
  const player = useChatPlayer(agent)
  const handRef: DeckRef | null = agent ? userSide(player) : { user: true }
  const playerHand = useDeckInUse(handRef)
  const running = useSessions((s) => (conv?.sessionId ? Boolean(s.running[conv.sessionId]) : false))
  const handCount = playerHand ? totalOf(playerHand.entries) : 0
  const activeTab = state.showHand ? tab : 'tray'

  const enqueue = <T,>(task: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(task, task)
    queueRef.current = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  const commit = (change: (prev: DrawerState) => DrawerState) => {
    const next = change(latestRef.current)
    latestRef.current = next
    setLocal(next)
    void enqueue(async () => {
      const updated = await engine('widgets.update', { dashboardId: dashboard.id, widgetId: widget.id, source: toWidgetSource(next) })
      useDashboards.getState().onChanged(updated.id, updated)
      if (latestRef.current === next) setLocal(null)
    }).catch(failed('Could not save deck drawer state'))
  }

  const drawCards = (count: number) => {
    if (!state.deck || !counts) return toast.info('Pick a deck', 'Choose a card deck or set to draw from.')
    const picked = drawWeighted(entries, count, isDeck && state.consume)
    if (!picked.length) return toast.info('Deck is empty', 'Return cards from the tray or refill from a set.')
    if (isDeck && state.consume) {
      for (const cardName of picked) {
        void enqueue(() => engine('decks.take', { ref: { deck: state.deck }, card: cardName })).catch(failed('Could not draw from deck'))
      }
    }
    commit((prev) => ({
      ...prev,
      tray: [...picked.map((card) => ({ uid: makeUid(), card, faceUp: prev.faceUp })), ...prev.tray].slice(0, MAX_TRAY_CARDS)
    }))
    setTab('tray')
  }

  const flipAll = (up: boolean) => {
    commit((prev) => ({ ...prev, tray: prev.tray.map((item) => ({ ...item, faceUp: up })) }))
  }

  const shuffleTray = () => {
    commit((prev) => {
      const copy = [...prev.tray]
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      return { ...prev, tray: copy }
    })
  }

  const returnTrayCard = (item: DrawerCardEntry, toDeck: boolean) => {
    if (toDeck && isDeck && state.consume && state.deck) {
      void enqueue(() => engine('decks.add', { ref: { deck: state.deck }, card: item.card, by: 1 })).catch(failed('Could not return card to deck'))
    }
    commit((prev) => ({
      ...prev,
      tray: prev.tray.filter((x) => x.uid !== item.uid),
      discard: toDeck ? prev.discard : [item.card, ...prev.discard].slice(0, MAX_TRAY_CARDS)
    }))
  }

  const returnAllToDeck = () => {
    const items = [...latestRef.current.tray.map((t) => t.card), ...latestRef.current.discard]
    if (!items.length) return
    if (isDeck && state.consume && state.deck) {
      for (const cardName of items) {
        void enqueue(() => engine('decks.add', { ref: { deck: state.deck }, card: cardName, by: 1 })).catch(failed('Could not return cards to deck'))
      }
    }
    commit((prev) => ({ ...prev, tray: [], discard: [] }))
  }

  const returnDiscard = () => {
    const items = [...latestRef.current.discard]
    if (!items.length) return
    if (isDeck && state.consume && state.deck) {
      for (const cardName of items) {
        void enqueue(() => engine('decks.add', { ref: { deck: state.deck }, card: cardName, by: 1 })).catch(failed('Could not return discarded cards'))
      }
    }
    commit((prev) => ({ ...prev, discard: [] }))
  }

  const refillFromSet = (setId: string) => {
    if (!isDeck || !state.deck) return
    void enqueue(async () => {
      await engine('decks.addSet', { ref: { deck: state.deck }, set: setId })
      toast.success('Refilled deck', 'Added card set into the draw pile.')
    }).catch(failed('Could not refill deck'))
  }

  const moveTrayToHand = (item: DrawerCardEntry) => {
    if (!handRef) return
    void enqueue(() => engine('decks.add', { ref: handRef, card: item.card, by: 1 }))
      .then(() => playerHand?.refresh())
      .catch(failed('Could not move card to hand'))
    commit((prev) => ({ ...prev, tray: prev.tray.filter((x) => x.uid !== item.uid) }))
  }

  const moveHandToTray = (cardName: string) => {
    if (!handRef) return
    void enqueue(() => engine('decks.take', { ref: handRef, card: cardName }))
      .then(() => {
        playerHand?.refresh()
        commit((prev) => ({
          ...prev,
          tray: [{ uid: makeUid(), card: cardName, faceUp: true }, ...prev.tray].slice(0, MAX_TRAY_CARDS)
        }))
        setTab('tray')
      })
      .catch(failed('Could not move card to tray'))
  }

  const runPlay = async (card: Card, spendRef: DeckRef, temporary: boolean): Promise<boolean> => {
    const activeConv = focusedConversation() ?? openConversations()[0] ?? null
    const send = Boolean(activeConv && agent && activeConv.sessionId !== null && chatCanAnswer(agent))
    if (temporary) {
      await enqueue(() => engine('decks.add', { ref: spendRef, card: card.name, by: 1 }))
    }
    const chatSink = activeConv ? chatPlay(activeConv, card, send) : null
    const where: PlayWhere = {
      link: null,
      agents: agent ? [agent.id] : [],
      sheet: player,
      onText: chatSink?.text,
      surface: stageSurface(card, (outcome) => {
        chatSink?.done(outcome)
        playerHand?.refresh()
      })
    }
    const said = await playCard(card, spendRef, where)
    if (said === null) {
      if (temporary) {
        await enqueue(() => engine('decks.take', { ref: spendRef, card: card.name })).catch(failed('Could not restore unplayed card'))
      }
      return false
    }
    chatSink?.said(said)
    playerHand?.refresh()
    return true
  }

  const playFromTray = (item: DrawerCardEntry) => {
    const meta = cardById.get(toId(item.card))
    if (!meta || !handRef) return
    void engine('data.pages.find', { id: meta.id }).then(async (page) => {
      if (!page) return toast.error('Card not found', 'This card no longer exists.')
      const card = readCard(page.data, page.title)
      const ok = await runPlay(card, handRef, true)
      if (!ok) return
      commit((prev) => ({
        ...prev,
        tray: prev.tray.filter((x) => x.uid !== item.uid),
        discard: [item.card, ...prev.discard].slice(0, MAX_TRAY_CARDS)
      }))
    }, failed('Could not play card'))
  }

  const playFromHand = (card: Card) => {
    if (!handRef) return
    void runPlay(card, handRef, false)
  }

  const openSourcePicker = (e: MouseEvent) => {
    const items: MenuItem[] = [
      ...decks.map((d) => ({ label: `${showName(d.title)} · deck`, onSelect: () => commit((prev) => ({ ...prev, deck: d.id })) })),
      ...sets.map((s) => ({ label: `${showName(s.title)} · set`, onSelect: () => commit((prev) => ({ ...prev, deck: s.id })) }))
    ]
    openMenu(menuEventFrom(e), 'Draw from deck or set', items.length ? items : [{ label: 'No decks or sets yet', disabled: true, onSelect: () => undefined }])
  }

  const openReturnMenu = (e: MouseEvent) => {
    const linkedSet = counts && typeof counts.from === 'string' && counts.from ? counts.from : null
    const items: MenuItem[] = [
      ...(state.tray.length || state.discard.length
        ? [{ label: isDeck && state.consume ? 'Return tray & discard to deck' : 'Clear tray & discard', icon: <RotateCcw />, onSelect: returnAllToDeck }]
        : []),
      ...(state.discard.length ? [{ label: `Return discard (${state.discard.length})`, icon: <RotateCcw />, onSelect: returnDiscard }] : []),
      ...(state.tray.some((t) => !t.faceUp) ? [{ label: 'Flip all face-up', icon: <Eye />, onSelect: () => flipAll(true) }] : []),
      ...(state.tray.some((t) => t.faceUp) ? [{ label: 'Flip all face-down', icon: <EyeOff />, onSelect: () => flipAll(false) }] : []),
      ...(state.tray.length >= 2 ? [{ label: 'Shuffle tray', icon: <Shuffle />, onSelect: shuffleTray }] : []),
      ...(isDeck && linkedSet ? [{ label: 'Add linked set into deck', icon: <Layers />, onSelect: () => refillFromSet(linkedSet) }] : []),
      ...(isDeck && sets.length
        ? [
            {
              label: 'Refill from set',
              icon: <Layers />,
              children: sets.map((s) => ({ label: showName(s.title), onSelect: () => refillFromSet(s.id) }))
            }
          ]
        : [])
    ]
    openMenu(menuEventFrom(e), 'Deck actions', items.length ? items : [{ label: 'Nothing to return yet', disabled: true, onSelect: () => undefined }])
  }

  const openTrayCardMenu = (e: MouseEvent, item: DrawerCardEntry, cardId: string | null) => {
    const actions: MenuItem[] = [
      ...(cardId ? [{ label: 'Play in chat', icon: <Play />, disabled: running, onSelect: () => playFromTray(item) }] : []),
      { label: item.faceUp ? 'Flip face-down' : 'Flip face-up', icon: item.faceUp ? <EyeOff /> : <Eye />, onSelect: () => commit((prev) => ({ ...prev, tray: prev.tray.map((x) => (x.uid === item.uid ? { ...x, faceUp: !x.faceUp } : x)) })) },
      ...(handRef ? [{ label: 'Keep in player hand', icon: <ArrowDownToLine />, onSelect: () => moveTrayToHand(item) }] : []),
      { label: isDeck && state.consume ? 'Return to draw deck' : 'Remove from tray', icon: <RotateCcw />, onSelect: () => returnTrayCard(item, true) },
      { label: 'Discard', icon: <Trash2 />, onSelect: () => returnTrayCard(item, false) }
    ]
    if (cardId) entryMenuAt(e, 'card', cardId, item.card, actions)
    else openMenu(e, showName(item.card), actions)
  }

  const openHandCardMenu = (e: MouseEvent, cardId: string, cardName: string) => {
    entryMenuAt(e, 'card', cardId, cardName, [
      { label: 'Put 1 onto tray', icon: <Layers />, onSelect: () => moveHandToTray(cardName) },
      ...(isDeck && state.consume
        ? [
            {
              label: 'Move 1 back into draw deck',
              icon: <RotateCcw />,
              onSelect: () => {
                if (!handRef || !state.deck) return
                void enqueue(async () => {
                  await engine('decks.take', { ref: handRef, card: cardName })
                  await engine('decks.add', { ref: { deck: state.deck }, card: cardName, by: 1 })
                  playerHand?.refresh()
                }).catch(failed('Could not return card to deck'))
              }
            }
          ]
        : [])
    ])
  }

  const hasHidden = state.tray.some((t) => !t.faceUp)

  return (
    <div className="@container flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5">
        <DeckSourcePill label={sourcePage ? showName(sourcePage.title) : 'Pick deck'} remaining={remaining} isSet={isSet} onPick={openSourcePicker} />
        {state.discard.length > 0 && (
          <button
            type="button"
            onClick={returnDiscard}
            title="Click to reclaim discard pile back to deck"
            className="border border-line/50 bg-black/35 px-1.5 py-0.5 font-mono text-[10px] text-dim hover:border-accent hover:text-accent"
          >
            Discard {state.discard.length}
          </button>
        )}
        <span className="flex-1" />
        <div className="flex items-center border border-line/50 bg-black/40 p-0.5 font-mono text-[10px] uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setTab('tray')}
            className={cn('px-1.5 py-0.5 transition-colors', activeTab === 'tray' ? 'bg-accent/20 text-accent' : 'text-dim hover:text-white')}
          >
            Tray ({state.tray.length})
          </button>
          {state.showHand && (
            <button
              type="button"
              onClick={() => setTab('hand')}
              className={cn('px-1.5 py-0.5 transition-colors', activeTab === 'hand' ? 'bg-teal/20 text-teal' : 'text-dim hover:text-white')}
            >
              Hand ({handCount})
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden @[340px]:flex-row">
        <DrawPedestal
          hasDeck={Boolean(sourcePage)}
          isSet={isSet}
          remaining={remaining}
          faceUp={state.faceUp}
          onDraw={drawCards}
          onToggleFaceUp={() => commit((prev) => ({ ...prev, faceUp: !prev.faceUp }))}
          onReturnMenu={openReturnMenu}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden border border-line/35 bg-black/25 p-2">
          {activeTab === 'tray' && (
            <>
              {state.tray.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 border-b border-line/30 pb-1 font-mono text-[10px] text-dim">
                  <span>{state.tray.length} drawn</span>
                  <span className="flex-1" />
                  {hasHidden && (
                    <button type="button" onClick={() => flipAll(true)} className="text-accent hover:underline">
                      Reveal all
                    </button>
                  )}
                  <button type="button" onClick={shuffleTray} className="hover:text-white">
                    Shuffle
                  </button>
                  <button type="button" onClick={returnAllToDeck} className="hover:text-alert">
                    Return all
                  </button>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
                {state.tray.length ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(5.75rem,1fr))] gap-2">
                    {state.tray.map((item) => {
                      const meta = cardById.get(toId(item.card)) ?? null
                      return (
                        <TrayCardTile
                          key={item.uid}
                          entry={item}
                          cardId={meta?.id ?? null}
                          disabled={running}
                          canKeepHand={Boolean(handRef)}
                          onFlip={() => commit((prev) => ({ ...prev, tray: prev.tray.map((x) => (x.uid === item.uid ? { ...x, faceUp: !x.faceUp } : x)) }))}
                          onPlay={() => playFromTray(item)}
                          onKeep={() => moveTrayToHand(item)}
                          onReturn={() => returnTrayCard(item, true)}
                          onMenu={(e) => openTrayCardMenu(e, item, meta?.id ?? null)}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex h-full min-h-20 flex-col items-center justify-center gap-1 text-center font-mono text-[11px] text-faint">
                    <span>Tray is clear</span>
                    <span className="text-[10px]">
                      {sourcePage ? 'Click the deck stack or Draw to deal cards here.' : 'Pick a deck or card set above to start drawing.'}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'hand' && (
            <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
              <HandTrayList
                handId={playerHand?.id ?? null}
                hasRef={Boolean(handRef)}
                entries={playerHand?.entries ?? []}
                disabled={running}
                onStartHand={() => {
                  if (!handRef) return
                  void engine('decks.find', { ref: handRef, make: true }).then(() => playerHand?.refresh(), failed('Could not create player hand'))
                }}
                onPlayCard={playFromHand}
                onMoveToTray={moveHandToTray}
                onMenuCard={openHandCardMenu}
              />
            </div>
          )}
        </div>
      </div>

      {sourcePage && (
        <div className="flex items-center justify-between gap-2 font-mono text-[9.5px] text-faint">
          <button type="button" onClick={() => openEntry(isSet ? 'cards.set' : 'cards.deck', sourcePage.id)} className="truncate hover:text-accent">
            Open {showName(sourcePage.title)}
          </button>
          <span>{agent ? `${agent.name} · ${player ? showName(player) : 'player'}` : 'Tabletop mode'}</span>
        </div>
      )}
    </div>
  )
}

function DeckDrawerEditor({ source, onChange }: WidgetEditorProps) {
  const parsed = parseDrawerSource(source)
  const decks = useTypePages(DECK_TYPE)
  const sets = useTypePages(SET_TYPE)
  const options = [
    ...decks.map((d) => ({ value: d.id, label: `${showName(d.title)} (deck)` })),
    ...sets.map((s) => ({ value: s.id, label: `${showName(s.title)} (set)` }))
  ]

  return (
    <div className="flex flex-col gap-3">
      <Field label="Draw source">
        <Select
          value={parsed.deck}
          options={[{ value: '', label: 'None (pick in drawer)' }, ...options]}
          onChange={(deck) => onChange(toWidgetSource({ ...parsed, deck }))}
        />
      </Field>
      <div className="flex flex-wrap gap-4 pt-1">
        <Toggle checked={parsed.faceUp} onChange={(faceUp) => onChange(toWidgetSource({ ...parsed, faceUp }))} label="Draw face-up" />
        <Toggle checked={parsed.consume} onChange={(consume) => onChange(toWidgetSource({ ...parsed, consume }))} label="Remove drawn cards from deck" />
        <Toggle checked={parsed.showHand} onChange={(showHand) => onChange(toWidgetSource({ ...parsed, showHand }))} label="Show player hand tab" />
      </div>
      {(parsed.tray.length > 0 || parsed.discard.length > 0) && (
        <div>
          <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => onChange(toWidgetSource({ ...parsed, tray: [], discard: [] }))}>
            Clear tray & discard ({parsed.tray.length + parsed.discard.length})
          </Button>
        </div>
      )}
    </div>
  )
}

registerWidgetUi('deck_drawer', {
  Body: DeckDrawerBody,
  Editor: DeckDrawerEditor,
  blank: (info) =>
    toWidgetSource({
      deck: info.choices?.[0]?.id ?? '',
      faceUp: true,
      consume: true,
      showHand: true,
      tray: [],
      discard: []
    }),
  createIcon: <Layers className="h-3.5 w-3.5 text-dim" />,
  choices: {
    heading: 'Live deck drawers',
    meta: 'deck drawer',
    icon: <Layers className="h-3.5 w-3.5 text-dim" />,
    source: (id): WidgetSource =>
      toWidgetSource({
        deck: id,
        faceUp: true,
        consume: true,
        showHand: true,
        tray: [],
        discard: []
      })
  },
  entry: (source) => {
    const deck = typeof source.deck === 'string' ? source.deck : ''
    if (!deck) return null
    const meta = useData.getState().pages.find((p) => p.id === deck)
    if (!meta) return null
    return `${meta.type === SET_TYPE ? 'cards.set' : 'cards.deck'}/${meta.id}`
  }
})

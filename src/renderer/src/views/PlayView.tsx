import { useState, useEffect, useMemo } from 'react'
import { Copy, Play, Plus, Save, Sliders, User } from 'lucide-react'
import { WorldPlay } from '../components/worlds/WorldPlay'
import { AdventureIntro } from '../components/play/AdventureIntro'
import { useLive } from '../lib/useLive'
import { engine } from '../lib/ipc'
import { askText, Button, EmptyState, Modal, StatusBadge, Select } from '../components/ui'
import { useDialogue } from '../components/play/dialogue/dialogueStore'
import { useWorldSaves } from '../components/play/useSaves'
import { useWorldPlayer } from '../components/play/useWorldPlayer'
import { SheetSelect } from '../components/data/sheet/SheetSelect'
import { EntryPicker } from '../components/library/EntryPicker'
import { bringHere } from '../components/play/bringHere'
import { cn } from '../lib/cn'
import { useOpenChat } from '../components/chat/useOpenChat'
import { useKindEntries } from '../views/data/useKindEntries'
import { cleanDnd } from '@shared/dnd'
import { PromptPeek } from '../components/chat/PromptPeek'
import { ContextMeter } from '../components/chat/ContextMeter'
import { DraftAgentSelect } from '../components/chat/DraftAgentSelect'
import { ChatSettings } from '../components/chat/ChatSettings'
import { BackdropButton } from '../components/backdrop/Backdrop'
import { GameplaySettingsModal } from '../components/play/settings/GameplaySettingsModal'
import { toast } from '../store/toasts'
import { failed } from '../lib/notify'

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return 'Never'
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function PlayView() {
  const chat = useOpenChat()
  const { conv, active, agent, agentId } = chat

  const worlds = useLive(() => engine('worlds.list'), 'worlds.changed') ?? []
  const [selectedWorld, setSelectedWorld] = useState<string | null>(null)
  const activeWorldId = selectedWorld ?? worlds[0]?.id ?? null

  const worldSaves = useWorldSaves(activeWorldId ?? '')
  const [confirmedSaveId, setConfirmedSaveId] = useState<string | null>(null)
  const [showNewAdventure, setShowNewAdventure] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  const worldPlayer = useWorldPlayer(activeWorldId)
  const [chosenPlayerId, setChosenPlayerId] = useState<string | null>(null)
  const [chosenPlayerTitle, setChosenPlayerTitle] = useState<string>('')
  const [showPlayerModal, setShowPlayerModal] = useState(false)

  const sheets = useKindEntries('sheet') ?? []
  const effectivePlayerId = chosenPlayerId || worldPlayer
  const activePlayerSheet = sheets.find((s) => s.id === effectivePlayerId)
  const currentPlayerTitle = activePlayerSheet?.title ?? (chosenPlayerTitle || (effectivePlayerId ? 'Player' : null))

  // Clean teardown on tab switch or unmount
  useEffect(() => {
    return () => {
      useDialogue.getState().closeDialogue()
    }
  }, [])

  // Sort saves: latest played first
  const sortedSaves = useMemo(() => {
    if (!worldSaves?.saves) return []
    return [...worldSaves.saves].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [worldSaves?.saves])

  const latestSave = sortedSaves[0] ?? null
  const currentSave = worldSaves?.saves.find((s) => s.id === (confirmedSaveId ?? worldSaves.current)) ?? latestSave

  // Keyboard shortcut: Enter on launcher starts the latest save
  useEffect(() => {
    if (confirmedSaveId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && latestSave) {
        e.preventDefault()
        void handleSelectSave(latestSave.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmedSaveId, latestSave, activeWorldId])

  const handleSelectSave = async (saveId: string) => {
    if (!activeWorldId) return
    try {
      await engine('saves.select', { world: activeWorldId, id: saveId })
      setConfirmedSaveId(saveId)
      setShowSaveModal(false)
    } catch (err) {
      failed('Could not select save')(err)
    }
  }

  const handleCreateNewSave = () => {
    setShowSaveModal(false)
    setConfirmedSaveId(null)
    setShowNewAdventure(true)
  }

  const handleQuickSave = () => {
    if (!currentSave) return
    toast.success('Game Saved', `Progress written to ${currentSave.name}.`)
  }

  const handleCopySave = () => {
    if (!activeWorldId || !currentSave) return
    askText('Save As Copy', 'New copy name', `${currentSave.name} copy`, (name) => {
      void engine('saves.create', { world: activeWorldId, name, copy: true })
        .then(() => {
          toast.success('Saved As', name)
        })
        .catch(failed('Could not copy save'))
    })
  }

  if (!worlds.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 bg-bg font-ui">
        <EmptyState title="No worlds created yet">
          Create a world in the Data tab first to play.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-bg font-ui select-none">
      {/* DIEGETIC TOP APP NAV BAR - SINGLE UNIFIED BAR */}
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-line tone-surface-60 px-3 text-[11px] z-40">
        {/* LEFT: PLAY BADGE, WORLD SELECTOR, INTENTIONAL SAVE PILL */}
        <div className="flex items-center gap-2.5">
          <span className="border border-secondary-ink/40 bg-secondary-ink/15 px-1.5 py-0.5 text-[9.5px] font-bold caps-5 text-secondary-ink">
            PLAY
          </span>
          <span className="text-line">|</span>
          {worlds.length > 1 ? (
            <Select
              value={activeWorldId ?? ''}
              options={worlds.map((w) => ({ value: w.id, label: `World: ${w.name}` }))}
              onChange={(val) => {
                setSelectedWorld(val)
                setConfirmedSaveId(null)
              }}
              className="h-6 text-[11px] w-48"
            />
          ) : (
            <span className="text-dim">
              World: <strong className="text-ink">{worlds[0]?.name}</strong>
            </span>
          )}

          {/* INTENTIONAL SAVE BUTTON */}
          {confirmedSaveId && currentSave && (
            <Button
              size="sm"
              variant="badge"
              icon={<Save className="h-3 w-3" />}
              onClick={() => setShowSaveModal(true)}
              className="h-6 px-2 text-[10.5px]"
              title="Click to manage saves or save game"
            >
              SAVE: {currentSave.name}
            </Button>
          )}

          {/* ACTIVE PLAYER SELECTOR BUTTON */}
          <Button
            size="sm"
            variant={worldPlayer ? 'secondary' : 'primary'}
            icon={<User className="h-3 w-3 text-accent" />}
            onClick={() => setShowPlayerModal(true)}
            className={cn(
              'h-6 px-2 text-[10.5px]',
              !worldPlayer && 'border-alert bg-alert/20 text-alert animate-pulse'
            )}
            title="Click to select or change active player character"
          >
            {currentPlayerTitle ? `PLAYER: ${currentPlayerTitle}` : '[ ! CHOOSE PLAYER ]'}
          </Button>

          {/* GAMEPLAY SETTINGS & KEYBINDS BUTTON */}
          <Button
            size="sm"
            variant="secondary"
            icon={<Sliders className="h-3 w-3 text-secondary-ink" />}
            onClick={() => setShowSettingsModal(true)}
            className="h-6 px-2 text-[10.5px]"
            title="Gameplay settings and keybinds"
          >
            SETTINGS
          </Button>
        </div>

        {/* RIGHT: AGENT, MODEL, CTX METER, CONTROLS */}
        <div className="flex items-center gap-2">
          <PromptPeek />
          <ContextMeter />
          {active ? (
            <ChatSettings
              agent={agent ?? null}
              side="bottom"
              align="end"
              trigger={
                <StatusBadge tone="idle" className="cursor-pointer text-secondary font-ui text-[11px] hover:border-accent hover:text-accent" title={`${agent?.name ?? 'Agent'} settings · Click or right-click`}>
                  {agent?.name ?? 'Agent'}
                </StatusBadge>
              }
            />
          ) : (
            <div className="w-36">
              <DraftAgentSelect conv={conv} agentId={agentId} />
            </div>
          )}
          <BackdropButton sessionId={conv.sessionId} />
        </div>
      </header>

      {/* NEW ADVENTURE QUICK-START INTRO (FRESH WORLD OR NEW SAVE) */}
      {!confirmedSaveId && (!latestSave || showNewAdventure) && activeWorldId && (
        <AdventureIntro
          world={worlds.find((w) => w.id === activeWorldId) ?? worlds[0]}
          latestSave={latestSave}
          saveCount={sortedSaves.length}
          onContinueSave={(id) => {
            setShowNewAdventure(false)
            void handleSelectSave(id)
          }}
          onStarted={(id) => {
            setShowNewAdventure(false)
            setConfirmedSaveId(id)
          }}
        />
      )}

      {/* SAVE LAUNCHER MODAL (OFFERS LAST PLAYED SAVE BEFORE STARTING) */}
      <Modal
        open={!confirmedSaveId && Boolean(latestSave) && !showNewAdventure}
        title="START ADVENTURE"
        onClose={() => {}}
        wide={false}
      >
        <div className="flex flex-col gap-3 font-ui">
          <div className="text-[12px] text-dim">
            World: <strong className="text-ink">{worlds.find((w) => w.id === activeWorldId)?.name ?? activeWorldId}</strong>
          </div>

          {/* START NEW ADVENTURE IF NO SAVES EXIST */}
          {!latestSave && (
            <div className="flex flex-col gap-3 border border-line/50 tone-card-60 p-4">
              <span className="text-[10px] font-bold caps-5 text-accent">
                Fresh World · Ready to Play
              </span>
              <p className="text-[12px] text-dim">
                Pick which character you are starting as. Your character token and interactive entities will spawn into this adventure.
              </p>

              {/* CHOOSE STARTING CHARACTER */}
              <div className="flex flex-col gap-1.5 border border-line/60 tone-panel-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold caps-5 text-accent">
                    SELECT YOUR STARTING CHARACTER
                  </span>
                  <span className="text-[10px] text-dim">{sheets.length} sheets in library</span>
                </div>
                {sheets.length > 0 ? (
                  <SheetSelect
                    value={effectivePlayerId}
                    onChange={(id, title) => {
                      setChosenPlayerId(id)
                      if (title) setChosenPlayerTitle(title)
                    }}
                    noneLabel="-- Choose a Character to Play --"
                    className="w-full text-[12px]"
                  />
                ) : (
                  <div className="flex items-center justify-between p-2 border border-alert/40 bg-alert/10 text-[11px] text-alert">
                    <span>No character sheets found. Create one first to play.</span>
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Plus className="h-3 w-3" />}
                      onClick={async () => {
                        const s = await engine('sheets.save', {
                          id: null,
                          title: 'Adventurer',
                          fields: [],
                          values: {},
                          dnd: cleanDnd({})
                        })
                        setChosenPlayerId(s.id)
                        setChosenPlayerTitle(s.title)
                        toast.success('Character Created', s.title)
                      }}
                    >
                      Quick Create
                    </Button>
                  </div>
                )}
              </div>

              <Button
                size="md"
                variant="primary"
                disabled={!effectivePlayerId}
                icon={<Play className="h-3.5 w-3.5 fill-current" />}
                onClick={async () => {
                  if (!activeWorldId) return
                  const charToPlay = effectivePlayerId
                  if (!charToPlay) {
                    toast.info('Select a Character', 'Please choose a character to play as first.')
                    return
                  }
                  try {
                    await engine('worlds.setPlayer', { id: activeWorldId, sheet: charToPlay })
                    const s = await engine('saves.create', { world: activeWorldId, name: 'Save 1', copy: false })
                    toast.success('Adventure Started', `Playing as ${currentPlayerTitle || 'Character'}`)
                    setConfirmedSaveId(s.id)
                  } catch (err) {
                    failed('Could not start adventure')(err)
                  }
                }}
                className="mt-1 w-full justify-center"
              >
                START NEW ADVENTURE
              </Button>
            </div>
          )}

          {/* RECOMMENDED LAST PLAYED SAVE */}
          {latestSave && (
            <div className="flex flex-col gap-2">
              <span className="text-[9.5px] font-bold caps-5 text-accent">
                CONTINUE ADVENTURE (LAST PLAYED)
              </span>
              <div className="flex flex-col gap-2 border border-accent/60 bg-accent/10 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-ink">{latestSave.name}</span>
                  <span className="text-[10px] text-dim">
                    Last played: {formatTimeAgo(latestSave.updatedAt)}
                  </span>
                </div>
                <div className="text-[11px] text-dim">
                  {latestSave.characters.length} character
                  {latestSave.characters.length === 1 ? '' : 's'} registered in save
                </div>

                {/* CHARACTER SELECTION FOR EXISTING SAVE */}
                <div className="flex flex-col gap-1 border border-line/40 tone-panel-40 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] font-bold caps-5 text-accent">
                      ACTIVE PLAYER CHARACTER
                    </span>
                    <span className="text-[9.5px] text-dim">Change character if desired</span>
                  </div>
                  <SheetSelect
                    value={effectivePlayerId}
                    onChange={(id, title) => {
                      setChosenPlayerId(id)
                      if (title) setChosenPlayerTitle(title)
                    }}
                    noneLabel="-- Select a Character --"
                    className="w-full text-[11px]"
                  />
                </div>

                <Button
                  size="md"
                  variant="primary"
                  icon={<Play className="h-3.5 w-3.5 fill-current" />}
                  onClick={async () => {
                    if (activeWorldId && effectivePlayerId) {
                      await engine('worlds.setPlayer', { id: activeWorldId, sheet: effectivePlayerId })
                      await bringHere(activeWorldId, effectivePlayerId)
                    }
                    void handleSelectSave(latestSave.id)
                  }}
                  className="mt-1 w-full"
                >
                  CONTINUE ADVENTURE (ENTER)
                </Button>
              </div>
            </div>
          )}

          {/* OTHER SAVES LIST */}
          {sortedSaves.length > 1 && (
            <div className="mt-2 flex flex-col gap-1.5">
              <span className="text-[9.5px] font-bold caps-5 text-faint">
                OTHER SAVES
              </span>
              <div className="flex max-h-[140px] flex-col gap-1 overflow-y-auto pr-1">
                {sortedSaves.slice(1).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between border border-line/60 tone-well-60 px-2.5 py-1.5 hover:border-line"
                  >
                    <div className="flex flex-col">
                      <span className="text-[11.5px] font-bold text-ink">{s.name}</span>
                      <span className="text-[9.5px] text-dim">{formatTimeAgo(s.updatedAt)}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleSelectSave(s.id)}
                      className="h-6 px-2 text-[10px]"
                    >
                      LOAD
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIONS FOOTER */}
          <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-3">
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={handleCreateNewSave}
            >
              NEW SAVE
            </Button>
          </div>
        </div>
      </Modal>

      {/* INTENTIONAL SAVE MANAGEMENT MODAL */}
      <Modal
        open={showSaveModal && Boolean(currentSave)}
        title="SAVE MANAGEMENT"
        onClose={() => setShowSaveModal(false)}
        wide={false}
      >
        {currentSave && (
          <div className="flex flex-col gap-3 font-ui">
            <div className="flex flex-col gap-1 border border-line/60 tone-panel-60 p-2.5">
              <span className="text-[9.5px] caps-5 text-faint">Active save</span>
              <div className="text-[13px] font-bold text-ink">{currentSave.name}</div>
              <div className="text-[10px] text-dim">
                Last updated: {formatTimeAgo(currentSave.updatedAt)} ·{' '}
                {currentSave.characters.length} character
                {currentSave.characters.length === 1 ? '' : 's'}
              </div>
            </div>

            {/* SAVE ACTIONS */}
            <div className="flex flex-col gap-1.5">
              <Button
                size="md"
                variant="primary"
                icon={<Save className="h-3.5 w-3.5" />}
                onClick={handleQuickSave}
                className="w-full"
              >
                QUICK SAVE PROGRESS
              </Button>

              <Button
                size="sm"
                variant="secondary"
                icon={<Copy className="h-3 w-3" />}
                onClick={handleCopySave}
                className="w-full"
              >
                SAVE AS NEW COPY...
              </Button>
            </div>

            {/* SWITCH SAVE WITH INTENTIONAL CONFIRMATION */}
            {sortedSaves.length > 1 && (
              <div className="mt-2 flex flex-col gap-1">
                <span className="text-[9.5px] caps-5 text-faint">
                  SWITCH SAVE (CONFIRMED LOAD)
                </span>
                <div className="flex max-h-[120px] flex-col gap-1 overflow-y-auto">
                  {sortedSaves
                    .filter((s) => s.id !== currentSave.id)
                    .map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between border border-line/60 tone-panel-60 px-2 py-1 text-[11px]"
                      >
                        <span className="text-ink">{s.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Switch to save "${s.name}"? Any unsaved changes in this session will be lost.`
                              )
                            ) {
                              void handleSelectSave(s.id)
                            }
                          }}
                          className="h-6 px-2 text-[10px] text-accent hover:text-ink"
                        >
                          LOAD
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* GAMEPLAY SETTINGS MODAL */}
      <GameplaySettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* SELECT PLAYER MODAL (ACCESSIBLE AT ANY TIME FROM HEADER) */}
      {showPlayerModal && (
        <Modal
          open={true}
          title="Select Active Player Character"
          onClose={() => setShowPlayerModal(false)}
        >
          <div className="flex flex-col gap-3 font-ui">
            <p className="text-[12px] text-dim">
              Choose which character you want to control in this world:
            </p>
            <EntryPicker
              kind="sheet"
              title="Select Character"
              inline
              onClose={() => setShowPlayerModal(false)}
              onPick={async (hit) => {
                setShowPlayerModal(false)
                if (!activeWorldId) return
                try {
                  await engine('worlds.setPlayer', { id: activeWorldId, sheet: hit.id })
                  if (confirmedSaveId) {
                    await bringHere(activeWorldId, hit.id)
                  }
                  setChosenPlayerId(hit.id)
                  setChosenPlayerTitle(hit.title)
                  toast.success('Player Selected', `Now playing as ${hit.title}`)
                } catch (err) {
                  failed('Could not set player')(err)
                }
              }}
            />
          </div>
        </Modal>
      )}

      {/* MAIN GAME EXPLORE VIEW (MOUNTED ONLY WHEN SAVE IS CONFIRMED) */}
      {confirmedSaveId && activeWorldId ? (
        <WorldPlay world={activeWorldId} />
      ) : (!latestSave || showNewAdventure) && activeWorldId ? null : (
        <div className="flex flex-1 items-center justify-center font-ui text-[12px] text-faint">
          Select a save file above to enter the game world.
        </div>
      )}
    </div>
  )
}

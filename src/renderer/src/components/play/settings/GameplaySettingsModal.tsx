import { useState, useEffect } from 'react'
import {
  Footprints,
  Keyboard,
  Monitor,
  RotateCcw,
  Sparkles
} from 'lucide-react'
import { useGameplaySettings } from './gameplaySettingsStore'
import { Modal, ShellTabs, Button } from '../../ui'

interface Props {
  open: boolean
  onClose: () => void
}

type TabType = 'controls' | 'keybinds' | 'display' | 'agent'

export function GameplaySettingsModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<TabType>('controls')
  const [listeningAction, setListeningAction] = useState<string | null>(null)

  const settings = useGameplaySettings((s) => s.settings)
  const update = useGameplaySettings((s) => s.update)
  const rebindKey = useGameplaySettings((s) => s.rebindKey)
  const resetDefaults = useGameplaySettings((s) => s.resetDefaults)

  // Listen for keypress when rebinding
  useEffect(() => {
    if (!listeningAction) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setListeningAction(null)
        return
      }
      const display = e.code.startsWith('Key')
        ? e.code.replace('Key', '')
        : e.code.startsWith('Digit')
        ? e.code.replace('Digit', '')
        : e.key.toUpperCase()
      rebindKey(listeningAction, e.code, display)
      setListeningAction(null)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [listeningAction, rebindKey])

  const keybindItems = [
    { id: 'sheet', label: 'Character Sheet', cat: 'Panels' },
    { id: 'inventory', label: 'Inventory / Bag', cat: 'Panels' },
    { id: 'spells', label: 'Spellbook / Abilities', cat: 'Panels' },
    { id: 'endTurn', label: 'End Combat Turn', cat: 'Combat' },
    { id: 'pause', label: 'Pause / Resume Clock', cat: 'Simulation' },
    { id: 'cancel', label: 'Cancel / Clear Target', cat: 'General' },
    { id: 'slot1', label: 'Action Slot 1', cat: 'Hotbar' },
    { id: 'slot2', label: 'Action Slot 2', cat: 'Hotbar' },
    { id: 'slot3', label: 'Action Slot 3', cat: 'Hotbar' },
    { id: 'slot4', label: 'Action Slot 4', cat: 'Hotbar' },
    { id: 'slot5', label: 'Action Slot 5', cat: 'Hotbar' },
    { id: 'slot6', label: 'Action Slot 6', cat: 'Hotbar' },
    { id: 'slot7', label: 'Action Slot 7', cat: 'Hotbar' },
    { id: 'slot8', label: 'Action Slot 8', cat: 'Hotbar' },
    { id: 'slot9', label: 'Action Slot 9', cat: 'Hotbar' }
  ]

  return (
    <Modal
      open={open}
      title="GAMEPLAY SETTINGS"
      onClose={onClose}
      wide
      footer={
        <Button variant="primary" size="sm" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-4 font-mono select-none">
        <ShellTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'controls', label: 'Controls & Mouse', icon: <Footprints className="h-3.5 w-3.5" /> },
            { value: 'keybinds', label: 'Keybinds', icon: <Keyboard className="h-3.5 w-3.5" /> },
            { value: 'display', label: 'Display & HUD', icon: <Monitor className="h-3.5 w-3.5" /> },
            { value: 'agent', label: 'Rules & Agent', icon: <Sparkles className="h-3.5 w-3.5" /> }
          ]}
        />

        {/* TAB 1: CONTROLS & MOUSE */}
        {tab === 'controls' && (
          <div className="flex flex-col gap-3">
            <div className="border border-line/60 bg-black/60 p-3">
              <span className="font-bold text-white">PRIMARY MOUSE MOVEMENT</span>
              <p className="mt-1 text-[11px] leading-relaxed text-dim">
                In CRPG and tabletop tactical games, Left Click is reserved for selecting,
                inspecting, and targeting. Right Click executes character movement.
              </p>
              <div className="mt-2.5 flex gap-2">
                <Button
                  size="sm"
                  variant={settings.mouseMoveButton === 'right' ? 'badge' : 'secondary'}
                  onClick={() => update({ mouseMoveButton: 'right' })}
                >
                  RIGHT-CLICK MOVES (STANDARD)
                </Button>
                <Button
                  size="sm"
                  variant={settings.mouseMoveButton === 'left' ? 'badge' : 'secondary'}
                  onClick={() => update({ mouseMoveButton: 'left' })}
                >
                  LEFT-CLICK MOVES
                </Button>
              </div>
            </div>

            {/* FORCE MOVE MODIFIER */}
            <div className="border border-line/60 bg-black/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white">FORCE MOVE MODIFIER (SHIFT)</span>
                  <p className="text-[11px] text-dim">
                    Holding Shift + Right Click moves directly to that spot, ignoring targets,
                    objects, and interaction context menus.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.shiftForceMove}
                  onChange={(e) => update({ shiftForceMove: e.target.checked })}
                  className="h-4 w-4 accent-accent cursor-pointer"
                />
              </div>
            </div>

            {/* INTERACTION RANGE */}
            <div className="border border-line/60 bg-black/60 p-3">
              <span className="font-bold text-white">SMART INTERACTION APPROACH</span>
              <p className="mt-0.5 text-[11px] text-dim">
                When choosing an action from an interaction menu (Talk, Open, Loot), your
                character automatically pathfinds within 5 ft reach before executing the action.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="border border-accent/60 bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
                  5 FEET (ADJACENT TILE)
                </span>
              </div>
            </div>

            {/* CAMERA FOLLOW */}
            <div className="border border-line/60 bg-black/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white">CAMERA FOLLOW PLAYER</span>
                  <p className="text-[11px] text-dim">
                    Keep the camera centered on your active character during movement.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.cameraFollow}
                  onChange={(e) => update({ cameraFollow: e.target.checked })}
                  className="h-4 w-4 accent-accent cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: KEYBINDS */}
        {tab === 'keybinds' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-line/60 pb-1.5 text-[10px] uppercase tracking-wider text-faint">
              <span>ACTION &amp; SHORTCUT</span>
              <span>ASSIGNED KEY</span>
            </div>

            <div className="flex flex-col divide-y divide-line/30 max-h-[340px] overflow-y-auto pr-1">
              {keybindItems.map((item) => {
                const currentBind = settings.keybinds[item.id] ?? {
                  code: '',
                  display: '-'
                }
                const isListening = listeningAction === item.id
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 text-[11.5px]"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">{item.label}</span>
                      <span className="text-[9.5px] uppercase tracking-wider text-dim">
                        {item.cat}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isListening ? (
                        <span className="border border-accent bg-accent/20 px-3 py-1 font-bold text-accent animate-pulse">
                          PRESS ANY KEY... (ESC CANCELS)
                        </span>
                      ) : (
                        <>
                          <span className="min-w-12 border border-line bg-black/60 px-2.5 py-1 text-center font-bold text-cyan">
                            {currentBind.display}
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setListeningAction(item.id)}
                            className="h-6 px-2 text-[10px]"
                          >
                            CHANGE
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-2 flex justify-start border-t border-line/60 pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={resetDefaults}
                icon={<RotateCcw className="h-3 w-3" />}
                className="text-faint hover:text-alert"
              >
                Reset to Defaults
              </Button>
            </div>
          </div>
        )}

        {/* TAB 3: DISPLAY & HUD */}
        {tab === 'display' && (
          <div className="flex flex-col gap-3">
            <div className="border border-line/60 bg-black/60 p-3">
              <span className="font-bold text-white">AMBIENT HUD IDLE TRANSPARENCY</span>
              <p className="mt-0.5 text-[11px] text-dim">
                How translucent dialogue overlays and narration appear when idle.
              </p>
              <div className="mt-2.5 flex items-center gap-3">
                <input
                  type="range"
                  min={20}
                  max={80}
                  step={5}
                  value={settings.ambientOpacity}
                  onChange={(e) => update({ ambientOpacity: Number(e.target.value) })}
                  className="flex-1 accent-accent"
                />
                <span className="w-12 border border-line bg-black/60 px-2 py-0.5 text-center font-bold text-cyan">
                  {settings.ambientOpacity}%
                </span>
              </div>
            </div>

            <div className="border border-line/60 bg-black/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white">SPEECH BUBBLES ALWAYS WIDE</span>
                  <p className="text-[11px] text-dim">
                    Render in-world speech bubbles in wide horizontal format by default.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.bubbleWideDefault}
                  onChange={(e) => update({ bubbleWideDefault: e.target.checked })}
                  className="h-4 w-4 accent-accent cursor-pointer"
                />
              </div>
            </div>

            <div className="border border-line/60 bg-black/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white">SHOW COMBAT TURN STRIP</span>
                  <p className="text-[11px] text-dim">
                    Display initiative turn order and action economy bar during combat.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showCombatQueue}
                  onChange={(e) => update({ showCombatQueue: e.target.checked })}
                  className="h-4 w-4 accent-accent cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RULES & AGENT */}
        {tab === 'agent' && (
          <div className="flex flex-col gap-3">
            <div className="border border-line/60 bg-black/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white">AUTO-PAUSE ON DIALOGUE</span>
                  <p className="text-[11px] text-dim">
                    Pause real-time world simulation when an NPC speaks or a decision is required.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoPauseOnDialogue}
                  onChange={(e) => update({ autoPauseOnDialogue: e.target.checked })}
                  className="h-4 w-4 accent-accent cursor-pointer"
                />
              </div>
            </div>

            <div className="border border-line/60 bg-black/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white">CHARACTER SHEET GROUNDING</span>
                  <p className="text-[11px] text-dim">
                    Inject full character sheets (Identity, Motivations, Speech, D&amp;D Stats)
                    into the LLM agent system prompt.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.characterSheetGrounding}
                  onChange={(e) => update({ characterSheetGrounding: e.target.checked })}
                  className="h-4 w-4 accent-accent cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

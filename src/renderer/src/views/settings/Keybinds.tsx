import { useEffect, useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { Button, SettingCard, SettingRow } from '../../components/ui'
import { useGameplaySettings } from '../../components/play/settings/gameplaySettingsStore'
import {
  KEYBIND_DEFS,
  keybindFromEvent,
  specEquals,
  useKeybinds,
  type KeybindGroup,
  type KeybindSpec
} from '../../store/keybinds'

const GROUP_TITLES: { group: KeybindGroup; title: string }[] = [
  { group: 'app', title: 'App and navigation' },
  { group: 'chat', title: 'Chat and commands' },
  { group: 'tabletop', title: 'Tabletop and SurfaceTops' },
  { group: 'files', title: 'Files and picture viewer' },
  { group: 'tactical', title: 'Tactical Play and targets' },
  { group: 'effects', title: 'Effects editor' }
]

const GAMEPLAY_KEYBIND_ITEMS: { id: string; label: string; hint: string; def: string }[] = [
  { id: 'sheet', label: 'Character Sheet', hint: 'Open or toggle the active character sheet in Play.', def: 'C' },
  { id: 'inventory', label: 'Inventory / Bag', hint: 'Open your character inventory panel.', def: 'I' },
  { id: 'spells', label: 'Spellbook / Abilities', hint: 'Open spells and abilities.', def: 'K' },
  { id: 'endTurn', label: 'End Combat Turn', hint: 'Finish the active player combat turn.', def: 'Space' },
  { id: 'pause', label: 'Pause / Resume Clock', hint: 'Pause or resume world time in Play.', def: 'P' },
  { id: 'cancel', label: 'Cancel / Clear Target', hint: 'Clear targeting or current Play selection.', def: 'Esc' },
  { id: 'slot1', label: 'Action Slot 1', hint: 'Activate Play hotbar slot 1.', def: '1' },
  { id: 'slot2', label: 'Action Slot 2', hint: 'Activate Play hotbar slot 2.', def: '2' },
  { id: 'slot3', label: 'Action Slot 3', hint: 'Activate Play hotbar slot 3.', def: '3' },
  { id: 'slot4', label: 'Action Slot 4', hint: 'Activate Play hotbar slot 4.', def: '4' },
  { id: 'slot5', label: 'Action Slot 5', hint: 'Activate Play hotbar slot 5.', def: '5' },
  { id: 'slot6', label: 'Action Slot 6', hint: 'Activate Play hotbar slot 6.', def: '6' },
  { id: 'slot7', label: 'Action Slot 7', hint: 'Activate Play hotbar slot 7.', def: '7' },
  { id: 'slot8', label: 'Action Slot 8', hint: 'Activate Play hotbar slot 8.', def: '8' },
  { id: 'slot9', label: 'Action Slot 9', hint: 'Activate Play hotbar slot 9.', def: '9' }
]

function KeyCap({ children, dimmed = false }: { children: string; dimmed?: boolean }) {
  return (
    <kbd
      className={
        dimmed
          ? 'inline-flex min-w-7 items-center justify-center border border-dashed border-line px-2 py-0.5 font-ui text-[11px] text-dim'
          : 'inline-flex min-w-7 items-center justify-center border border-line tone-well-70 px-2 py-0.5 font-ui text-[11.5px] font-semibold text-accent shadow-[0_1px_0_color-mix(in_srgb,var(--color-ink)_6%,transparent)]'
      }
    >
      {children}
    </kbd>
  )
}

function KeyBadge({ spec }: { spec: KeybindSpec }) {
  if (!spec.code) return <KeyCap dimmed>Unbound</KeyCap>
  return (
    <span className="inline-flex items-center gap-1">
      {spec.display.split('+').map((part, idx) => (
        <span key={`${spec.display}:${idx}`} className="inline-flex items-center gap-1">
          {idx > 0 && <span className="font-ui text-[10px] text-dim">+</span>}
          <KeyCap>{part}</KeyCap>
        </span>
      ))}
    </span>
  )
}

export function Keybinds() {
  const bindings = useKeybinds((s) => s.bindings)
  const setBinding = useKeybinds((s) => s.setBinding)
  const clearBinding = useKeybinds((s) => s.clearBinding)
  const resetBinding = useKeybinds((s) => s.resetBinding)
  const resetAll = useKeybinds((s) => s.resetAll)

  const gameplay = useGameplaySettings((s) => s.settings)
  const rebindGameplay = useGameplaySettings((s) => s.rebindKey)
  const resetGameplay = useGameplaySettings((s) => s.resetDefaults)

  const [listening, setListening] = useState<{ kind: 'app' | 'play'; id: string } | null>(null)

  useEffect(() => {
    if (!listening) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const parsed = keybindFromEvent(e)
      if (parsed === 'cancel') {
        setListening(null)
        return
      }
      if (!parsed) return

      if (listening.kind === 'app') {
        setBinding(listening.id, parsed)
      } else {
        const display = e.code.startsWith('Key')
          ? e.code.replace('Key', '')
          : e.code.startsWith('Digit')
            ? e.code.replace('Digit', '')
            : e.key.toUpperCase()
        rebindGameplay(listening.id, e.code, display)
      }
      setListening(null)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [listening, setBinding, rebindGameplay])

  return (
    <>
      {GROUP_TITLES.map(({ group, title }) => {
        const items = KEYBIND_DEFS.filter((d) => d.group === group)
        return (
          <SettingCard key={group} title={title}>
            {items.map((def) => {
              const current = bindings[def.id] ?? def.defaultSpec
              const isRecording = listening?.kind === 'app' && listening.id === def.id
              const modified = !specEquals(current, def.defaultSpec)
              return (
                <SettingRow key={def.id} label={def.label} hint={def.hint}>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {isRecording ? (
                      <>
                        <span className="border border-accent bg-accent/15 px-3 py-1 font-ui text-[11.5px] font-bold text-accent animate-pulse">
                          Press keys… (Esc cancels)
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => setListening(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <KeyBadge spec={current} />
                        <Button size="sm" variant="secondary" onClick={() => setListening({ kind: 'app', id: def.id })}>
                          Change
                        </Button>
                        {current.code && (
                          <Button size="sm" variant="ghost" title="Clear shortcut" icon={<X />} onClick={() => clearBinding(def.id)} />
                        )}
                        {modified && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title={`Reset to ${def.defaultSpec.display}`}
                            icon={<RotateCcw />}
                            onClick={() => resetBinding(def.id)}
                          />
                        )}
                      </>
                    )}
                  </div>
                </SettingRow>
              )
            })}
          </SettingCard>
        )
      })}

      <SettingCard title="Play (panels, combat and hotbar)">
        {GAMEPLAY_KEYBIND_ITEMS.map((item) => {
          const bind = gameplay.keybinds[item.id] ?? { code: '', display: '-' }
          const isRecording = listening?.kind === 'play' && listening.id === item.id
          return (
            <SettingRow key={item.id} label={item.label} hint={item.hint}>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {isRecording ? (
                  <>
                    <span className="border border-accent bg-accent/15 px-3 py-1 font-ui text-[11.5px] font-bold text-accent animate-pulse">
                      Press any key… (Esc cancels)
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setListening(null)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <KeyCap dimmed={!bind.code}>{bind.display}</KeyCap>
                    <Button size="sm" variant="secondary" onClick={() => setListening({ kind: 'play', id: item.id })}>
                      Change
                    </Button>
                  </>
                )}
              </div>
            </SettingRow>
          )
        })}
      </SettingCard>

      <SettingCard title="Reset">
        <SettingRow label="Reset all keybinds" hint="Restore every app, chat, tabletop, viewer, tactical, effects, and Play keybind back to defaults.">
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw />}
            onClick={() => {
              resetAll()
              resetGameplay()
            }}
          >
            Reset all defaults
          </Button>
        </SettingRow>
      </SettingCard>
    </>
  )
}

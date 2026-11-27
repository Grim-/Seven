import { create } from 'zustand'
import { forgetStored, readStored, writeStored } from '../lib/stored'

export interface KeybindSpec {
  code: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  display: string
}

export type KeybindGroup = 'app' | 'chat' | 'tabletop' | 'files' | 'tactical' | 'effects'

export interface KeybindDef {
  id: string
  group: KeybindGroup
  label: string
  hint: string
  defaultSpec: KeybindSpec
}

const KEY_LABELS: Record<string, string> = {
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Del',
  Escape: 'Esc',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/'
}

const MODIFIER_CODES = new Set([
  'ControlLeft',
  'ControlRight',
  'ShiftLeft',
  'ShiftRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight'
])

export const KEYBIND_DEFS: KeybindDef[] = [
  // App and navigation
  { id: 'app.search', group: 'app', label: 'Search everything', hint: 'Open the command and library search palette.', defaultSpec: { code: 'KeyK', ctrl: true, display: 'Ctrl+K' } },
  { id: 'app.playMode', group: 'app', label: 'Toggle Play / Chat view', hint: 'Switch between Chat and Play.', defaultSpec: { code: 'KeyG', ctrl: true, shift: true, display: 'Ctrl+Shift+G' } },
  { id: 'app.plainLook', group: 'app', label: 'Seven theme', hint: 'Switch to the Seven theme, and back again, without opening Settings.', defaultSpec: { code: 'Digit0', ctrl: true, alt: true, display: 'Ctrl+Alt+0' } },
  { id: 'app.settingsSearch', group: 'app', label: 'Focus Settings search', hint: 'Focus the search box inside Settings.', defaultSpec: { code: 'Slash', display: '/' } },

  // Chat and commands
  { id: 'chat.cycleMode', group: 'chat', label: 'Chat view mode overview', hint: 'Open or close the chat view mode switcher (Default, Tabletop, Cinema) outside text inputs.', defaultSpec: { code: 'KeyV', shift: true, display: 'Shift+V' } },
  { id: 'chat.cinema', group: 'chat', label: 'Toggle Cinema view', hint: 'Enter or leave full-screen Cinema chat directly.', defaultSpec: { code: 'KeyF', ctrl: true, shift: true, display: 'Ctrl+Shift+F' } },
  { id: 'chat.stop', group: 'chat', label: 'Stop response', hint: 'Abort the running agent response in the active chat.', defaultSpec: { code: 'Escape', shift: true, display: 'Shift+Esc' } },

  // Tabletop and SurfaceTops
  { id: 'tabletop.surfaceSwitcher', group: 'tabletop', label: 'SurfaceTop overview', hint: 'Open or close the SurfaceTop switcher map.', defaultSpec: { code: 'Space', ctrl: true, display: 'Ctrl+Space' } },
  { id: 'tabletop.focusSlate', group: 'tabletop', label: 'Focus / maximize hovered slate', hint: 'Maximize the slate under your mouse cursor, or return it back when already maximized.', defaultSpec: { code: 'KeyF', display: 'F' } },

  // Files and viewer
  { id: 'files.parentFolder', group: 'files', label: 'Parent folder', hint: 'Go up one folder in the file explorer.', defaultSpec: { code: 'ArrowUp', alt: true, display: 'Alt+Up' } },
  { id: 'viewer.prev', group: 'files', label: 'Previous picture', hint: 'Step back in the fullscreen picture viewer.', defaultSpec: { code: 'ArrowLeft', display: 'Left' } },
  { id: 'viewer.next', group: 'files', label: 'Next picture', hint: 'Step forward in the fullscreen picture viewer.', defaultSpec: { code: 'ArrowRight', display: 'Right' } },
  { id: 'viewer.playPause', group: 'files', label: 'Play / pause slideshow', hint: 'Pause or resume timed slideshows in the picture viewer.', defaultSpec: { code: 'Space', display: 'Space' } },

  // Tactical Play and Target HUD
  { id: 'tactical.targetTalk', group: 'tactical', label: 'Talk to target', hint: 'Start dialogue with the selected target in Play.', defaultSpec: { code: 'KeyT', display: 'T' } },
  { id: 'tactical.targetApproach', group: 'tactical', label: 'Approach target', hint: 'Move toward the selected target in Play.', defaultSpec: { code: 'KeyA', display: 'A' } },
  { id: 'tactical.targetAttack', group: 'tactical', label: 'Attack / engage target', hint: 'Strike or start combat with the selected target.', defaultSpec: { code: 'KeyF', display: 'F' } },
  { id: 'tactical.dash', group: 'tactical', label: 'Combat Dash', hint: 'Use the Dash maneuver on your combat turn.', defaultSpec: { code: 'KeyC', display: 'C' } },
  { id: 'tactical.dodge', group: 'tactical', label: 'Combat Dodge', hint: 'Use the Dodge maneuver on your combat turn.', defaultSpec: { code: 'KeyZ', display: 'Z' } },
  { id: 'tactical.disengage', group: 'tactical', label: 'Combat Disengage', hint: 'Trigger Disengage hint on your combat turn.', defaultSpec: { code: 'KeyX', display: 'X' } },
  { id: 'tactical.parley', group: 'tactical', label: 'Combat Parley', hint: 'Open dialogue with your combat target.', defaultSpec: { code: 'KeyP', display: 'P' } },

  // Effects editor
  { id: 'effects.duplicate', group: 'effects', label: 'Duplicate effect piece', hint: 'Clone the selected effect piece in the Effects editor.', defaultSpec: { code: 'KeyD', ctrl: true, display: 'Ctrl+D' } },
  { id: 'effects.moveUp', group: 'effects', label: 'Move effect piece up', hint: 'Move the selected effect piece earlier.', defaultSpec: { code: 'ArrowUp', alt: true, display: 'Alt+Up' } },
  { id: 'effects.moveDown', group: 'effects', label: 'Move effect piece down', hint: 'Move the selected effect piece later.', defaultSpec: { code: 'ArrowDown', alt: true, display: 'Alt+Down' } },
  { id: 'effects.add', group: 'effects', label: 'Add effect piece', hint: 'Insert a new piece after the selected effect.', defaultSpec: { code: 'KeyA', display: 'A' } },
  { id: 'effects.delete', group: 'effects', label: 'Remove effect piece', hint: 'Delete the selected effect piece.', defaultSpec: { code: 'Delete', display: 'Del' } }
]

const DEF_MAP = new Map(KEYBIND_DEFS.map((d) => [d.id, d]))
const DEFAULTS: Record<string, KeybindSpec> = Object.fromEntries(KEYBIND_DEFS.map((d) => [d.id, d.defaultSpec]))
const STORAGE_KEY = 'seven.keybinds.v1'

function loadBindings(): Record<string, KeybindSpec> {
  const saved = readStored<Record<string, KeybindSpec> | null>(STORAGE_KEY, null)
  if (!saved || typeof saved !== 'object') return { ...DEFAULTS }
  return { ...DEFAULTS, ...saved }
}

function keyName(code: string, key: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^Numpad\d$/.test(code)) return `Num${code.slice(6)}`
  if (KEY_LABELS[code]) return KEY_LABELS[code]
  return key.length === 1 ? key.toUpperCase() : key
}

/**
 * Convert a keyboard event into a bindable KeybindSpec, or null if only modifiers were pressed.
 * Unmodified Escape is reserved to cancel recording (`false` signal handled by caller); modified Esc (e.g. Shift+Esc) is bindable.
 */
export function keybindFromEvent(e: KeyboardEvent): KeybindSpec | 'cancel' | null {
  if (MODIFIER_CODES.has(e.code)) return null
  const ctrl = Boolean(e.ctrlKey || e.metaKey)
  const shift = Boolean(e.shiftKey)
  const alt = Boolean(e.altKey)
  if (e.code === 'Escape' && !ctrl && !shift && !alt) return 'cancel'

  const parts = [ctrl ? 'Ctrl' : null, alt ? 'Alt' : null, shift ? 'Shift' : null, keyName(e.code, e.key)].filter(Boolean)
  return {
    code: e.code,
    ...(ctrl ? { ctrl: true } : {}),
    ...(shift ? { shift: true } : {}),
    ...(alt ? { alt: true } : {}),
    display: parts.join('+')
  }
}

export function specEquals(a: KeybindSpec, b: KeybindSpec): boolean {
  return (
    a.code === b.code &&
    Boolean(a.ctrl) === Boolean(b.ctrl) &&
    Boolean(a.shift) === Boolean(b.shift) &&
    Boolean(a.alt) === Boolean(b.alt)
  )
}

interface KeybindsState {
  bindings: Record<string, KeybindSpec>
  setBinding: (id: string, spec: KeybindSpec) => void
  clearBinding: (id: string) => void
  resetBinding: (id: string) => void
  resetAll: () => void
}

export const useKeybinds = create<KeybindsState>((set) => ({
  bindings: loadBindings(),
  setBinding: (id, spec) =>
    set((s) => {
      const next = { ...s.bindings, [id]: spec }
      writeStored(STORAGE_KEY, next)
      return { bindings: next }
    }),
  clearBinding: (id) =>
    set((s) => {
      const next = { ...s.bindings, [id]: { code: '', display: 'Unbound' } }
      writeStored(STORAGE_KEY, next)
      return { bindings: next }
    }),
  resetBinding: (id) =>
    set((s) => {
      const def = DEF_MAP.get(id)?.defaultSpec
      if (!def) return s
      const next = { ...s.bindings, [id]: def }
      writeStored(STORAGE_KEY, next)
      return { bindings: next }
    }),
  resetAll: () =>
    set(() => {
      forgetStored(STORAGE_KEY)
      return { bindings: { ...DEFAULTS } }
    })
}))

export function getKeybind(id: string): KeybindSpec {
  return useKeybinds.getState().bindings[id] ?? DEF_MAP.get(id)?.defaultSpec ?? { code: '', display: 'Unbound' }
}

export function useKeybindLabel(id: string): string {
  return useKeybinds((s) => s.bindings[id]?.display ?? DEF_MAP.get(id)?.defaultSpec.display ?? 'Unbound')
}

const FUNCTION_KEY = /^F([1-9]|1\d|2[0-4])$/

export function isFunctionKey(code: string): boolean {
  return FUNCTION_KEY.test(code)
}

/**
 * True when focus is inside a text/form input and the key should go to typing rather than triggering a keybind.
 * Function keys (F1-F24) do not insert characters and remain active even while an input is focused.
 */
export function isTypingTarget(e: Pick<KeyboardEvent, 'target' | 'code'>): boolean {
  if (isFunctionKey(e.code)) return false
  const el = e.target
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  return Boolean(el.closest('input, textarea, select'))
}

export function matchesKeybind(id: string, e: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): boolean {
  const spec = getKeybind(id)
  if (!spec.code) return false
  return (
    e.code === spec.code &&
    Boolean(spec.ctrl) === Boolean(e.ctrlKey || e.metaKey) &&
    Boolean(spec.shift) === Boolean(e.shiftKey) &&
    Boolean(spec.alt) === Boolean(e.altKey)
  )
}

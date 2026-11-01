import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { cleanBackdrop, cleanVoice, type AudioPrefs, type DropPrefs, type VoicePrefs, type ChatListPrefs, type ScreenPoint, type Settings, type SidePanelPrefs, type TrayPin, type ViewId } from '@shared/types'
import { dataDir } from './paths'

const VIEWS: ViewId[] = ['chat', 'dashboards', 'pages', 'data', 'composer', 'kinds', 'agents', 'tools', 'models', 'settings']

export const DEFAULT_HOTKEY = 'CommandOrControl+Shift+Space'

const DEFAULTS: Settings = {
  sidePanel: { open: false, width: 380, tab: 'files' },
  chatList: { open: true, width: 288 },
  dataList: { open: true, width: 288, closed: ['weblog', 'board'] },
  pagesWidth: 288,
  chatPictureHeight: 480,
  trayKinds: [],
  trayPins: [],
  avatarSize: 'small',
  backdrop: null,
  chatBackdrop: null,
  defaultTheme: 'seven',
  audio: { music: true, sounds: true, volume: 0.6 },
  voice: { on: true, fallback: null, piperPath: '', piperVoices: '' },
  modelFolders: [],
  ambientBackground: true,
  lastView: 'chat',
  overlayEnabled: true,
  hotkey: DEFAULT_HOTKEY,
  overlayPosition: null,
  startWithWindows: false,
  droppedPictures: { ask: true, folder: '' }
}

function point(value: unknown): ScreenPoint | null {
  if (!value || typeof value !== 'object') return null
  const { x, y } = value as Record<string, unknown>
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)
    ? { x: Math.round(x), y: Math.round(y) }
    : null
}

function sidePanel(value: unknown): SidePanelPrefs {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<SidePanelPrefs>
  return {
    open: typeof v.open === 'boolean' ? v.open : DEFAULTS.sidePanel.open,
    width: typeof v.width === 'number' && Number.isFinite(v.width) ? Math.round(Math.min(900, Math.max(280, v.width))) : DEFAULTS.sidePanel.width,
    tab: typeof v.tab === 'string' && /^[a-z][a-z0-9_:-]{0,63}$/.test(v.tab) ? v.tab : DEFAULTS.sidePanel.tab
  }
}

function chatList(value: unknown, fallback: ChatListPrefs = DEFAULTS.chatList): ChatListPrefs {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<ChatListPrefs>
  return {
    open: typeof v.open === 'boolean' ? v.open : fallback.open,
    width: typeof v.width === 'number' && Number.isFinite(v.width) ? Math.round(Math.min(560, Math.max(200, v.width))) : fallback.width,
    ...(Array.isArray(v.closed) ? { closed: v.closed.filter((c): c is string => typeof c === 'string').slice(0, 100) } : fallback.closed ? { closed: fallback.closed } : {}),
    ...(Array.isArray(v.shown) ? { shown: v.shown.filter((c): c is string => typeof c === 'string').slice(0, 100) } : {})
  }
}

function trayPins(value: unknown): TrayPin[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value
    .flatMap((v): TrayPin[] => {
      if (!v || typeof v !== 'object') return []
      const { kind, id, label, icon } = v as Record<string, unknown>
      if (typeof kind !== 'string' || !kind.trim() || typeof label !== 'string' || !label.trim()) return []
      const pin = { kind: kind.trim().slice(0, 64), id: typeof id === 'string' && id ? id.slice(0, 256) : null, label: label.trim().slice(0, 80), icon: typeof icon === 'string' && icon ? icon.slice(0, 40) : 'box' }
      const key = `${pin.kind}/${pin.id ?? ''}`
      if (seen.has(key)) return []
      seen.add(key)
      return [pin]
    })
    .slice(0, 24)
}

function audio(value: unknown): AudioPrefs {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<AudioPrefs>
  return {
    music: typeof v.music === 'boolean' ? v.music : DEFAULTS.audio.music,
    sounds: typeof v.sounds === 'boolean' ? v.sounds : DEFAULTS.audio.sounds,
    volume: typeof v.volume === 'number' && Number.isFinite(v.volume) ? Math.min(1, Math.max(0, v.volume)) : DEFAULTS.audio.volume
  }
}

function voice(value: unknown): VoicePrefs {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<VoicePrefs>
  return {
    on: typeof v.on === 'boolean' ? v.on : DEFAULTS.voice.on,
    fallback: cleanVoice(v.fallback),
    piperPath: typeof v.piperPath === 'string' ? v.piperPath.trim() : '',
    piperVoices: typeof v.piperVoices === 'string' ? v.piperVoices.trim() : ''
  }
}

function droppedPictures(value: unknown): DropPrefs {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<DropPrefs>
  return {
    ask: typeof v.ask === 'boolean' ? v.ask : DEFAULTS.droppedPictures.ask,
    folder: typeof v.folder === 'string' ? v.folder.trim() : DEFAULTS.droppedPictures.folder
  }
}

function sanitize(input: Partial<Settings>): Settings {
  return {
    chatList: chatList(input.chatList),
    dataList: chatList(input.dataList, DEFAULTS.dataList),
    trayPins: trayPins(input.trayPins),
    trayKinds: Array.isArray(input.trayKinds) ? [...new Set(input.trayKinds.filter((k): k is string => typeof k === 'string' && /^[\w:.-]{1,64}$/.test(k)))].slice(0, 30) : DEFAULTS.trayKinds,
    chatPictureHeight: typeof input.chatPictureHeight === 'number' && Number.isFinite(input.chatPictureHeight) && input.chatPictureHeight > 0 ? Math.round(input.chatPictureHeight) : DEFAULTS.chatPictureHeight,
    pagesWidth: typeof input.pagesWidth === 'number' && Number.isFinite(input.pagesWidth) ? Math.round(Math.min(640, Math.max(200, input.pagesWidth))) : DEFAULTS.pagesWidth,
    backdrop: cleanBackdrop(input.backdrop),
    chatBackdrop: cleanBackdrop(input.chatBackdrop),
    defaultTheme: typeof input.defaultTheme === 'string' && /^[\p{L}\p{N}-]{1,48}$/u.test(input.defaultTheme) ? input.defaultTheme : DEFAULTS.defaultTheme,
    audio: audio(input.audio),
    voice: voice(input.voice),
    avatarSize: input.avatarSize === 'medium' || input.avatarSize === 'large' ? input.avatarSize : 'small',
    sidePanel: sidePanel(input.sidePanel),
    modelFolders: Array.isArray(input.modelFolders)
      ? [...new Set(input.modelFolders.filter((f) => typeof f === 'string' && f.trim()))]
      : DEFAULTS.modelFolders,
    ambientBackground: typeof input.ambientBackground === 'boolean' ? input.ambientBackground : DEFAULTS.ambientBackground,
    lastView: input.lastView && VIEWS.includes(input.lastView) ? input.lastView : DEFAULTS.lastView,
    overlayEnabled: typeof input.overlayEnabled === 'boolean' ? input.overlayEnabled : DEFAULTS.overlayEnabled,
    hotkey: typeof input.hotkey === 'string' ? input.hotkey.trim() : DEFAULTS.hotkey,
    overlayPosition: point(input.overlayPosition),
    startWithWindows: typeof input.startWithWindows === 'boolean' ? input.startWithWindows : DEFAULTS.startWithWindows,
    droppedPictures: droppedPictures(input.droppedPictures)
  }
}

class SettingsStore extends EventEmitter {
  private file = path.join(dataDir, 'settings.json')
  private value: Settings

  constructor() {
    super()
    let raw: Partial<Settings> = {}
    try {
      raw = JSON.parse(fs.readFileSync(this.file, 'utf8'))
    } catch {
      raw = {}
    }
    this.value = sanitize(raw)
  }

  get(): Settings {
    return { ...this.value, modelFolders: [...this.value.modelFolders] }
  }

  set(patch: Partial<Settings>): Settings {
    this.value = sanitize({ ...this.value, ...patch })
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(this.file, JSON.stringify(this.value, null, 2), 'utf8')
    const next = this.get()
    this.emit('changed', next)
    return next
  }
}

export const settings = new SettingsStore()

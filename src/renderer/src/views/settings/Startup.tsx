import { useEffect, useState } from 'react'
import { Button, Input, SettingCard, SettingRow, Toggle } from '../../components/ui'
import { main } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { useApp } from '../../store/app'
import { cn } from '../../lib/cn'

const KEY_NAMES: Record<string, string> = {
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
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

export function acceleratorFrom(e: { code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }): string | null {
  let key: string | null = null
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3)
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5)
  else if (/^F([1-9]|1\d|2[0-4])$/.test(e.code)) key = e.code
  else if (/^Numpad\d$/.test(e.code)) key = `num${e.code.slice(6)}`
  else key = KEY_NAMES[e.code] ?? null
  if (!key) return null
  const mods = [e.ctrlKey || e.metaKey ? 'CommandOrControl' : null, e.altKey ? 'Alt' : null, e.shiftKey ? 'Shift' : null].filter(Boolean)
  if (!mods.length && !/^F\d+$/.test(key)) return null
  return [...mods, key].join('+')
}

function HotkeyField({ current }: { current: string }) {
  const [value, setValue] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)

  useEffect(() => setValue(current), [current])

  const apply = async (next: string) => {
    const result = await main('hotkey.set', { accelerator: next })
    setError(result.error)
    if (result.ok) toast.success('Hotkey updated', next || 'Hotkey turned off')
  }

  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code === 'Escape') {
        setRecording(false)
        return
      }
      const acc = acceleratorFrom(e)
      if (!acc) {
        if (!['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(e.code)) setError('Use Ctrl, Alt or Shift with a key, or an F key.')
        return
      }
      setRecording(false)
      setValue(acc)
      void apply(acc)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording])

  return (
    <SettingRow label="Hotkey" error={error} hint="Opens and closes the bar from anywhere. Press Record and then the keys, or type it (e.g. CommandOrControl+Shift+Space). Empty turns it off.">
      <div className="flex gap-2">
        <Input
          value={recording ? 'Press the keys… (Esc to cancel)' : value}
          readOnly={recording}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void apply(value)}
          className={cn('w-72 font-mono', recording && 'border-accent text-accent')}
        />
        <Button variant={recording ? 'primary' : 'secondary'} onClick={() => (setError(null), setRecording(!recording))}>
          {recording ? 'Cancel' : 'Record'}
        </Button>
        <Button variant="badge" onClick={() => void apply(value)} disabled={recording || value === current}>
          Apply
        </Button>
      </div>
    </SettingRow>
  )
}

export function Startup() {
  const settings = useApp((s) => s.settings)
  const updateSettings = useApp((s) => s.updateSettings)
  return (
    <>
      <SettingCard title="Startup">
        <SettingRow label="Start with Windows" hint="Starts Seven hidden in the tray when you sign in. Only applies to the installed build.">
          <Toggle checked={settings?.startWithWindows ?? false} onChange={(v) => void updateSettings({ startWithWindows: v })} label={settings?.startWithWindows ? 'On' : 'Off'} />
        </SettingRow>
      </SettingCard>
      <SettingCard title="Overlay and hotkey">
        <SettingRow label="Show overlay" hint="The always-on-top button that opens the chat bar.">
          <Toggle checked={settings?.overlayEnabled ?? true} onChange={(v) => void updateSettings({ overlayEnabled: v })} label={settings?.overlayEnabled ? 'On' : 'Off'} />
        </SettingRow>
        <HotkeyField current={settings?.hotkey ?? ''} />
        <SettingRow label="Button position" hint="Moves the overlay button back to the bottom-right corner of the main screen, for when it ends up somewhere you can't reach.">
          <Button variant="secondary" onClick={() => void main('overlay.resetPosition').then(() => toast.success('Overlay moved back'))}>
            Reset position
          </Button>
        </SettingRow>
      </SettingCard>
    </>
  )
}

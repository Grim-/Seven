import type { ReactNode } from 'react'
import type { NetworkSettings } from '@shared/types'
import { Fold, Input, NumberField, SaveState, SettingCard, SettingGrid, SettingRow, Toggle, type AutosavedState } from '../../ui'

type NumberKey = { [K in keyof NetworkSettings]: NetworkSettings[K] extends number ? K : never }[keyof NetworkSettings]

interface NumberSetting {
  key: NumberKey
  label: string
  hint: string
  min: number
  max: number
}

interface Group {
  title: string
  numbers: NumberSetting[]
  extra?: (s: NetworkSettings, change: (patch: Partial<NetworkSettings>) => void) => ReactNode
}

const GROUPS: Group[] = [
  {
    title: 'Access',
    numbers: [
      { key: 'port', label: 'Port', hint: 'The port devices and programs connect to.', min: 1, max: 65535 },
      { key: 'maxFailures', label: 'Wrong passwords before lockout', hint: 'A device that gets the password wrong this many times in a row is locked out.', min: 1, max: 1000 },
      { key: 'lockMinutes', label: 'Lockout minutes', hint: 'How long a locked-out device must wait. You can unlock it sooner from the list of programs.', min: 0, max: 525600 }
    ],
    extra: (s, change) => (
      <SettingRow label="Only my local network" hint="Refuses any device whose address is not a private network address (10.x, 172.16-31.x, 192.168.x, link-local).">
        <Toggle checked={s.privateOnly} onChange={(privateOnly) => change({ privateOnly })} label={s.privateOnly ? 'On' : 'Off'} />
      </SettingRow>
    )
  },
  {
    title: 'Connections',
    numbers: [
      { key: 'maxClients', label: 'Most devices at once', hint: 'More devices than this are refused until one disconnects.', min: 1, max: 100 },
      { key: 'pingSeconds', label: 'Device check (seconds)', hint: 'How often Seven checks that a connected device is still reachable.', min: 5, max: 3600 },
      { key: 'idleMinutes', label: 'Idle timeout (minutes)', hint: 'A device that sends nothing for this long is disconnected. 0 means never.', min: 0, max: 525600 },
      { key: 'reconnectMinSeconds', label: 'Reconnect wait (seconds)', hint: 'How long a device waits before its first reconnect try. Each later try waits twice as long.', min: 1, max: 600 },
      { key: 'reconnectMaxSeconds', label: 'Longest reconnect wait (seconds)', hint: 'Reconnect tries never wait longer than this.', min: 1, max: 3600 }
    ]
  },
  {
    title: 'Sizes',
    numbers: [
      { key: 'maxRequestMb', label: 'Largest request (MB)', hint: "Bigger requests are refused, so a device can't fill this PC's memory. Pictures sent to a vision model count toward it.", min: 1, max: 4096 },
      { key: 'maxMessageMb', label: 'Largest bridge message (MB)', hint: 'Bigger messages from a device are refused.', min: 1, max: 256 },
      { key: 'bufferSoftMb', label: 'Slow device buffer (MB)', hint: 'When a device falls this far behind, Seven keeps only the latest progress updates for it.', min: 1, max: 256 },
      { key: 'bufferHardMb', label: 'Slow device cut-off (MB)', hint: 'A device this far behind is disconnected. It reconnects and catches up by itself.', min: 1, max: 1024 }
    ]
  },
  {
    title: 'Files from devices',
    numbers: [
      { key: 'maxUploadMb', label: 'Largest file from a device (MB)', hint: 'A device cannot send a single file bigger than this.', min: 1, max: 65536 },
      { key: 'uploadKeepMinutes', label: 'Keep sent files (minutes)', hint: 'Files sent from a device are deleted once Seven has used them; any left over are deleted after this long.', min: 1, max: 525600 }
    ],
    extra: (s, change) => (
      <SettingRow label="Sent files folder" hint="Files sent from a device land in a seven-files folder inside this folder. Empty means Seven's own data folder." wide>
        <Input value={s.uploadFolder} onChange={(e) => change({ uploadFolder: e.target.value })} placeholder="Seven's data folder" spellCheck={false} className="h-7 w-full font-mono text-[12px]" />
      </SettingRow>
    )
  },
  {
    title: 'Pairing and announcement',
    numbers: [
      { key: 'pairCodeSeconds', label: 'Pairing code lifetime (seconds)', hint: 'A pairing code older than this stops working.', min: 10, max: 3600 },
      { key: 'pairCodeUses', label: 'Pairing code uses', hint: 'How many devices one code can pair before it stops working.', min: 1, max: 10 }
    ],
    extra: (s, change) => (
      <SettingRow label="Announcement type" hint="The DNS-SD service type devices look for. Leave it alone unless it clashes with something else on your network.">
        <Input value={s.announceType} onChange={(e) => change({ announceType: e.target.value })} spellCheck={false} className="h-7 w-32 font-mono text-[12px]" />
      </SettingRow>
    )
  }
]

const COUNT = GROUPS.reduce((n, g) => n + g.numbers.length + (g.extra ? 1 : 0), 0)

export function FineTuning({ settings, change, saver }: { settings: NetworkSettings; change: (patch: Partial<NetworkSettings>) => void; saver: AutosavedState<NetworkSettings | null> }) {
  return (
    <SettingCard title="Fine tuning" actions={<SaveState status={saver.status} error={saver.error} />}>
      <Fold label="Port, limits, timeouts and pairing codes" note="Most people never change these" count={COUNT}>
        {GROUPS.map((g) => (
          <div key={g.title} className="flex flex-col">
            <div className="px-3.5 pb-1 pt-3 font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-accent-soft">{g.title}</div>
            <SettingGrid min="22rem">
              {g.numbers.map((n) => (
                <SettingRow key={n.key} label={n.label} hint={n.hint}>
                  <NumberField value={settings[n.key]} min={n.min} max={n.max} step={1} onChange={(v) => v !== undefined && change({ [n.key]: v } as Partial<NetworkSettings>)} className="h-7 w-24 text-[12px]" />
                </SettingRow>
              ))}
              {g.extra?.(settings, change)}
            </SettingGrid>
          </div>
        ))}
      </Fold>
    </SettingCard>
  )
}

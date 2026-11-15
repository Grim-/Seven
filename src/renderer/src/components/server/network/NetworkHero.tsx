import { Radar, Wifi, WifiOff } from 'lucide-react'
import type { NetworkSettings, NetworkStatus } from '@shared/types'
import { AlertBox, Input, OptionTile } from '../../ui'
import { main } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { PairDevice } from '../PairDevice'

export function NetworkHero({ network, settings, change }: { network: NetworkStatus; settings: NetworkSettings; change: (patch: Partial<NetworkSettings>) => void }) {
  const turn = (on: boolean) => void main('network.set', { on }).catch(failed('Could not change network access'))
  const connected = network.devices.filter((d) => d.connected).length
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-3">
        <div className="flex flex-col gap-2">
          <OptionTile
            icon={network.on ? <Wifi /> : <WifiOff />}
            title="Network access"
            hint={network.listening ? `Listening on port ${network.settings.port}.` : 'Lets paired phones and other programs reach Seven over your network. Windows may ask about the firewall the first time.'}
            checked={network.on}
            onChange={turn}
          />
          {network.listening && network.addresses.length > 0 && (
            <div className="flex flex-col gap-0.5 border border-line/40 bg-black/40 px-3 py-1.5 font-mono text-[11.5px] text-white/85">
              {network.addresses.map((a) => (
                <span key={a}>
                  {a}:{network.settings.port}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <OptionTile
            icon={<Radar />}
            title="Announce on the network"
            hint={network.announcing ? 'Paired devices find this PC by itself, even when its address changes.' : 'Tells your local network where Seven is (mDNS). It carries no secrets; trust comes from pairing.'}
            checked={settings.announce}
            onChange={(announce) => change({ announce })}
            color="var(--color-teal)"
          />
          {settings.announce && <Input value={settings.announceName} onChange={(e) => change({ announceName: e.target.value })} placeholder="This PC's name, as devices show it" spellCheck={false} className="h-8 font-mono text-[12px]" />}
        </div>
        <div className="flex flex-col justify-between gap-2 border border-purple/50 bg-purple/10 px-3 py-2.5 shadow-[inset_3px_0_0_var(--color-purple)]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-white">Pair a phone</span>
            <span className="text-[11.5px] leading-snug text-faint">{network.listening ? 'Scan the code with the Seven app to use the whole of Seven from it.' : 'Turn network access on to pair a device.'}</span>
          </div>
          <div className="flex items-center gap-3">
            <PairDevice network={network} size="md" />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-dim">
              {network.devices.length} paired · {connected} connected
            </span>
          </div>
        </div>
      </div>
      {network.error && <AlertBox>{network.error}</AlertBox>}
    </div>
  )
}

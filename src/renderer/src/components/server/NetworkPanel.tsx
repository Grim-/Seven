import { useEffect } from 'react'
import type { NetworkSettings, NetworkStatus } from '@shared/types'
import { useAutosavedState } from '../ui'
import { main } from '../../lib/ipc'
import { NetworkHero } from './network/NetworkHero'
import { PairedDevices } from './network/PairedDevices'
import { ModelApiCard } from './network/ModelApiCard'
import { CertificateCard } from './network/CertificateCard'
import { ApiClients } from './network/ApiClients'
import { FineTuning } from './network/FineTuning'

export function NetworkPanel({ network }: { network: NetworkStatus }) {
  const saver = useAutosavedState<NetworkSettings | null>(null, (s) => main('network.set', { settings: s! }).then(() => undefined), { when: (s) => s !== null })
  useEffect(() => {
    if (!saver.value) saver.reset(network.settings)
  }, [network.settings])
  const settings = saver.value ?? network.settings
  const change = (patch: Partial<NetworkSettings>) => saver.set({ ...settings, ...patch })
  return (
    <>
      <NetworkHero network={network} settings={settings} change={change} />
      <PairedDevices network={network} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,28rem),1fr))] gap-3">
        <ModelApiCard network={network} />
        <CertificateCard network={network} />
      </div>
      <ApiClients network={network} />
      <FineTuning settings={settings} change={change} saver={saver} />
    </>
  )
}

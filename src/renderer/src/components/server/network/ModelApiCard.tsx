import { useState } from 'react'
import { Copy, KeyRound, Sparkles } from 'lucide-react'
import type { NetworkStatus } from '@shared/types'
import { Button, Input, SettingCard } from '../../ui'
import { main } from '../../../lib/ipc'
import { copyText, failed } from '../../../lib/notify'

export function ModelApiCard({ network }: { network: NetworkStatus }) {
  const [password, setPassword] = useState('')
  const [justSet, setJustSet] = useState<string | null>(null)
  const suggest = () => void main('network.password.suggest').then(setPassword).catch(failed('Could not make a password'))
  const save = () =>
    void main('network.password.set', { password })
      .then(() => {
        setJustSet(password)
        setPassword('')
      })
      .catch(failed('Could not set the password'))
  return (
    <SettingCard
      title="Model API"
      actions={<span className={network.hasPassword ? 'font-ui text-[10.5px] text-ok' : 'font-ui text-[10.5px] text-faint'}>{network.hasPassword ? 'On' : 'Off: no password'}</span>}
      intro={`Other programs can use your models through an OpenAI-compatible API over HTTPS, sending this password as the API key. Paired phones don't need it. Seven keeps only a one-way hash, so copy it now. At least ${network.passwordMin} characters.`}
    >
      <div className="flex flex-col gap-2 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Type a password or press Suggest" spellCheck={false} className="h-8 min-w-[12rem] flex-1 font-ui text-[12px]" />
          <Button size="sm" variant="ghost" icon={<Sparkles />} onClick={suggest}>
            Suggest
          </Button>
          <Button size="sm" variant="primary" icon={<KeyRound />} disabled={!password} onClick={save}>
            {network.hasPassword ? 'Change' : 'Set password'}
          </Button>
        </div>
        {justSet && (
          <div className="flex items-center gap-2 border border-accent/50 bg-accent/10 px-2 py-1.5">
            <span className="flex-1 break-all font-mono text-[12px] text-ink">{justSet}</span>
            <Button size="sm" variant="ghost" icon={<Copy />} onClick={() => void copyText(justSet)}>
              Copy
            </Button>
          </div>
        )}
        {network.listening && network.hasPassword && (
          <div className="flex flex-col gap-0.5 font-ui text-[12px] text-secondary">
            {network.addresses.map((a) => (
              <span key={a}>
                https://{a}:{network.settings.port}/v1
              </span>
            ))}
          </div>
        )}
      </div>
    </SettingCard>
  )
}

import { useState } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import type { NetworkStatus } from '@shared/types'
import { Button, Modal, SettingCard } from '../../ui'
import { main } from '../../../lib/ipc'
import { copyText, failed } from '../../../lib/notify'

export function CertificateCard({ network }: { network: NetworkStatus }) {
  const [renewing, setRenewing] = useState(false)
  const copyCertificate = () =>
    void main('network.certificate.get')
      .then((pem) => {
        if (pem) copyText(pem)
      })
      .catch(failed('Could not read the certificate'))
  const renew = () =>
    void main('network.certificate.renew')
      .then(() => setRenewing(false))
      .catch(failed('Could not make a new certificate'))
  return (
    <SettingCard title="Certificate" intro="Seven made this certificate itself. A device must trust it before it connects: install it on that device, or check this fingerprint when the device asks.">
      <div className="flex flex-col gap-2 p-3.5">
        <span className="break-all font-mono text-[11px] text-dim">{network.fingerprint ? `SHA-256 ${network.fingerprint}` : 'No certificate yet.'}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="ghost" icon={<Copy />} disabled={!network.fingerprint} onClick={copyCertificate}>
            Copy certificate
          </Button>
          <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => setRenewing(true)}>
            Make new
          </Button>
        </div>
      </div>
      <Modal
        open={renewing}
        title="Make a new certificate"
        onClose={() => setRenewing(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenewing(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={renew}>
              Make new
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-ink/85">Every device that trusts the old certificate stops connecting until you give it the new one.</p>
      </Modal>
    </SettingCard>
  )
}

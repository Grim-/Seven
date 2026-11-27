import { useEffect, useState, type ComponentProps } from 'react'
import QRCode from 'qrcode'
import { Check, QrCode, X } from 'lucide-react'
import type { NetworkStatus, PairingInfo } from '@shared/types'
import { Button, Modal } from '../ui'
import { main } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { noteFailure } from '../../store/problems'

export function PairDevice({ network, size = 'sm' }: { network: NetworkStatus; size?: ComponentProps<typeof Button>['size'] }) {
  const [info, setInfo] = useState<PairingInfo | null>(null)
  const [image, setImage] = useState<string | null>(null)

  const start = () => void main('network.pair.start').then(setInfo).catch(failed('Could not start pairing'))
  const close = () => {
    setInfo(null)
    setImage(null)
    void main('network.pair.cancel').catch(noteFailure('network', 'Could not cancel pairing'))
  }

  useEffect(() => {
    if (!info) return
    const payload = JSON.stringify({ seven: 1, addresses: info.addresses, port: info.port, fingerprint: info.fingerprint, code: info.code, id: info.id })
    QRCode.toDataURL(payload, { margin: 1, width: 240 })
      .then(setImage)
      .catch(failed('Could not draw the QR code'))
    return () => {
      void main('network.pair.cancel').catch(noteFailure('network', 'Could not cancel pairing'))
    }
  }, [info])

  useEffect(() => {
    if (info && !network.pairing.open && !network.pairing.request) {
      setInfo(null)
      setImage(null)
    }
  }, [network.pairing.open, network.pairing.request])

  const request = network.pairing.request
  const allow = () => request && void main('network.pair.allow', { requestId: request.id }).catch(failed('Could not allow the device'))
  const deny = () => request && void main('network.pair.deny', { requestId: request.id }).catch(failed('Could not deny the device'))

  return (
    <>
      <Button size={size} variant="primary" icon={<QrCode />} disabled={!network.listening} onClick={start}>
        Pair a device
      </Button>
      <Modal
        open={info !== null}
        title="Pair a device"
        onClose={close}
        footer={
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
        }
      >
        {info && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-ink/85">Scan this with the Seven app. The code only works while this window is open.</p>
            {image && <img src={image} alt="Pairing QR code" className="h-60 w-60 self-center bg-page p-1" />}
            <div className="flex flex-col gap-0.5 font-ui text-[12px] text-dim">
              {info.addresses.map((a) => (
                <span key={a}>{a}:{info.port}</span>
              ))}
              <span className="text-ink">Code {info.code}</span>
              <span className="break-all text-[11px]">{info.fingerprint}</span>
            </div>
            {request && (
              <div className="flex items-center gap-1.5 border border-line/50 tone-panel-40 px-2 py-1.5">
                <span className="flex-1 text-[13px] text-ink">
                  Allow "{request.name}" from {request.address}?
                </span>
                <Button size="sm" variant="primary" icon={<Check />} onClick={allow}>
                  Allow "{request.name}"
                </Button>
                <Button size="sm" variant="ghost" icon={<X />} onClick={deny}>
                  Deny
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}

import type { MainParams, MainRequestName, MainResult } from '@shared/protocol'

interface NativeDevice {
  copyText(call: number, text: string): void
  saveText(call: number, name: string, text: string): void
  saveAsset(call: number, id: string, name: string): void
  openAsset(call: number, id: string): void
  presentPage(call: number, html: string): void
}

declare global {
  interface Window {
    sevenDevice?: NativeDevice
    sevenDeviceReply?: (call: number, ok: boolean, value: string | null) => void
  }
}

export type DeviceHandlers = { [K in MainRequestName]?: (params: MainParams<K>) => Promise<MainResult<K>> }

export function nativeDeviceHandlers(): DeviceHandlers {
  const device = window.sevenDevice
  if (!device) return {}
  const waiting = new Map<number, { resolve: (value: string | null) => void; reject: (err: Error) => void }>()
  let next = 1
  window.sevenDeviceReply = (call, ok, value) => {
    const entry = waiting.get(call)
    if (!entry) return
    waiting.delete(call)
    if (ok) entry.resolve(value)
    else entry.reject(new Error(value ?? 'The device could not do that.'))
  }
  const ask = (send: (call: number) => void): Promise<string | null> =>
    new Promise((resolve, reject) => {
      const call = next++
      waiting.set(call, { resolve, reject })
      send(call)
    })
  return {
    'clipboard.write': async ({ text }) => {
      await ask((call) => device.copyText(call, text))
    },
    'dialog.saveText': ({ name, text }) => ask((call) => device.saveText(call, name, text)),
    'asset.saveAs': ({ id, name }) => ask((call) => device.saveAsset(call, id, name)),
    'asset.open': async ({ id }) => {
      await ask((call) => device.openAsset(call, id))
    },
    'present.page': async ({ html }) => (await ask((call) => device.presentPage(call, html))) ?? ''
  }
}

import net from 'node:net'

export function freePort(label = 'server'): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address ? address.port : 0
      probe.close(() => (port ? resolve(port) : reject(new Error(`No free port for ${label}`))))
    })
  })
}

export function portTaken(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createServer()
    probe.once('error', () => resolve(true))
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(false)))
  })
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function waitWithAbort(ms: number, signal: AbortSignal, cancelMessage = 'Cancelled'): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error(cancelMessage))
      return
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new Error(cancelMessage))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

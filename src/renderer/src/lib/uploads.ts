import { create } from 'zustand'
import { metaNumber } from './transport'

export interface UploadItem {
  id: number
  name: string
  sent: number
  size: number
  error: string | null
}

interface UploadsState {
  uploads: UploadItem[]
}

export const useUploads = create<UploadsState>(() => ({ uploads: [] }))

let nextId = 1

function update(id: number, patch: Partial<UploadItem>): void {
  useUploads.setState((s) => ({ uploads: s.uploads.map((u) => (u.id === id ? { ...u, ...patch } : u)) }))
}

export function dismissUpload(id: number): void {
  useUploads.setState((s) => ({ uploads: s.uploads.filter((u) => u.id !== id) }))
}

class Unreachable extends Error {}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new Unreachable('Seven could not be reached.')
  }
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new Error(parsed?.error?.message || `Seven refused the file (${res.status}).`)
  }
  return (await res.json()) as T
}

interface Opened {
  upload: string
  received: number
  chunkBytes: number
}

interface Appended {
  received: number
  path?: string
}

async function run(id: number, file: File): Promise<string> {
  const minMs = metaNumber('seven-reconnect-min', 1) * 1000
  const maxMs = metaNumber('seven-reconnect-max', 30) * 1000
  const opened = await send<Opened>('/files', { method: 'POST', body: JSON.stringify({ name: file.name, size: file.size }) })
  let sent = opened.received
  let delay = minMs
  while (sent < file.size) {
    let result: Appended
    try {
      result = await send<Appended>(`/files/${encodeURIComponent(opened.upload)}`, {
        method: 'PUT',
        headers: { 'x-seven-offset': String(sent) },
        body: file.slice(sent, sent + opened.chunkBytes)
      })
    } catch (err) {
      if (!(err instanceof Unreachable) || delay > maxMs) throw err
      await wait(delay)
      delay *= 2
      continue
    }
    delay = minMs
    sent = result.received
    update(id, { sent })
    if (result.path !== undefined) {
      dismissUpload(id)
      return result.path
    }
  }
  throw new Error('The upload did not finish.')
}

export async function uploadFile(file: File): Promise<string> {
  if (!file.size) throw new Error(`${file.name} is empty.`)
  const id = nextId++
  useUploads.setState((s) => ({ uploads: [...s.uploads, { id, name: file.name, sent: 0, size: file.size, error: null }] }))
  try {
    return await run(id, file)
  } catch (err) {
    update(id, { error: err instanceof Error ? err.message : String(err) })
    throw err
  }
}

export function pickFiles(multiple: boolean, accept?: string): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = multiple
    if (accept) input.accept = accept
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.oncancel = () => resolve([])
    input.click()
  })
}

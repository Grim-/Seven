import type { ImageHostState } from '@shared/types'

const STAGE_LABEL: Record<string, string> = {
  unloading_chat: 'Unloading chat model',
  restoring_chat: 'Reloading chat model',
  submitting: 'Submitting job',
  queued: 'Queued in sd-server',
  waiting: 'Waiting for GPU',
  preparing: 'Preparing inputs',
  conditioning: 'Encoding prompt',
  sampling: 'Sampling',
  vae_encode: 'VAE encode',
  vae_decode: 'Decoding image',
  upscaling: 'Upscaling',
  encoding: 'Encoding output'
}

/** Summarize live sd-server progress (stage, step counter, and normalized 0..1 ratio when known). */
export function describeImageProgress(
  host: ImageHostState,
  modelName?: string | null
): { text: string; ratio: number | null } {
  const p = host.progress
  if (p) {
    const label = STAGE_LABEL[p.stage] ?? p.stage
    const count = p.completed !== null && p.total !== null && p.total > 0 ? ` ${p.completed}/${p.total}` : ''
    const detail = p.detail ? ` (${p.detail})` : ''
    const ratio = p.completed !== null && p.total !== null && p.total > 0 ? Math.min(1, Math.max(0, p.completed / p.total)) : null
    return { text: `${label}${count}${detail}…`, ratio }
  }
  if (host.status === 'loading') {
    return { text: `Starting sd-server & loading ${modelName ?? host.modelName ?? 'weights'}…`, ratio: null }
  }
  return { text: 'Generating image…', ratio: null }
}

/** Human-readable description of the active sd-server chat swap mode. */
export function chatSwapNotice(rawMode: unknown): string | null {
  if (rawMode === 'keep') return null
  if (rawMode === 'unload-only') {
    return 'Low-RAM mode: Seven will unload your chat model before running sd-server and leave it unloaded afterward.'
  }
  return 'Low-RAM auto-swap: Seven will unload your chat model before starting sd-server, stop sd-server when finished, then reload your chat model.'
}

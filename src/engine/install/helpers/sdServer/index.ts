import fs from 'node:fs'
import path from 'node:path'
import type { ParamSchema } from '@shared/game/core/params'
import type { ServerBuild } from '@shared/types'
import { githubReleases, githubSource } from '../../github'
import { serverVariantChoices } from '../../machine'
import { appFolder } from '../../paths'
import { registerHelper } from '../../registry'
import { unpackServer, verifyServer } from '../../serverBinary'
import { readCheck, settingsOf } from '../../store'
import { activeVersion, lease } from '../../versions'
import { registerAttribution } from '../../../credits'

registerAttribution({
  id: 'stable-diffusion-cpp',
  name: 'stable-diffusion.cpp',
  category: 'Local Runtime',
  license: 'MIT',
  url: 'https://github.com/leejet/stable-diffusion.cpp',
  usedFor: 'Optional local image generation runner (sd-server), downloaded on demand via Helper installers.',
  source: 'helper:sd-server'
})

export const SD_SERVER = 'sd-server'
export const SD_SERVER_PROGRAM = 'sd-server.exe'

export type ChatSwapMode = 'swap' | 'unload-only' | 'keep'

export interface SdServerLimits {
  stallSeconds: number
  stopSeconds: number
  portRetries: number
  healthPollMs: number
  idleUnloadMinutes: number
  keepServerLoaded: boolean
  chatSwapMode: ChatSwapMode
  autoSwapChatModel: boolean
  logLines: number
}

const SCHEMA: ParamSchema = {
  releasesUrl: { section: 'Updates', more: true, kind: 'text', default: 'https://api.github.com/repos/leejet/stable-diffusion.cpp/releases', label: 'Releases address', description: 'Where Seven lists stable-diffusion.cpp releases (the GitHub releases API of the official repository).' },
  releasesCount: { section: 'Updates', more: true, kind: 'number', default: 30, min: 1, max: 100, label: 'Releases to list', description: 'How many of the newest releases Seven fetches when it checks.' },
  cudaBuildPattern: { section: 'Build detection', more: true, kind: 'text', default: '^sd-.*-bin-win-cuda(\\d+)(?:\\.(\\d+))?-x64\\.zip$', label: 'CUDA build file', description: 'Regular expression for the CUDA build in a release; capture group 1 is the CUDA major version and optional group 2 is the minor version.' },
  cudaRuntimePattern: { section: 'Build detection', more: true, kind: 'text', default: '^cudart-sd-bin-win-cu(\\d+)(?:\\.(\\d+))?-x64\\.zip$', label: 'CUDA runtime file', description: 'Regular expression for the CUDA runtime that goes with a CUDA build; capture groups match the CUDA major and optional minor version.' },
  vulkanBuildPattern: { section: 'Build detection', more: true, kind: 'text', default: '^sd-.*-bin-win-vulkan-x64\\.zip$', label: 'Vulkan build file', description: 'Regular expression for the Vulkan build in a release.' },
  cpuBuildPattern: { section: 'Build detection', more: true, kind: 'text', default: '^sd-.*-bin-win-cpu-x64\\.zip$', label: 'CPU build file', description: 'Regular expression for the CPU-only build in a release.' },
  driverCudaPattern: { section: 'Build detection', more: true, kind: 'text', default: 'CUDA(?:\\s+UMD)?\\s+Version:\\s*(\\d+)\\.(\\d+)', label: 'Driver CUDA version', description: "Regular expression that finds the CUDA version in nvidia-smi's output; the two groups are major and minor." },
  cudaLowestCompute: { section: 'Build detection', kind: 'values', default: { '12': 5, '13': 7.5 }, label: 'Lowest compute capability per CUDA version', description: "For each CUDA major version, the oldest GPU compute capability its builds support (from NVIDIA's toolkit release notes). A version not listed isn't checked." },
  vulkanLibrary: { section: 'Build detection', more: true, kind: 'text', default: path.join(process.env.windir ?? 'C:\\Windows', 'System32', 'vulkan-1.dll'), label: 'Vulkan library', description: 'The file whose presence means a Vulkan driver is installed.' },
  customExecutable: { section: 'Loading and stopping', kind: 'text', default: '', label: 'Custom sd-server path', description: `Optional path to an existing ${SD_SERVER_PROGRAM} or the folder containing it. When set, Seven runs this executable instead of the active downloaded version.` },
  verifySeconds: { section: 'Loading and stopping', more: true, kind: 'number', default: 60, min: 1, label: 'Check time limit (seconds)', description: 'How long each check of an installed build (--version, --help) may run.' },
  loadStallSeconds: { section: 'Loading and stopping', kind: 'number', default: 300, min: 0, label: 'Give up loading after silence (seconds)', description: "Stop a model load when sd-server writes nothing and isn't ready for this long. 0 waits forever." },
  healthPollMs: { section: 'Loading and stopping', more: true, kind: 'number', default: 250, min: 10, label: 'Ready check interval (ms)', description: 'How often Seven asks a starting sd-server whether it is ready.' },
  stopSeconds: { section: 'Loading and stopping', kind: 'number', default: 10, min: 1, label: 'Stop time limit (seconds)', description: 'How long Seven waits for sd-server to exit before ending it forcibly.' },
  portRetries: { section: 'Loading and stopping', more: true, kind: 'number', default: 3, min: 0, label: 'Port retries', description: 'How many more ports Seven tries when another program takes the port sd-server was given.' },
  idleUnloadMinutes: { section: 'Loading and stopping', kind: 'number', default: 10, min: 0, label: 'Idle unload delay (minutes)', description: 'Unload a resident sd-server after this many minutes without an image request. 0 keeps it running until stopped.' },
  keepServerLoaded: {
    section: 'Loading and stopping',
    kind: 'flag',
    default: false,
    label: 'Keep sd-server loaded after generation',
    description: 'When off, sd-server stops immediately after each generation or edit to free RAM and VRAM. Enable only when iterating locally with enough memory.'
  },
  autoSwapChatModel: {
    section: 'Loading and stopping',
    kind: 'choice',
    default: 'swap',
    choices: ['swap', 'unload-only', 'keep'],
    labels: {
      swap: 'Unload chat model for image gen, then reload',
      'unload-only': 'Unload chat model and leave it unloaded',
      keep: 'Keep both loaded'
    },
    label: 'Low-RAM / VRAM chat handling',
    description: 'Unload the loaded chat model before running sd-server. Agent tool calls reload the chat model afterward if needed to finish replying; manual UI generations honor Unload-only.'
  },
  logLines: { section: 'Loading and stopping', more: true, kind: 'number', default: 200, min: 10, label: 'Log lines kept', description: 'How many of the last lines sd-server writes Seven keeps and shows.' }
}

/** Read operational limits configured for sd-server. */
export function sdServerLimits(): SdServerLimits {
  const s = settingsOf(SD_SERVER)
  const rawMode = String(s.autoSwapChatModel ?? 'swap')
  const chatSwapMode: ChatSwapMode = rawMode === 'keep' ? 'keep' : rawMode === 'unload-only' ? 'unload-only' : 'swap'
  return {
    stallSeconds: Number(s.loadStallSeconds),
    stopSeconds: Number(s.stopSeconds),
    portRetries: Number(s.portRetries),
    healthPollMs: Number(s.healthPollMs),
    idleUnloadMinutes: Number(s.idleUnloadMinutes),
    keepServerLoaded: Boolean(s.keepServerLoaded),
    chatSwapMode,
    autoSwapChatModel: chatSwapMode !== 'keep',
    logLines: Number(s.logLines)
  }
}

function resolveCustomExe(): string | null {
  const raw = String(settingsOf(SD_SERVER).customExecutable ?? '').trim()
  if (!raw) return null
  const candidate = fs.existsSync(raw) && fs.statSync(raw).isDirectory() ? path.join(raw, SD_SERVER_PROGRAM) : raw
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
    throw new Error(`The custom sd-server path "${raw}" does not point to an existing ${SD_SERVER_PROGRAM}. Update or clear it in settings.`)
  }
  return candidate
}

/** Return the active sd-server executable path (preferring customExecutable when configured). */
export function sdServerExe(): string | null {
  const custom = resolveCustomExe()
  if (custom) return custom
  const v = activeVersion(SD_SERVER)
  return v ? path.join(v.folder, SD_SERVER_PROGRAM) : null
}

/** Return the active version identifier (or `'custom'` when using a custom executable path). */
export function sdServerVersion(): string | null {
  if (String(settingsOf(SD_SERVER).customExecutable ?? '').trim()) return 'custom'
  return activeVersion(SD_SERVER)?.id ?? null
}

/** Return verified build capabilities for the active sd-server version, if any. */
export function sdServerBuild(): ServerBuild | null {
  const v = activeVersion(SD_SERVER)
  if (!v) return null
  const check = readCheck(SD_SERVER, v.id)
  return { version: v.id, label: v.label ?? v.id, flags: check?.ok && check.flags?.length ? check.flags : null }
}

/** Acquire a usage lease on an installed sd-server version so it cannot be removed while running. */
export function sdServerLease(version: string, holder: string): () => void {
  if (version === 'custom') return () => undefined
  return lease(SD_SERVER, version, holder)
}

function defaultRoot(): string {
  return path.join(appFolder(), 'runtime', 'sd-server')
}

registerHelper({
  id: SD_SERVER,
  title: 'sd-server',
  about: 'Runs local image generation models on your machine.',
  program: SD_SERVER_PROGRAM,
  schema: SCHEMA,
  defaultRoot,
  source: githubSource,
  releases: (settings, signal) => githubReleases(String(settings.releasesUrl), Number(settings.releasesCount), signal),
  choices: (release, settings) => serverVariantChoices(release.assets, settings, SD_SERVER),
  unpack: (files, staging) => unpackServer(files, staging, SD_SERVER_PROGRAM),
  verify: (folder, settings) => verifyServer(path.join(folder, SD_SERVER_PROGRAM), Number(settings.verifySeconds), { requireVersion: false })
})

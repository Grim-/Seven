import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ParamSchema } from '@shared/game/core/params'
import { registerHelper, type Choice, type Settings } from '../../registry'
import { appFolder } from '../../paths'
import { githubReleases } from '../../github'
import { settingsOf } from '../../store'
import { readMachine } from './machine'
import { variantsByRank } from './variants/registry'
import { verifyServer } from './verify'
import { unpackServer } from './unpack'
import './variants/builtin'

export const LLAMA_SERVER = 'llama-server'
export const LLAMA_SERVER_PROGRAM = 'llama-server.exe'

export interface ServerLimits {
  stallSeconds: number
  stopSeconds: number
  portRetries: number
  healthPollMs: number
  logLines: number
  slotFolder: string
}

const SCHEMA: ParamSchema = {
  releasesUrl: { section: 'Updates', more: true, kind: 'text', default: 'https://api.github.com/repos/ggml-org/llama.cpp/releases', label: 'Releases address', description: 'Where Seven lists llama.cpp releases (the GitHub releases API of the official repository).' },
  releasesCount: { section: 'Updates', more: true, kind: 'number', default: 30, min: 1, max: 100, label: 'Releases to list', description: 'How many of the newest releases Seven fetches when it checks.' },
  cudaBuildPattern: { section: 'Build detection', more: true, kind: 'text', default: '^llama-.*-bin-win-cuda-(\\d+)\\.(\\d+)-x64\\.zip$', label: 'CUDA build file', description: 'Regular expression for the CUDA build in a release; the two groups are the CUDA major and minor version.' },
  cudaRuntimePattern: { section: 'Build detection', more: true, kind: 'text', default: '^cudart-llama-bin-win-cuda-(\\d+)\\.(\\d+)-x64\\.zip$', label: 'CUDA runtime file', description: 'Regular expression for the CUDA runtime that goes with a CUDA build; the two groups are the CUDA major and minor version.' },
  vulkanBuildPattern: { section: 'Build detection', more: true, kind: 'text', default: '^llama-.*-bin-win-vulkan-x64\\.zip$', label: 'Vulkan build file', description: 'Regular expression for the Vulkan build in a release.' },
  cpuBuildPattern: { section: 'Build detection', more: true, kind: 'text', default: '^llama-.*-bin-win-cpu-x64\\.zip$', label: 'CPU build file', description: 'Regular expression for the CPU-only build in a release.' },
  driverCudaPattern: { section: 'Build detection', more: true, kind: 'text', default: 'CUDA(?:\\s+UMD)?\\s+Version:\\s*(\\d+)\\.(\\d+)', label: 'Driver CUDA version', description: "Regular expression that finds the CUDA version in nvidia-smi's output; the two groups are major and minor." },
  cudaLowestCompute: { section: 'Build detection', kind: 'values', default: { '12': 5, '13': 7.5 }, label: 'Lowest compute capability per CUDA version', description: "For each CUDA major version, the oldest GPU compute capability its builds support (from NVIDIA's toolkit release notes). A version not listed isn't checked." },
  vulkanLibrary: { section: 'Build detection', more: true, kind: 'text', default: path.join(process.env.windir ?? 'C:\\Windows', 'System32', 'vulkan-1.dll'), label: 'Vulkan library', description: 'The file whose presence means a Vulkan driver is installed.' },
  verifySeconds: { section: 'Loading and stopping', more: true, kind: 'number', default: 60, min: 1, label: 'Check time limit (seconds)', description: 'How long each check of an installed build (--version, --help, --list-devices) may run.' },
  loadStallSeconds: { section: 'Loading and stopping', kind: 'number', default: 300, min: 0, label: 'Give up loading after silence (seconds)', description: 'Stop a model load when llama-server writes nothing and isn\'t ready for this long. 0 waits forever.' },
  healthPollMs: { section: 'Loading and stopping', more: true, kind: 'number', default: 250, min: 10, label: 'Ready check interval (ms)', description: 'How often Seven asks a loading llama-server whether it is ready.' },
  stopSeconds: { section: 'Loading and stopping', kind: 'number', default: 10, min: 1, label: 'Stop time limit (seconds)', description: 'How long Seven waits for llama-server to exit before ending it forcibly.' },
  portRetries: { section: 'Loading and stopping', more: true, kind: 'number', default: 3, min: 0, label: 'Port retries', description: 'How many more ports Seven tries when another program takes the port llama-server was given.' },
  logLines: { section: 'Loading and stopping', more: true, kind: 'number', default: 200, min: 10, label: 'Log lines kept', description: 'How many of the last lines llama-server writes Seven keeps and shows.' },
  slotFolder: { section: 'Loading and stopping', kind: 'text', default: '', label: 'Saved chat state folder', description: "Where llama-server writes saved chat state while it runs. Empty uses the system's temporary folder." }
}

export function llamaLimits(): ServerLimits {
  const s = settingsOf(LLAMA_SERVER)
  return {
    stallSeconds: Number(s.loadStallSeconds),
    stopSeconds: Number(s.stopSeconds),
    portRetries: Number(s.portRetries),
    healthPollMs: Number(s.healthPollMs),
    logLines: Number(s.logLines),
    slotFolder: String(s.slotFolder || os.tmpdir())
  }
}

function defaultRoot(): string {
  return path.join(appFolder(), 'runtime', 'llama-server')
}

async function choices(assets: Choice['assets'], settings: Settings): Promise<Choice[]> {
  const machine = await readMachine(settings)
  return variantsByRank().flatMap((v) =>
    v.choices(assets, machine, settings).map((c) => ({
      build: c.build,
      label: c.label,
      unavailable: c.unavailable,
      notes: c.notes,
      assets: c.assets,
      size: c.assets.reduce((n, a) => n + a.size, 0),
      files: c.assets.map((a) => ({ name: a.name, size: a.size }))
    }))
  )
}

registerHelper({
  id: LLAMA_SERVER,
  title: 'llama-server',
  about: "llama.cpp's server, which runs your local models. Seven downloads the Windows build you pick from the official llama.cpp releases, keeps every version you install, and runs the one you make active.",
  program: LLAMA_SERVER_PROGRAM,
  schema: SCHEMA,
  defaultRoot,
  source: (settings) => {
    try {
      return new URL(String(settings.releasesUrl)).host
    } catch {
      return String(settings.releasesUrl)
    }
  },
  releases: (settings, signal) => githubReleases(String(settings.releasesUrl), Number(settings.releasesCount), signal),
  choices: (release, settings) => choices(release.assets, settings),
  unpack: (files, staging) => unpackServer(files, staging, LLAMA_SERVER_PROGRAM),
  verify: (folder, settings) => verifyServer(path.join(folder, LLAMA_SERVER_PROGRAM), Number(settings.verifySeconds)),
  activeBefore: (root) => {
    try {
      const value = JSON.parse(fs.readFileSync(path.join(root, 'installed.json'), 'utf8')) as { tag?: unknown; folder?: unknown }
      const folder = typeof value.folder === 'string' && value.folder ? value.folder : typeof value.tag === 'string' ? value.tag : null
      return folder
    } catch {
      return null
    }
  }
})

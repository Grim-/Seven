import fs from 'node:fs'
import { runText } from '../../../util/run'
import type { Settings } from '../../registry'

export interface Machine {
  cuda: [number, number] | null
  computeCaps: number[]
  vulkan: boolean
}

export function pattern(settings: Settings, key: string): RegExp {
  const text = String(settings[key] ?? '')
  try {
    return new RegExp(text, 'i')
  } catch (err) {
    throw new Error(`The ${key} pattern in llama-server settings is not a valid regular expression: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function readMachine(settings: Settings): Promise<Machine> {
  const [banner, caps] = await Promise.all([runText('nvidia-smi', []), runText('nvidia-smi', ['--query-gpu=compute_cap', '--format=csv,noheader'])])
  const cuda = banner?.match(pattern(settings, 'driverCudaPattern'))
  return {
    cuda: cuda ? [Number(cuda[1]), Number(cuda[2])] : null,
    computeCaps: (caps ?? '')
      .split(/\r?\n/)
      .map((l) => Number(l.trim()))
      .filter((n) => Number.isFinite(n) && n > 0),
    vulkan: fs.existsSync(String(settings.vulkanLibrary ?? ''))
  }
}

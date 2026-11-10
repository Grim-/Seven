import os from 'node:os'
import type { ModelInfo, ServerBuild } from '@shared/types'
import { modelTraitSet } from '@shared/modelParams'
import { runText } from '../util/run'
import type { PackFacts } from './registry'

interface Gpu {
  totalMb: number
  freeMb: number
  computeCap: number | null
}

let gpu: Gpu | null = null

export async function readGpu(): Promise<void> {
  const out = await runText('nvidia-smi', ['--query-gpu=memory.total,memory.free,compute_cap', '--format=csv,noheader,nounits'])
  const rows = (out ?? '')
    .split(/\r?\n/)
    .map((l) => l.split(',').map((x) => Number(x.trim())))
    .filter((r) => r.length >= 2 && r.every((n) => Number.isFinite(n)))
    .sort((a, b) => b[0] - a[0])
  gpu = rows.length ? { totalMb: rows[0][0], freeMb: rows[0][1], computeCap: rows[0][2] ?? null } : null
}

function paramsOf(label: string | null): number | null {
  const m = label?.match(/(\d+(?:\.\d+)?)\s*([BbMm])/)
  if (!m) return null
  return /[Mm]/.test(m[2]) ? Number(m[1]) / 1000 : Number(m[1])
}

function backendsOf(devices: string | null): string[] {
  return [...new Set([...(devices ?? '').matchAll(/^\s*([A-Za-z]+)\d+\s*:/gm)].map((m) => m[1]))]
}

export function packFacts(info: ModelInfo | null | undefined, vision: boolean, build: ServerBuild | null, devices: string | null): PackFacts {
  return {
    traits: modelTraitSet(info, vision),
    architecture: info?.architecture ?? null,
    paramsB: paramsOf(info?.sizeLabel ?? null),
    fileBytes: info?.sizeBytes ?? null,
    vramTotalMb: gpu?.totalMb ?? null,
    vramFreeMb: gpu?.freeMb ?? null,
    computeCap: gpu?.computeCap ?? null,
    ramMb: os.totalmem() / (1024 * 1024),
    cpuCores: os.availableParallelism(),
    backends: backendsOf(devices),
    flags: build?.flags ?? null
  }
}

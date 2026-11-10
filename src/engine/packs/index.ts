import fs from 'node:fs'
import path from 'node:path'
import type { ModelConfig, ModelInfo, PackListing, PackValue, PackView, ServerBuild } from '@shared/types'
import { PARAMS } from '../model/params'
import { samePath } from '../install/store'
import { errorOf, loadPacks, readPack, type Pack } from './load'
import { conditionOf, type PackFacts } from './registry'
import { packFacts, readGpu } from './facts'
import './conditions'

export interface PackModels {
  list(): { id: string }[]
  ownConfig(id: string): ModelConfig
  infoFor(id: string): ModelInfo | null | undefined
  projectorPath(id: string): string | null
  packsOf(id: string): string[]
  setPacks(id: string, on: string[]): void
}

export interface PacksOptions {
  shippedDir: () => string
  ownDir: () => string
  models: PackModels
  build: () => ServerBuild | null
  devices: () => string | null
}

const byKey = new Map(PARAMS.map((p) => [p.key, p]))

function checked(name: string, value: unknown, facts: PackFacts): string | null {
  const condition = conditionOf(name)
  if (!condition) return `${name} is not a condition Seven knows`
  try {
    return condition.check(value, facts)
  } catch (err) {
    return `${name} could not be checked: ${errorOf(err)}`
  }
}

export class Packs {
  private packs: Pack[] = []

  constructor(private o: PacksOptions) {}

  async reload(): Promise<void> {
    await readGpu().catch(() => undefined)
    this.packs = loadPacks(this.o.shippedDir(), this.o.ownDir())
  }

  private failed(pack: Pack, id: string): string[] {
    let facts: PackFacts
    try {
      facts = packFacts(this.o.models.infoFor(id), this.o.models.projectorPath(id) !== null, this.o.build(), this.o.devices())
    } catch (err) {
      return [`Seven could not read this model and PC: ${errorOf(err)}`]
    }
    return Object.entries(pack.when)
      .map(([name, value]) => checked(name, value, facts))
      .filter((r): r is string => r !== null)
  }

  private applied(id: string): Pack[] {
    return this.o.models
      .packsOf(id)
      .map((pid) => this.packs.find((p) => p.id === pid))
      .filter((p): p is Pack => Boolean(p) && !p!.invalid && !this.failed(p!, id).length)
  }

  values(id: string): Record<string, PackValue> {
    const out: Record<string, PackValue> = {}
    for (const pack of this.applied(id)) for (const [key, value] of Object.entries(pack.set)) out[key] = { value, pack: pack.id, title: pack.title }
    return out
  }

  overlay(id: string, own: ModelConfig): ModelConfig {
    const out = { ...own }
    for (const [key, v] of Object.entries(this.values(id))) if (own[key] === byKey.get(key)?.default) out[key] = v.value
    return out
  }

  private folder(): string {
    const folder = this.o.ownDir()
    try {
      fs.mkdirSync(folder, { recursive: true })
      return folder
    } catch {
      return folder
    }
  }

  listing(id: string): PackListing {
    const on = this.o.models.packsOf(id)
    const values = this.values(id)
    const view = (p: Pack): PackView => ({
      id: p.id,
      title: p.title,
      for: p.for,
      why: p.why,
      source: p.source,
      shipped: p.shipped,
      file: p.file,
      sets: Object.entries(p.set).map(([key, value]) => ({ key, label: byKey.get(key)?.label ?? key, value })),
      on: on.includes(p.id),
      failed: p.invalid ? [] : this.failed(p, id),
      invalid: p.invalid,
      overridden: on.includes(p.id) ? Object.keys(p.set).filter((k) => values[k] && values[k].pack !== p.id) : []
    })
    const ordered = [...on.map((pid) => this.packs.find((p) => p.id === pid)).filter((p): p is Pack => Boolean(p)), ...this.packs.filter((p) => !on.includes(p.id))]
    return { packs: ordered.map(view), values, effective: this.overlay(id, this.o.models.ownConfig(id)), folder: this.folder() }
  }

  setOn(id: string, on: string[]): void {
    this.o.models.setPacks(id, [...new Set(on)])
  }

  async importPack(file: string): Promise<string> {
    await this.reload()
    const pack = readPack(file, false)
    if (pack.invalid) throw new Error(`${path.basename(file)} can't be used: ${pack.invalid}.`)
    const folder = this.folder()
    const target = path.join(folder, path.basename(file))
    if (samePath(target, file)) throw new Error(`${path.basename(file)} is already in your packs folder.`)
    const mine = this.packs.find((p) => !p.shipped && p.id === pack.id)
    if (mine) throw new Error(`You already have a pack with the id "${pack.id}" (${mine.title}). Delete it first.`)
    if (fs.existsSync(target)) throw new Error(`Your packs folder already has a file called ${path.basename(file)}. Delete or rename it first.`)
    fs.copyFileSync(file, target, fs.constants.COPYFILE_EXCL)
    await this.reload()
    return pack.title
  }

  async removePack(file: string): Promise<void> {
    await this.reload()
    const pack = this.packs.find((p) => !p.shipped && samePath(p.file, file))
    if (!pack) throw new Error('Seven only deletes packs in your packs folder.')
    fs.rmSync(pack.file, { force: true })
    await this.reload()
    if (this.packs.some((p) => p.id === pack.id)) return
    for (const { id } of this.o.models.list()) {
      const on = this.o.models.packsOf(id)
      if (on.includes(pack.id)) this.o.models.setPacks(id, on.filter((x) => x !== pack.id))
    }
  }
}

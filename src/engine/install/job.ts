import fs from 'node:fs'
import path from 'node:path'
import { versionFolder, type InstallProgress } from '@shared/types'
import { fetchResumable, partOf, sha256Of } from '../net/resumable'
import { helperOf } from './registry'
import { change, hasProgram, record, samePath } from './store'
import { choicesFor } from './releases'
import { addVersion, verifyVersion } from './versions'
import { installEvents } from './events'

export interface InstallInput {
  tag: string
  build: string
  root: string
}

const running = new Map<string, AbortController>()
const last = new Map<string, InstallProgress>()

export function jobOf(id: string): InstallProgress | null {
  return last.get(id) ?? null
}

export function cancelJob(id: string): void {
  running.get(id)?.abort()
}

export async function install(id: string, input: InstallInput): Promise<void> {
  if (running.has(id)) throw new Error(`${helperOf(id).title} is already being installed.`)
  const helper = helperOf(id)
  const controller = new AbortController()
  const signal = controller.signal
  running.set(id, controller)
  const progress: InstallProgress = { helper: id, tag: input.tag, build: input.build, stage: 'resolve', received: 0, total: 0, file: null, error: null, version: null }
  const report = (patch: Partial<InstallProgress>) => {
    Object.assign(progress, patch)
    last.set(id, { ...progress })
    installEvents.progress({ ...progress })
  }
  report({})
  try {
    const choice = (await choicesFor(id, input.tag)).find((c) => c.build === input.build)
    if (!choice) throw new Error(`Release ${input.tag} has no ${input.build} build.`)
    if (choice.unavailable) throw new Error(choice.unavailable)
    const folder = path.join(input.root, versionFolder(input.tag, input.build))
    if (record(id).versions.some((v) => samePath(v.folder, folder)) && hasProgram(id, folder)) throw new Error(`${helper.title} ${input.tag} (${choice.label}) is already installed in ${folder}.`)
    change(id, (r) => {
      r.root = input.root
    })
    const work = path.join(input.root, '.downloads')
    const files: string[] = []
    let shown = -1
    report({ stage: 'download', total: choice.size })
    for (const asset of choice.assets) {
      const file = path.join(work, asset.name)
      report({ file: asset.name })
      await fetchResumable(asset.url, file, {
        size: asset.size,
        what: asset.name,
        signal,
        onBytes: (n) => {
          progress.received += n
          const percent = Math.floor((progress.received * 100) / Math.max(1, progress.total))
          if (percent !== shown) {
            shown = percent
            report({})
          }
        }
      })
      files.push(file)
    }
    report({ stage: 'checksum', file: null })
    for (const [i, asset] of choice.assets.entries()) {
      if (!asset.sha256) continue
      if ((await sha256Of(files[i])) !== asset.sha256) {
        fs.rmSync(files[i], { force: true })
        throw new Error(`${asset.name} did not match the checksum the release published, so it was removed. Try again.`)
      }
    }
    report({ stage: 'unpack' })
    const staging = partOf(folder)
    fs.rmSync(staging, { recursive: true, force: true })
    try {
      const home = await helper.unpack(files, staging)
      fs.rmSync(folder, { recursive: true, force: true })
      fs.renameSync(home, folder)
    } finally {
      fs.rmSync(staging, { recursive: true, force: true })
    }
    for (const file of files) fs.rmSync(file, { force: true })
    const version = addVersion(id, { tag: input.tag, build: input.build, label: choice.label, folder, external: false, installedAt: Date.now(), checksum: choice.assets.every((a) => a.sha256) ? true : null }, path.basename(folder))
    report({ stage: 'verify', version: version.id })
    await verifyVersion(id, version.id)
    report({ stage: 'done' })
  } catch (err) {
    report({ stage: signal.aborted ? 'cancelled' : 'failed', error: signal.aborted ? null : err instanceof Error ? err.message : String(err) })
    if (!signal.aborted) throw err
  } finally {
    running.delete(id)
    installEvents.changed(id)
  }
}

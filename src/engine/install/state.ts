import fs from 'node:fs'
import path from 'node:path'
import type { InstallHelperState, InstallRelease, InstallVersion } from '@shared/types'
import { helperOf, schemaOf, type StoredRelease } from './registry'
import { readCheck, rootOf, settingsOf } from './store'
import { adopt, checkOnce, holders } from './versions'
import { checkIfDue } from './releases'
import { jobOf } from './job'

function releaseView(r: StoredRelease): InstallRelease {
  return { tag: r.tag, name: r.name, publishedAt: r.publishedAt, url: r.url }
}

function versionView(id: string, v: ReturnType<typeof adopt>['versions'][number]): InstallVersion {
  const check = readCheck(id, v.id)
  return {
    id: v.id,
    tag: v.tag,
    build: v.build,
    label: v.label ?? v.id,
    folder: v.folder,
    external: v.external,
    installedAt: v.installedAt,
    checksum: v.checksum,
    check: check ? { at: check.at, ok: check.ok, version: check.version, devices: check.devices, error: check.error } : null,
    inUse: holders(id, v.id)
  }
}

export function installState(id: string): InstallHelperState {
  const helper = helperOf(id)
  const r = adopt(id)
  const settings = settingsOf(id)
  checkIfDue(id, Number(settings.updateCheckHours) || 0)
  const active = r.versions.find((v) => v.id === r.active) ?? null
  if (active && !readCheck(id, active.id)) checkOnce(id, active.id)
  const newest = r.releases[0] ?? null
  const newer = newest !== null && Boolean(active?.tag) && newest.tag !== active?.tag && !r.versions.some((v) => v.tag === newest.tag)
  return {
    id,
    title: helper.title,
    about: helper.about,
    source: helper.source(settings),
    program: helper.program,
    root: rootOf(id),
    defaultRoot: helper.defaultRoot(),
    active: active?.id ?? null,
    versions: r.versions.map((v) => versionView(id, v)),
    releases: r.releases.map(releaseView),
    checkedAt: r.checkedAt,
    update: newer && newest ? releaseView(newest) : null,
    job: jobOf(id),
    settings,
    schema: schemaOf(helper)
  }
}

export function freeSpace(folder: string): number | null {
  let dir = path.resolve(folder)
  while (!fs.existsSync(dir)) {
    const up = path.dirname(dir)
    if (up === dir) return null
    dir = up
  }
  try {
    const s = fs.statfsSync(dir)
    return s.bavail * s.bsize
  } catch {
    return null
  }
}

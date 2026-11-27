import fs from 'node:fs'
import path from 'node:path'
import type { PortableFileMeta } from '@shared/portability'
import type { LooseFile } from './codec'

const OUTSIDE = /^(?:[\\/]|[A-Za-z]:)|\0/

function inside(folder: string, target: string): boolean {
  return target.startsWith(folder + path.sep)
}

export function looseFiles(jsonPath: string, budget: { left: number }): LooseFile {
  const folder = fs.realpathSync(path.dirname(jsonPath))
  return (meta: PortableFileMeta) => {
    const rel = (meta.path ?? meta.name ?? '').trim()
    if (!rel || OUTSIDE.test(rel) || path.isAbsolute(rel) || path.win32.isAbsolute(rel)) return null
    const target = path.resolve(folder, rel)
    if (!inside(folder, target)) return null
    let real: string
    try {
      real = fs.realpathSync(target)
    } catch {
      return null
    }
    if (!inside(folder, real)) return null
    const stat = fs.lstatSync(real)
    if (!stat.isFile()) return null
    if (stat.size > budget.left) throw new Error(`${rel} would take this import over the unpack limit. Raise "Maximum unpacked size" in Settings, or make the file smaller.`)
    budget.left -= stat.size
    return fs.readFileSync(real)
  }
}

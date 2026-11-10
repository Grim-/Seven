import fs from 'node:fs'
import path from 'node:path'
import { extractZip } from '../../../model/zip'

export async function unpackServer(files: string[], staging: string, program: string): Promise<string> {
  const [build, ...rest] = files
  await extractZip(build, (name) => name, staging)
  const home = fs.existsSync(path.join(staging, program))
    ? staging
    : fs
        .readdirSync(staging, { withFileTypes: true })
        .filter((d) => d.isDirectory() && fs.existsSync(path.join(staging, d.name, program)))
        .map((d) => path.join(staging, d.name))[0]
  if (!home) throw new Error(`${path.basename(build)} has no ${program} in it, so this release can't be used.`)
  for (const runtime of rest) await extractZip(runtime, (name) => path.basename(name), home)
  return home
}

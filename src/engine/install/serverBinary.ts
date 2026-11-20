import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { extractZip } from '../model/zip'
import type { Checked } from './registry'

interface Ran {
  code: number | null
  out: string
}

export interface VerifyServerOptions {
  /** Whether `--version` returning exit code 0 is strictly required; when false, `--help` returning 0 also passes. */
  requireVersion?: boolean
  /** Whether to run `--list-devices` and report its output (defaults to true). */
  listDevices?: boolean
}

function run(exe: string, args: string[], seconds: number): Promise<Ran> {
  return new Promise((resolve) => {
    execFile(exe, args, { cwd: path.dirname(exe), windowsHide: true, timeout: seconds * 1000 }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === 'number' ? err.code : null) : 0
      resolve({ code, out: `${stdout}${stderr}`.replace(/\x1b\[[0-9;]*m/g, '').trim() })
    })
  })
}

export function helpFlags(help: string): string[] {
  const flags = new Set<string>()
  for (const m of help.matchAll(/--\[no-\]([a-zA-Z][\w-]*)/g)) {
    flags.add(`--${m[1]}`)
    flags.add(`--no-${m[1]}`)
  }
  for (const m of help.matchAll(/(?<![\w-])(--?[a-zA-Z][\w-]*)/g)) flags.add(m[1])
  return [...flags].sort()
}

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

export async function verifyServer(exe: string, seconds: number, opts?: VerifyServerOptions): Promise<Checked> {
  const requireVersion = opts?.requireVersion ?? true
  const checkDevices = opts?.listDevices ?? true
  const version = await run(exe, ['--version'], seconds)
  const help = await run(exe, ['--help'], seconds)
  const devices = checkDevices ? await run(exe, ['--list-devices'], seconds) : { code: 1, out: '' }
  const ok = requireVersion ? version.code === 0 : version.code === 0 || help.code === 0
  const versionText = version.code === 0 ? version.out : help.out.split(/\r?\n/).find((l) => l.trim()) ?? ''
  return {
    ok,
    version: versionText,
    devices: checkDevices && (requireVersion || devices.code === 0) ? devices.out : '',
    help: help.out,
    flags: help.code === 0 ? helpFlags(help.out) : null,
    error: ok ? null : version.out || help.out || `${path.basename(exe)} did not run (exit code ${version.code ?? help.code ?? 'unknown'}).`
  }
}

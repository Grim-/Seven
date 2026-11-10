import path from 'node:path'
import { execFile } from 'node:child_process'
import type { Checked } from '../../registry'

interface Ran {
  code: number | null
  out: string
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

export async function verifyServer(exe: string, seconds: number): Promise<Checked> {
  const version = await run(exe, ['--version'], seconds)
  const help = await run(exe, ['--help'], seconds)
  const devices = await run(exe, ['--list-devices'], seconds)
  const ok = version.code === 0
  return {
    ok,
    version: version.out,
    devices: devices.out,
    help: help.out,
    flags: help.code === 0 ? helpFlags(help.out) : null,
    error: ok ? null : version.out || `${path.basename(exe)} did not run (exit code ${version.code ?? 'unknown'}).`
  }
}

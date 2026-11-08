import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { removePath, writeUserFile } from '../../util/fs'
import { serverRoot } from './install'

const IMAGE = 'llama-server.exe'
const live = new Set<number>()
let report: (pids: number[]) => void = () => undefined

function file(): string {
  return path.join(serverRoot(), 'running.json')
}

function save(): void {
  try {
    if (live.size) writeUserFile(file(), JSON.stringify([...live]))
    else removePath(file())
  } catch (err) {
    console.warn('[llama-server] could not record running processes:', err instanceof Error ? err.message : err)
  }
  report([...live])
}

export function reportChildren(fn: (pids: number[]) => void): void {
  report = fn
}

export function childStarted(pid: number): void {
  live.add(pid)
  save()
}

export function childEnded(pid: number): void {
  if (!live.delete(pid)) return
  save()
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => execFile(cmd, args, { windowsHide: true }, (err, stdout) => resolve(err ? '' : stdout)))
}

export async function endIfServer(pid: number): Promise<boolean> {
  const listed = await run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'])
  if (!listed.toLowerCase().includes(`"${IMAGE}"`)) return false
  await run('taskkill', ['/PID', String(pid), '/F'])
  return true
}

export async function endLeftovers(): Promise<number> {
  if (process.platform !== 'win32') return 0
  let pids: unknown
  try {
    pids = JSON.parse(fs.readFileSync(file(), 'utf8'))
  } catch {
    return 0
  }
  let ended = 0
  for (const pid of Array.isArray(pids) ? pids : []) if (typeof pid === 'number' && !live.has(pid) && (await endIfServer(pid))) ended += 1
  if (!live.size) removePath(file())
  return ended
}

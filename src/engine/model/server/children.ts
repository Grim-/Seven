import { noteFailure, reportError } from '../../util/report'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { removePath, writeUserFile } from '../../util/fs'
import { machineRoot } from '../../install/paths'
import { helperOf } from '../../install/registry'
import { LLAMA_SERVER, LLAMA_SERVER_PROGRAM } from '../../install/helpers/llamaServer'
import { SD_SERVER_PROGRAM } from '../../install/helpers/sdServer'

const SERVER_IMAGES = [LLAMA_SERVER_PROGRAM.toLowerCase(), SD_SERVER_PROGRAM.toLowerCase()]
const live = new Set<number>()
let report: (pids: number[]) => void = () => undefined

function file(): string {
  return path.join(machineRoot(), 'servers-running.json')
}

function oldLlamaFile(): string {
  return path.join(machineRoot(), `${LLAMA_SERVER}-running.json`)
}

function legacyFile(): string {
  return path.join(helperOf(LLAMA_SERVER).defaultRoot(), 'running.json')
}

function save(): void {
  try {
    if (live.size) writeUserFile(file(), JSON.stringify([...live]))
    else removePath(file())
  } catch (err) {
    reportError('warning', 'server', err, 'Could not record running model servers, so they may be left running after a crash')
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

export async function endIfServer(pid: number, program?: string): Promise<boolean> {
  const listed = (await run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'])).toLowerCase()
  const targets = program ? [program.toLowerCase()] : SERVER_IMAGES
  if (!targets.some((img) => listed.includes(`"${img}"`))) return false
  await run('taskkill', ['/PID', String(pid), '/F'])
  return true
}

function recorded(at: string): number[] {
  try {
    const pids = JSON.parse(fs.readFileSync(at, 'utf8')) as unknown
    return Array.isArray(pids) ? pids.filter((p): p is number => typeof p === 'number') : []
  } catch (err) {
    noteFailure(err, 'server', 'Could not read the list of running model servers')
    return []
  }
}

export async function endLeftovers(): Promise<number> {
  if (process.platform !== 'win32') return 0
  let ended = 0
  for (const at of [file(), oldLlamaFile(), legacyFile()]) {
    for (const pid of recorded(at)) if (!live.has(pid) && (await endIfServer(pid))) ended += 1
    if (at !== file() || !live.size) removePath(at)
  }
  return ended
}

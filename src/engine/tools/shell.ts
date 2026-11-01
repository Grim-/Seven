import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import type { ShellInfo } from '@shared/types'

export const DEFAULT_TIMEOUT = 120
export const MAX_TIMEOUT = 600
export const MAX_OUTPUT = 200_000

let cached: ShellInfo | null | undefined

function which(name: string): string | null {
  try {
    const out = execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf8', windowsHide: true })
    return out.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? null
  } catch {
    return null
  }
}

function findGitBash(): string | null {
  const candidates = [
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Git', 'bin', 'bash.exe'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Git', 'bin', 'bash.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe')
  ].filter((p): p is string => Boolean(p))
  const git = which('git')
  if (git) candidates.push(path.resolve(path.dirname(git), '..', 'bin', 'bash.exe'))
  return candidates.find((p) => fs.existsSync(p)) ?? null
}

export function detectShell(): ShellInfo | null {
  if (cached !== undefined) return cached
  if (process.platform === 'win32') {
    const bash = findGitBash()
    if (bash) cached = { name: 'Git Bash', path: bash, family: 'bash' }
    else {
      const pwsh = which('pwsh')
      cached = pwsh
        ? { name: 'PowerShell 7', path: pwsh, family: 'powershell' }
        : { name: 'Windows PowerShell', path: 'powershell.exe', family: 'powershell' }
    }
  } else {
    const bash = ['/bin/bash', '/usr/bin/bash'].find((p) => fs.existsSync(p)) ?? which('bash')
    cached = bash ? { name: 'bash', path: bash, family: 'bash' } : null
  }
  return cached
}

export function shellArgs(shell: ShellInfo, command: string): string[] {
  return shell.family === 'bash' ? ['-c', command] : ['-NoProfile', '-NonInteractive', '-Command', command]
}

export function cleanEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(SEVEN_|ELECTRON_)/i.test(key)) continue
    env[key] = value
  }
  return { ...env, NO_COLOR: '1', TERM: 'dumb', GIT_TERMINAL_PROMPT: '0', GIT_PAGER: 'cat', PAGER: 'cat' }
}

export function killTree(pid: number): void {
  try {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
    else process.kill(-pid, 'SIGKILL')
  } catch {
    return
  }
}

export const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g


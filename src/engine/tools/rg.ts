import { execFile } from 'node:child_process'
import { rgPath } from '@vscode/ripgrep'

const binary = rgPath.replace('app.asar', 'app.asar.unpacked')

export interface RgResult {
  lines: string[]
  truncated: boolean
}

export function runRg(args: string[], cwd: string, signal: AbortSignal, maxLines: number): Promise<RgResult> {
  return new Promise((resolve, reject) => {
    execFile(binary, args, { cwd, signal, maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      const code = (err as { code?: unknown } | null)?.code
      if (err && code !== 1) {
        if (signal.aborted) reject(new Error('Cancelled'))
        else reject(new Error(stderr.trim() || err.message))
        return
      }
      const all = stdout.split(/\r?\n/).filter(Boolean)
      resolve({ lines: all.slice(0, maxLines), truncated: all.length > maxLines })
    })
  })
}

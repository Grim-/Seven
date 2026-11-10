import { execFile } from 'node:child_process'

export function runText(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true }, (err, stdout) => resolve(err ? null : stdout))
  })
}

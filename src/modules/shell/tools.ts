import { spawn } from 'node:child_process'
import type { TerminalData } from '@shared/types'
import { gateCommand } from '../../engine/permissions/gate'
import { ToolError, optInt, str, type ToolDef } from '../../engine/tools/types'
import { registerOutputs } from '../../engine/tools/outputs'
import { workspaceRoot } from '../../engine/tools/workspace'
import { ANSI, DEFAULT_TIMEOUT, MAX_OUTPUT, MAX_TIMEOUT, cleanEnv, detectShell, killTree, shellArgs } from '../../engine/tools/shell'

function runCommand(showMedia: () => boolean): ToolDef {
  return {
    name: 'run_command',
    group: 'shell',
    needsWorkspace: true,
    description:
      'Run a shell command. It starts in the workspace folder, cannot read input from the keyboard, and is stopped after the timeout. Returns the combined output and exit code.',
    params: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command line to run' },
        timeoutSeconds: { type: ['integer', 'null'], description: `Seconds before the command is stopped. null for ${DEFAULT_TIMEOUT}. At most ${MAX_TIMEOUT}.` }
      }
    },
    async execute(params, ctx) {
      const shell = detectShell()
      if (!shell) throw new ToolError('No shell was found on this computer, so run_command can\'t run anything. Tell the user, or do the task with other tools.')
      const command = str(params, 'command').trim()
      const cwd = workspaceRoot(ctx.workspace)
      const timeout = Math.min(MAX_TIMEOUT, Math.max(1, optInt(params, 'timeoutSeconds') ?? DEFAULT_TIMEOUT))
      await gateCommand(ctx.permissions, command)
      if (ctx.signal.aborted) throw new ToolError('Cancelled')

      const started = Date.now() - 1000
      return new Promise((resolve) => {
        const child = spawn(shell.path, shellArgs(shell, command), {
          cwd,
          env: cleanEnv(),
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: process.platform !== 'win32',
          windowsHide: true
        })
        let output = ''
        let truncated = false
        let timedOut = false
        let settled = false
        const onData = (buf: Buffer) => {
          const text = buf.toString('utf8').replace(ANSI, '')
          if (output.length < MAX_OUTPUT) {
            output += text
            if (output.length > MAX_OUTPUT) {
              output = output.slice(0, MAX_OUTPUT)
              truncated = true
            }
            ctx.output(text)
          } else truncated = true
        }
        child.stdout?.on('data', onData)
        child.stderr?.on('data', onData)

        const stop = () => {
          if (child.pid) killTree(child.pid)
        }
        const timer = setTimeout(() => {
          timedOut = true
          stop()
        }, timeout * 1000)
        const onAbort = () => stop()
        ctx.signal.addEventListener('abort', onAbort, { once: true })

        const finish = (exitCode: number | null, error?: string) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          ctx.signal.removeEventListener('abort', onAbort)
          const body = (output + (truncated ? '\n… output truncated …' : '')).trimEnd()
          const status = error
            ? `[could not start: ${error}]`
            : timedOut
              ? `[stopped after ${timeout}s timeout]`
              : ctx.signal.aborted
                ? '[stopped by the user]'
                : `[exit code ${exitCode}]`
          const assets = error || !showMedia() ? [] : registerOutputs(ctx, cwd, started)
          const data: TerminalData = { command, shell: shell.name, output: body, exitCode, timedOut, ...(assets.length ? { assetIds: assets.map((a) => a.id) } : {}) }
          const made = assets.length
            ? `\nNew files from this command, now shown to the user (ids usable in widgets and asset fields):\n${assets.map((a) => `${a.id} ${a.source.original} (${a.kind})`).join('\n')}`
            : ''
          resolve({ text: `$ ${command}\n${body}${body ? '\n' : ''}${status}${made}`, view: { kind: 'terminal', title: command, data } })
        }
        child.on('error', (err) => finish(null, err.message))
        child.on('close', (code) => finish(code))
      })
    }
  }
}

export function shellTools(showMedia: () => boolean): ToolDef[] {
  return [runCommand(showMedia)]
}

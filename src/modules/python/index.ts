import fs from 'node:fs'
import type { ModuleFactory } from '../../engine/modules/sdk'
import { ToolError, optStr, str, type ToolDef, type ToolOutput } from '../../engine/tools/types'
import { runCode, scripts, setupEnv, workFolder, type RunResult } from '../../engine/python/scripts'
import { linkFor } from '@shared/text'

function output(result: RunResult, ctx: Parameters<ToolDef['execute']>[1]): ToolOutput {
  if (!result.files.length) return { text: result.text }
  const view = { kind: 'assets' as const, title: 'Python output', data: { assetIds: result.files.map((a) => a.id) } }
  try {
    ctx.panel.show({ view })
  } catch {}
  return { text: result.text, view }
}

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    async onAction(name: string): Promise<string> {
      if (name !== 'setup_env') throw new ToolError(`Python has no action "${name}"`)
      return setupEnv()
    }

    define(tools: { add(tool: ToolDef): void }): void {
      tools.add({
        name: 'run_python',
        command: true,
        group: 'python',
        activity: () => 'running Python code',
        needsWorkspace: false,
        description: 'Run Python code, or a saved script by name, and get what it prints. Runs in its own work folder with a time limit.',
        params: {
          type: 'object',
          properties: {
            code: { type: ['string', 'null'], description: 'The whole Python script. Use print() for results.' },
            script: { type: ['string', 'null'], description: 'A saved script to run instead' }
          }
        },
        execute: async (params, ctx) => {
          const hooks = { signal: ctx.signal, onOutput: ctx.output, sessionId: ctx.sessionId, checkpoint: (abs: string, prev: Buffer | null) => ctx.checkpoints.save(abs, prev) }
          const name = optStr(params, 'script')
          if (name) return output((await scripts.run(name, hooks)).result, ctx)
          const code = optStr(params, 'code')
          if (!code) throw new ToolError('Set code to the Python script to run, or script to the name of a saved one.')
          return output(await runCode(code, hooks), ctx)
        }
      })
      tools.add({
        name: 'python_save',
        group: 'python',
        needsWorkspace: false,
        description: 'Save a Python script by name so it can be run again (by you or the user). Saving an existing name replaces it.',
        params: { type: 'object', properties: { name: { type: 'string' }, code: { type: 'string' }, description: { type: ['string', 'null'] } } },
        execute: async (params) => {
          const s = scripts.save({ name: str(params, 'name'), code: str(params, 'code'), description: optStr(params, 'description') })
          return `Saved ${linkFor('script', s.name)}.`
        }
      })
      tools.add({
        name: 'python_files',
        group: 'python',
        needsWorkspace: false,
        description: 'List the files in the Python work folder.',
        params: { type: 'object', properties: {} },
        execute: async () => {
          const dir = workFolder()
          const files = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => !e.name.startsWith('.seven_run_'))
          return files.length ? files.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join('\n') : 'The work folder is empty.'
        }
      })
    }
  }

export default factory

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getLlama, LlamaChatSession, type LlamaContextSequence } from 'node-llama-cpp'
import { contextOptions, defaults, loadOptions, normalize } from '../src/engine/model/params'
import { chatWrapperFor } from '../src/engine/model/wrappers'
import { TurnMeter } from '../src/engine/chat/stats'
import { withState } from '../src/engine/chat/context'
import type { TurnStats } from '../src/shared/types'

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i > -1 ? (process.argv[i + 1] ?? null) : null
}

const WORDS = 'the agent reads a file then edits a function and runs the tests while the log keeps growing with output lines about modules builds warnings and results'.split(' ')

function filler(tokensApprox: number, seed: number): string {
  const lines: string[] = []
  let n = 0
  let i = seed
  while (n < tokensApprox) {
    const words = Array.from({ length: 12 }, () => WORDS[(i = (i * 1103515245 + 12345) % 2147483648) % WORDS.length])
    const line = `${lines.length + 1}: ${words.join(' ')}`
    lines.push(line)
    n += Math.ceil(line.length / 3.5)
  }
  return lines.join('\n')
}

const SYSTEM = [
  'You are Seven, a personal assistant running locally.',
  'Be brief. Answer in one short sentence.',
  '## Environment',
  `- Operating system: ${os.type()}`,
  '## Tools',
  '- Long tool results are cut short; read the rest with read.'
].join('\n')

interface Row {
  scenario: string
  turn: number
  stats: TurnStats
}

async function ask(chat: LlamaChatSession, text: string, outTokens: number): Promise<TurnStats> {
  const meter = new TurnMeter(chat)
  await chat.prompt(withState(text), {
    maxTokens: outTokens,
    budgets: { thoughtTokens: Math.min(16, outTokens) },
    onResponseChunk: () => meter.mark()
  })
  return meter.finish()
}

function line(r: Row): string {
  const s = r.stats
  const pct = s.promptTokens ? Math.round((s.reusedTokens / s.promptTokens) * 100) : 0
  return [
    r.scenario.padEnd(10),
    String(r.turn).padStart(3),
    String(s.promptTokens).padStart(7),
    `${pct}%`.padStart(6),
    String(s.evaluatedTokens).padStart(7),
    (s.ttftMs === null ? '—' : `${(s.ttftMs / 1000).toFixed(2)}s`).padStart(8),
    (s.tokensPerSecond === null ? '—' : `${s.tokensPerSecond}`).padStart(7)
  ].join('  ')
}

async function main(): Promise<void> {
  const modelPath = process.argv[2]
  if (!modelPath || !fs.existsSync(modelPath)) {
    console.error('Usage: npm run bench:context -- <model.gguf> [--context N] [--gpu-layers N] [--flash] [--skip-checks] [--turns N] [--chunk F] [--out N] [--no-state]')
    process.exit(1)
  }
  const config = normalize({
    ...defaults(),
    ...(arg('--context') ? { contextSize: Number(arg('--context')) } : {}),
    ...(arg('--gpu-layers') ? { gpuLayers: Number(arg('--gpu-layers')) } : {}),
    flashAttention: process.argv.includes('--flash'),
    skipMemoryChecks: process.argv.includes('--skip-checks')
  })
  const turns = Number(arg('--turns') ?? 6)
  const chunkShare = Number(arg('--chunk') ?? 0.06)
  const outTokens = Number(arg('--out') ?? 24)

  console.log(`Loading ${path.basename(modelPath)} …`)
  const llama = await getLlama()
  const model = await llama.loadModel({ modelPath, ...loadOptions(config) })
  const context = await model.createContext({ ...contextOptions(config), sequences: 1 })
  const sequence: LlamaContextSequence = context.getSequence()
  const wrapper = chatWrapperFor(model)
  const chunkTokens = Math.max(64, Math.floor(context.contextSize * chunkShare))
  console.log(
    `Context ${context.contextSize}, format ${wrapper.wrapperName}, GPU layers ${model.gpuLayers}, sliding window ${model.fileInsights.swaSize ?? 'none'}, checkpoints ${sequence.needsCheckpoints ? 'yes' : 'no'}`
  )
  console.log(`${turns} turns, each adding a ~${chunkTokens}-token tool-style result, replies capped at ${outTokens} tokens\n`)
  const rows: Row[] = []
  const header = ['scenario'.padEnd(10), 'turn'.padStart(3), 'prompt'.padStart(7), 'reused'.padStart(6), 'read'.padStart(7), 'first'.padStart(8), 'tok/s'.padStart(7)].join('  ')
  console.log(header)

  const record = (scenario: string, turn: number, stats: TurnStats) => {
    const row = { scenario, turn, stats }
    rows.push(row)
    console.log(line(row))
  }
  const message = (turn: number, seed: number) => `Here is output ${turn}:\n${filler(chunkTokens, seed)}\nWhat is the first word of line 2?`
  const fresh = async () => {
    await sequence.clearHistory()
  }

  await fresh()
  const stable = new LlamaChatSession({ contextSequence: sequence, chatWrapper: wrapper, systemPrompt: SYSTEM, autoDisposeSequence: false })
  for (let t = 1; t <= turns; t++) record('stable', t, await ask(stable, message(t, t), outTokens))
  const stableHistory = stable.getChatHistory()

  let stateFile: string | null = null
  let stateInfo: { bytes: number; saveMs: number; loadMs: number } | null = null
  if (!process.argv.includes('--no-state')) {
    stateFile = path.join(os.tmpdir(), `seven-bench-${Date.now()}.bin`)
    const t0 = Date.now()
    const { fileSize } = await sequence.saveStateToFile(stateFile)
    const saveMs = Date.now() - t0
    await fresh()
    const t1 = Date.now()
    await sequence.loadStateFromFile(stateFile, { acceptRisk: true })
    const loadMs = Date.now() - t1
    stateInfo = { bytes: fileSize, saveMs, loadMs }
    stable.dispose({ disposeSequence: false })
    const restored = new LlamaChatSession({ contextSequence: sequence, chatWrapper: wrapper, systemPrompt: SYSTEM, autoDisposeSequence: false })
    restored.setChatHistory(stableHistory)
    record('restored', turns + 1, await ask(restored, message(turns + 1, 99), outTokens))
    restored.dispose({ disposeSequence: false })
  } else {
    stable.dispose({ disposeSequence: false })
  }

  await fresh()
  let history = [] as ReturnType<LlamaChatSession['getChatHistory']>
  for (let t = 1; t <= turns; t++) {
    const chat = new LlamaChatSession({ contextSequence: sequence, chatWrapper: wrapper, systemPrompt: `${SYSTEM}\nCollections: list version ${t}`, autoDisposeSequence: false })
    if (history.length) chat.setChatHistory([{ type: 'system', text: `${SYSTEM}\nCollections: list version ${t}` }, ...history.filter((h) => h.type !== 'system')])
    record('changing', t, await ask(chat, message(t, t), outTokens))
    history = chat.getChatHistory()
    chat.dispose({ disposeSequence: false })
  }

  await fresh()
  const histories: Record<'A' | 'B', ReturnType<LlamaChatSession['getChatHistory']>> = { A: [], B: [] }
  for (let t = 1; t <= turns; t++) {
    const which = t % 2 === 1 ? 'A' : 'B'
    const chat = new LlamaChatSession({ contextSequence: sequence, chatWrapper: wrapper, systemPrompt: SYSTEM, autoDisposeSequence: false })
    if (histories[which].length) chat.setChatHistory(histories[which])
    record(`switch-${which}`, t, await ask(chat, message(t, t + 50), outTokens))
    histories[which] = chat.getChatHistory()
    chat.dispose({ disposeSequence: false })
  }

  const summary = (name: string) => {
    const list = rows.filter((r) => r.scenario.startsWith(name) && r.turn > 1 && r.stats.ttftMs !== null)
    if (!list.length) return null
    return Math.round(list.reduce((a, r) => a + (r.stats.ttftMs ?? 0), 0) / list.length)
  }
  console.log('\nAverage time to first token after turn 1:')
  for (const name of ['stable', 'changing', 'switch']) {
    const v = summary(name)
    if (v !== null) console.log(`  ${name.padEnd(9)} ${(v / 1000).toFixed(2)}s`)
  }
  if (stateInfo) {
    console.log(
      `\nSaved state: ${(stateInfo.bytes / 1024 / 1024).toFixed(1)} MB, save ${(stateInfo.saveMs / 1000).toFixed(2)}s, load ${(stateInfo.loadMs / 1000).toFixed(2)}s; first token after restoring: ${((rows.find((r) => r.scenario === 'restored')?.stats.ttftMs ?? 0) / 1000).toFixed(2)}s`
    )
  }

  const outDir = path.join(process.cwd(), 'scripts', 'bench', 'results')
  fs.mkdirSync(outDir, { recursive: true })
  const file = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        model: path.basename(modelPath),
        config,
        contextSize: context.contextSize,
        wrapper: wrapper.wrapperName,
        gpuLayers: model.gpuLayers,
        swaSize: model.fileInsights.swaSize ?? null,
        needsCheckpoints: sequence.needsCheckpoints,
        chunkTokens,
        outTokens,
        state: stateInfo,
        rows
      },
      null,
      2
    )
  )
  console.log(`\nFull results: ${path.relative(process.cwd(), file)}`)
  if (stateFile) fs.rmSync(stateFile, { force: true })
  await context.dispose()
  await model.dispose()
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

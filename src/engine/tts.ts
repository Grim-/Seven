import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { killTree } from './tools/shell'
import { registerAttribution } from './credits'

registerAttribution({
  id: 'piper-tts',
  name: 'Piper TTS',
  category: 'Voice',
  license: 'MIT',
  url: 'https://github.com/rhasspy/piper',
  usedFor: 'Local offline neural text-to-speech voices in Seven.',
  source: 'tts:piper'
})

const MAX_TEXT = 4000

export function piperVoices(folder: string): { name: string; file: string }[] {
  const dir = folder.trim()
  if (!dir || !fs.existsSync(dir)) return []
  const out: { name: string; file: string }[] = []
  const walk = (d: string, depth: number) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory() && depth < 2) walk(p, depth + 1)
      else if (e.isFile() && e.name.endsWith('.onnx')) out.push({ name: e.name.slice(0, -5), file: p })
    }
  }
  walk(dir, 0)
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export function piperSpeak(exe: string, folder: string, voice: string, text: string, rate: number): Promise<string> {
  if (!exe || !fs.existsSync(exe)) return Promise.reject(new Error('Piper was not found. Set its path in Settings > Voices.'))
  const model = piperVoices(folder).find((v) => v.name === voice)
  if (!model) return Promise.reject(new Error(`No Piper voice "${voice}" in the voices folder`))
  const clipped = text.slice(0, MAX_TEXT)
  const out = path.join(os.tmpdir(), `seven-tts-${process.pid}-${Date.now().toString(36)}.wav`)
  const lengthScale = (1 / Math.min(2, Math.max(0.5, rate || 1))).toFixed(2)
  return new Promise((resolve, reject) => {
    const child = spawn(exe, ['--model', model.file, '--output_file', out, '--length_scale', lengthScale], { windowsHide: true })
    let err = ''
    const timer = setTimeout(() => child.pid && killTree(child.pid), 60_000)
    child.stderr.on('data', (c: Buffer) => (err = (err + c.toString('utf8')).slice(-2000)))
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(new Error(`Could not start Piper: ${e.message}`))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      try {
        if (code !== 0 || !fs.existsSync(out)) return reject(new Error(`Piper failed${err ? `: ${err.trim().split('\n').pop()}` : ''}`))
        resolve(fs.readFileSync(out).toString('base64'))
      } finally {
        fs.rmSync(out, { force: true })
      }
    })
    child.stdin.end(clipped.replace(/\s+/g, ' ').trim() + '\n', 'utf8')
  })
}

import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import type { ImageModelConfig } from '@shared/types'
import { SD_SERVER_PROGRAM, type SdServerLimits } from '../install/helpers/sdServer'
import { childEnded, childStarted, endIfServer } from '../model/server/children'
import { freePort, portTaken, sleep, waitWithAbort } from '../model/server/net'

class PortTaken extends Error {}

export interface ImagePipelineSpec {
  mode: 'model' | 'diffusion'
  modelPath: string
  vae: string | null
  tae: string | null
  clipL: string | null
  clipG: string | null
  t5xxl: string | null
  llm: string | null
  llmVision: string | null
  loraDir: string | null
  config: ImageModelConfig
}

export interface ImageServerOptions {
  exe: string
  version: string
  args: string[]
  signal: AbortSignal
  limits: SdServerLimits
  onLog?: (log: string[]) => void
  onExit: (message: string) => void
  hold?: () => () => void
}

/** Build CLI arguments for spawning stable-diffusion.cpp `sd-server`. */
export function buildSdServerArgs(
  pipeline: ImagePipelineSpec,
  buildFlags: string[] | null = null,
  overrideLoraDir: string | null = null
): string[] {
  const args: string[] = [pipeline.mode === 'diffusion' ? '--diffusion-model' : '--model', pipeline.modelPath]
  if (pipeline.vae) args.push('--vae', pipeline.vae)
  if (pipeline.tae) args.push('--taesd', pipeline.tae)
  if (pipeline.clipL) args.push('--clip_l', pipeline.clipL)
  if (pipeline.clipG) args.push('--clip_g', pipeline.clipG)
  if (pipeline.t5xxl) args.push('--t5xxl', pipeline.t5xxl)
  if (pipeline.llm) args.push('--llm', pipeline.llm)
  if (pipeline.llmVision) args.push('--llm_vision', pipeline.llmVision)
  const effectiveLoraDir = pipeline.loraDir ?? overrideLoraDir
  if (effectiveLoraDir) args.push('--lora-model-dir', effectiveLoraDir)
  if (pipeline.config.clipOnCpu) args.push('--clip-on-cpu')
  if (pipeline.config.vaeTiling) args.push('--vae-tiling')
  if (pipeline.config.offloadToCpu) args.push('--offload-to-cpu')
  if (pipeline.config.flashAttention) {
    if (buildFlags?.includes('--flash-attn')) args.push('--flash-attn', 'on')
    else args.push('--diffusion-fa')
  }
  return args
}

export class ImageServer {
  readonly startedAt = Date.now()
  private tail: string[] = []
  private stopping = false
  private listening = false
  private listenWaiters = new Set<() => void>()
  private exited: Promise<void>
  private lastOutput = Date.now()
  private onLog?: (log: string[]) => void

  private constructor(
    private child: ChildProcess,
    readonly port: number,
    readonly args: string[],
    readonly version: string,
    private limits: SdServerLimits,
    onLog?: (log: string[]) => void
  ) {
    this.onLog = onLog
    this.exited = new Promise((resolve) => child.once('exit', () => resolve()))
    child.once('exit', () => this.wakeWaiters())
    for (const stream of [child.stdout, child.stderr]) {
      let rest = ''
      stream?.on('data', (data: Buffer) => {
        const lines = (rest + data.toString()).split(/\r?\n/)
        rest = lines.pop() ?? ''
        for (const line of lines) this.keep(line)
      })
      stream?.on('end', () => {
        if (rest) this.keep(rest)
        rest = ''
      })
    }
  }

  private wakeWaiters(): void {
    for (const wake of this.listenWaiters) wake()
    this.listenWaiters.clear()
  }

  private keep(raw: string): void {
    const line = raw.replace(/\x1b\[[0-9;]*m/g, '').trimEnd()
    if (!line.trim()) return
    this.lastOutput = Date.now()
    if (!this.listening && /\blistening\s+(?:on|at)\b/i.test(line)) {
      this.listening = true
      this.wakeWaiters()
    }
    this.tail.push(line)
    if (this.tail.length > this.limits.logLines) this.tail.splice(0, this.tail.length - this.limits.logLines)
    this.onLog?.([...this.tail])
  }

  get baseUrl(): string {
    return `http://127.0.0.1:${this.port}`
  }

  get pid(): number | null {
    return this.child.pid ?? null
  }

  lastLines(): string {
    return this.tail.slice(-30).join('\n')
  }

  logLines(): string[] {
    return [...this.tail]
  }

  static async start(o: ImageServerOptions): Promise<ImageServer> {
    let last: Error | null = null
    for (let left = o.limits.portRetries; ; left--) {
      try {
        return await ImageServer.launch(o, await freePort('sd-server'))
      } catch (err) {
        if (!(err instanceof PortTaken) || left === 0) throw err
        last = err
      }
    }
    throw last!
  }

  private static async launch(o: ImageServerOptions, port: number): Promise<ImageServer> {
    const release = o.hold?.() ?? (() => undefined)
    const fullArgs = ['--listen-ip', '127.0.0.1', '--listen-port', String(port), ...o.args]
    const server = await new Promise<ImageServer>((resolve, reject) => {
      const child = spawn(o.exe, fullArgs, { cwd: path.dirname(o.exe), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
      child.once('error', (err) => {
        release()
        reject(new Error(`sd-server could not start: ${err.message}`))
      })
      child.once('spawn', () => {
        if (child.pid) {
          const pid = child.pid
          childStarted(pid)
          child.once('exit', () => childEnded(pid))
        }
        resolve(new ImageServer(child, port, o.args, o.version, o.limits, o.onLog))
      })
    })
    let readyDone = false
    server.child.once('exit', (code) => {
      release()
      if (server.stopping || !readyDone) return
      o.onExit(`sd-server stopped (exit code ${code ?? 'unknown'}).${server.tail.length ? `\n${server.lastLines()}` : ''}`)
    })
    await server.ready(o.signal, port)
    readyDone = true
    return server
  }

  private waitListeningTick(ms: number, signal: AbortSignal): Promise<void> {
    if (this.listening || this.child.exitCode !== null || signal.aborted) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const done = () => {
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        this.listenWaiters.delete(done)
        resolve()
      }
      const onAbort = () => {
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        this.listenWaiters.delete(done)
        reject(new Error('Image server loading was cancelled'))
      }
      const timer = setTimeout(done, ms)
      this.listenWaiters.add(done)
      signal.addEventListener('abort', onAbort, { once: true })
    })
  }

  private async ready(signal: AbortSignal, port: number): Promise<void> {
    let exit: { code: number | null; signal: NodeJS.Signals | null } | null = null
    this.child.once('exit', (code, sig) => {
      exit = { code, signal: sig }
      this.wakeWaiters()
    })
    try {
      const checkHealthState = async (): Promise<void> => {
        if (signal.aborted) throw new Error('Image server loading was cancelled')
        if (exit) {
          if (await portTaken(port)) throw new PortTaken(`Port ${port} was taken while sd-server started`)
          throw new Error(`sd-server exited while starting.${this.tail.length ? `\n${this.lastLines()}` : ''}`)
        }
        if (this.limits.stallSeconds > 0 && Date.now() - this.lastOutput > this.limits.stallSeconds * 1000) {
          throw new Error(`sd-server stopped answering while loading the image model.${this.tail.length ? `\n${this.lastLines()}` : ''}`)
        }
      }

      // sd-server loads model weights before starting its HTTP listener, so wait until
      // it logs "listening on: ..." instead of hammering an unready process at startup.
      while (!this.listening) {
        await checkHealthState()
        if (this.listening) break
        await this.waitListeningTick(1000, signal)
      }

      for (;;) {
        await checkHealthState()
        if (await this.probeReady()) return
        await waitWithAbort(this.limits.healthPollMs, signal, 'Image server loading was cancelled')
      }
    } catch (err) {
      await this.stop()
      throw err
    }
  }

  private async probeReady(): Promise<boolean> {
    try {
      const statusRes = await fetch(`${this.baseUrl}/sdcpp/v1/models/status`, { signal: AbortSignal.timeout(2000) })
      if (statusRes.ok) {
        const status = (await statusRes.json()) as { state?: string; error?: string | null }
        if (status.state === 'ready') return true
        if (status.state === 'error') throw new Error(status.error || 'sd-server failed to load the image model.')
        if (status.state === 'empty') throw new Error('sd-server started without an active image model.')
        return false
      }
      if (statusRes.status !== 404) return false
    } catch (err) {
      // Rethrow explicit server load failures; transient connection refused right after log line retries next tick
      if (err instanceof Error && (err.message.includes('failed to load') || err.message.includes('without an active'))) throw err
      return false
    }

    // Fallback for older sd-server builds without /sdcpp/v1/models/status
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, { signal: AbortSignal.timeout(2000) })
      if (!res.ok) return false
      const body = (await res.json()) as { data?: unknown[] }
      return Array.isArray(body.data) && body.data.length > 0
    } catch {
      // Socket may still be finishing bind right after logging listening
      return false
    }
  }

  private async exitWithin(seconds: number): Promise<boolean> {
    return Promise.race([this.exited.then(() => true), sleep(seconds * 1000).then(() => false)])
  }

  async stop(): Promise<void> {
    this.stopping = true
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill()
    if (!(await this.exitWithin(this.limits.stopSeconds)) && this.child.pid) {
      await endIfServer(this.child.pid, SD_SERVER_PROGRAM)
      const exited = await this.exitWithin(this.limits.stopSeconds)
      if (!exited) throw new Error(`sd-server (PID ${this.child.pid}) did not exit within ${this.limits.stopSeconds}s.`)
    }
  }
}

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { ElicitRequestSchema, ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { AssetsViewData, FormAnswer, FormField, FormProps } from '@shared/types'
import { ToolError, type ToolContext, type ToolOutput } from '../tools/types'
import { data } from '../data/hub'
import { fillSettings, type McpConfig } from './manifest'
import { stripNulls, toGrammarSchema } from './schema'
import type { ModuleTool } from './sdk'

const CALL_TIMEOUT_MS = 10 * 60 * 1000

interface RemoteTool {
  name: string
  description?: string
  inputSchema?: unknown
}

function fill(record: Record<string, string>, values: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, fillSettings(v, values)]))
}

function formFrom(message: string, schema: unknown, server: string): FormProps {
  const node = (schema && typeof schema === 'object' ? schema : {}) as Record<string, unknown>
  const props = (node.properties ?? {}) as Record<string, Record<string, unknown>>
  const required = new Set(Array.isArray(node.required) ? node.required.map(String) : [])
  const fields: FormField[] = Object.entries(props).map(([name, p]) => {
    const choices = Array.isArray(p.enum) ? p.enum.map(String) : null
    const type: FormField['type'] = choices ? 'choice' : p.type === 'number' || p.type === 'integer' || p.type === 'boolean' ? p.type : 'string'
    return {
      name,
      label: typeof p.title === 'string' && p.title ? p.title : name,
      type,
      ...(choices ? { choices } : {}),
      required: required.has(name),
      ...(typeof p.description === 'string' ? { description: p.description } : {}),
      ...(p.default !== undefined && ['string', 'number', 'boolean'].includes(typeof p.default) ? { default: p.default as string | number | boolean } : {})
    }
  })
  return { title: `${server} needs some information`, message, fields }
}

function saveBinary(base64: string, mime: string, sessionId: string, server: string): string {
  const ext = (mime.split('/')[1] ?? 'bin').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin'
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seven-mcp-'))
  const file = path.join(dir, `${server}-${Date.now()}.${ext}`)
  try {
    fs.writeFileSync(file, Buffer.from(base64, 'base64'))
    return data.assets.register(file, { tool: server, sessionId, original: null }).id
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

export class McpConnection {
  private client: Client | null = null
  private active: ToolContext | null = null
  status = 'disconnected'
  tools: RemoteTool[] = []

  constructor(
    private id: string,
    private config: McpConfig,
    private values: Record<string, unknown>,
    private onToolsChanged: () => void,
    private onClosed: (reason: string) => void
  ) {}

  private transport(): Transport {
    const c = this.config
    if (c.transport === 'stdio') {
      return new StdioClientTransport({
        command: fillSettings(c.command ?? '', this.values),
        args: c.args.map((a) => fillSettings(a, this.values)),
        env: { ...getDefaultEnvironment(), ...fill(c.env, this.values) },
        ...(c.cwd ? { cwd: fillSettings(c.cwd, this.values) } : {}),
        stderr: 'ignore'
      })
    }
    const url = new URL(fillSettings(c.url ?? '', this.values))
    const requestInit = { headers: fill(c.headers, this.values) }
    return c.transport === 'sse' ? new SSEClientTransport(url, { requestInit }) : new StreamableHTTPClientTransport(url, { requestInit })
  }

  async connect(): Promise<void> {
    this.status = 'connecting'
    const client = new Client({ name: 'seven', version: '1.0.0' }, { capabilities: { elicitation: {} } })
    client.setRequestHandler(ElicitRequestSchema, async (request) => {
      const ctx = this.active
      const params = request.params as { message?: string; requestedSchema?: unknown }
      if (!ctx) return { action: 'decline' }
      const answer = (await ctx.ui.ask('form', formFrom(params.message ?? '', params.requestedSchema, this.id))) as FormAnswer
      return answer.action === 'accept' ? { action: 'accept', content: answer.values } : { action: answer.action }
    })
    client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
      await this.refreshTools().catch(() => undefined)
      this.onToolsChanged()
    })
    const transport = this.transport()
    transport.onclose = () => {
      if (this.client === client) {
        this.status = 'disconnected'
        this.onClosed('The server closed the connection')
      }
    }
    await client.connect(transport)
    this.client = client
    await this.refreshTools()
    this.status = 'connected'
  }

  private async refreshTools(): Promise<void> {
    if (!this.client) return
    const all: RemoteTool[] = []
    let cursor: string | undefined
    for (let i = 0; i < 20; i++) {
      const page = await this.client.listTools(cursor ? { cursor } : undefined)
      all.push(...(page.tools as RemoteTool[]))
      cursor = page.nextCursor
      if (!cursor) break
    }
    this.tools = all
  }

  moduleTools(): ModuleTool[] {
    return this.tools
      .filter((t) => /^[A-Za-z0-9_.-]{1,64}$/.test(t.name))
      .map((t) => ({
        name: `${this.id.replace(/-/g, '_')}__${t.name.replace(/[.-]/g, '_')}`,
        description: (t.description ?? '').trim().slice(0, 1000) || `${t.name} from ${this.id}`,
        params: toGrammarSchema(t.inputSchema),
        execute: (args, ctx) => this.call(t, args, ctx)
      }))
  }

  private async call(tool: RemoteTool, args: Record<string, unknown>, ctx: ToolContext): Promise<string | ToolOutput> {
    if (!this.client) throw new ToolError(`The ${this.id} server is not connected, so its tools can't run now. Carry on without them, and tell the user to switch ${this.id} off and on again in Tools.`)
    this.active = ctx
    try {
      const result = await this.client.callTool({ name: tool.name, arguments: stripNulls(args, tool.inputSchema) as Record<string, unknown> }, undefined, {
        signal: ctx.signal,
        timeout: CALL_TIMEOUT_MS,
        resetTimeoutOnProgress: true
      })
      const texts: string[] = []
      const assetIds: string[] = []
      const content = Array.isArray(result.content) ? (result.content as Record<string, unknown>[]) : []
      for (const item of content) {
        if (item.type === 'text' && typeof item.text === 'string') texts.push(item.text)
        else if ((item.type === 'image' || item.type === 'audio') && typeof item.data === 'string') {
          const id = saveBinary(item.data, String(item.mimeType ?? 'application/octet-stream'), ctx.sessionId, this.id)
          assetIds.push(id)
          texts.push(`[${item.type} saved as file ${id}]`)
        } else if (item.type === 'resource' && item.resource && typeof item.resource === 'object') {
          const r = item.resource as Record<string, unknown>
          texts.push(typeof r.text === 'string' ? r.text : `[resource ${String(r.uri ?? '')}]`)
        } else if (item.type === 'resource_link') texts.push(`[link ${String(item.uri ?? '')}${item.name ? ` (${String(item.name)})` : ''}]`)
      }
      if (!texts.length && result.structuredContent) texts.push(JSON.stringify(result.structuredContent, null, 2))
      const text = texts.join('\n') || '(no output)'
      if (result.isError) throw new ToolError(text)
      if (!assetIds.length) return text
      const view: { kind: 'assets'; data: AssetsViewData } = { kind: 'assets', data: { assetIds } }
      return { text, view }
    } catch (err) {
      if (err instanceof ToolError) throw err
      throw new ToolError(`${this.id}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      this.active = null
    }
  }

  async close(): Promise<void> {
    const client = this.client
    this.client = null
    this.status = 'disconnected'
    await client?.close().catch(() => undefined)
  }
}

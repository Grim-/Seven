import { noteFailure } from '../util/report'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import type { CommandArg, CustomCommand } from '@shared/types'
import { hydrateCommandPrompt, sanitizeArgName } from '@shared/commandArgs'
import { dataRoot } from '../util/paths'
import { newId, readJson, writeJson } from '../util/fs'

const FILE = path.join(dataRoot, 'commands.json')
const NAME = /^[a-z][a-z0-9-]{0,31}$/

function cleanArgs(args?: CommandArg[]): CommandArg[] | undefined {
  if (!args?.length) return undefined
  const out: CommandArg[] = []
  const seen = new Set<string>()
  for (const raw of args) {
    const name = sanitizeArgName(raw.name)
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push({
      name,
      ...(raw.label?.trim() ? { label: raw.label.trim().slice(0, 60) } : {}),
      ...(raw.hint?.trim() ? { hint: raw.hint.trim().slice(0, 120) } : {}),
      ...(raw.default?.trim() ? { default: raw.default.trim().slice(0, 200) } : {})
    })
  }
  return out.length ? out : undefined
}

class CustomCommands extends EventEmitter {
  private taken: (name: string) => boolean = () => false

  setBuiltinCheck(fn: (name: string) => boolean): void {
    this.taken = fn
  }

  list(): CustomCommand[] {
    try {
      return readJson<CustomCommand[]>(FILE, [])
    } catch (err) {
      noteFailure(err, 'commands', 'Could not read the custom commands')
      return []
    }
  }

  find(ref: string): CustomCommand | null {
    const key = ref.trim().replace(/^\//, '').toLowerCase()
    return this.list().find((c) => c.id === ref.trim() || c.name === key) ?? null
  }

  private write(list: CustomCommand[]): void {
    writeJson(FILE, list)
    this.emit('changed', list)
  }

  save(input: { id: string | null; name: string; summary: string; prompt: string; args?: CommandArg[] }): CustomCommand {
    const name = input.name.trim().replace(/^\//, '').toLowerCase()
    if (!NAME.test(name)) throw new Error('A command name is lower-case letters, numbers and -, starting with a letter (up to 32)')
    if (this.taken(name)) throw new Error(`/${name} is a built-in command. Give this command a different name.`)
    const prompt = input.prompt.trim()
    if (!prompt) throw new Error('Write the prompt this command expands to')
    const list = this.list()
    if (list.some((c) => c.id !== input.id && c.name === name)) throw new Error(`There is already a /${name}. Give this command a different name, or change that one instead.`)
    const args = cleanArgs(input.args)
    const command: CustomCommand = {
      id: input.id && list.some((c) => c.id === input.id) ? input.id : newId('cmd'),
      name,
      summary: input.summary.trim().slice(0, 200),
      prompt,
      ...(args ? { args } : {}),
      updatedAt: Date.now()
    }
    this.write(list.some((c) => c.id === command.id) ? list.map((c) => (c.id === command.id ? command : c)) : [...list, command])
    return command
  }

  rename(id: string, name: string): void {
    const c = this.find(id)
    if (!c) throw new Error(`No command ${id}`)
    this.save({ id: c.id, name, summary: c.summary, prompt: c.prompt, args: c.args })
  }

  delete(id: string): boolean {
    const list = this.list()
    const next = list.filter((c) => c.id !== id)
    if (next.length === list.length) return false
    this.write(next)
    return true
  }
}

export const customCommands = new CustomCommands()

export function expand(command: CustomCommand, args: string): string {
  return hydrateCommandPrompt(command.prompt, args, command.args)
}

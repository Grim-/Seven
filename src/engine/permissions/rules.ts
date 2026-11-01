import path from 'node:path'
import type { PermissionRules } from '@shared/types'
import { dataRoot } from '../util/paths'
import { readJson, writeJson } from '../util/fs'

const FILE = path.join(dataRoot, 'permissions.json')

export const DEFAULT_RULES: PermissionRules = {
  allow: ['git status', 'git diff', 'git log', 'git show', 'pwd', 'ls'],
  deny: [
    're:\\brm\\s+(-\\w+\\s+)*-\\w*[rR]\\w*\\s+(-\\w+\\s+)*(/|~|\\*|\\.|\\.\\.|/\\*|~/\\*?|\\$home)(\\s|$)',
    're:\\bgit\\s+push\\b.*(--force|\\s-f\\b|--mirror|--delete)',
    're:\\bgit\\s+(reset\\s+--hard|clean\\s+-\\w*f)',
    're:\\b(mkfs|diskpart|shutdown|reboot|halt|poweroff|bcdedit|vssadmin)\\b',
    're:\\bformat(\\.com)?\\s+[a-z]:',
    're:\\bdd\\b.*\\bof=/dev/',
    're:\\b(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\\b.*\\|\\s*(sh|bash|zsh|iex|invoke-expression|python3?|node|pwsh|powershell)\\b',
    're:\\b(del|erase)\\b.*\\s/[sq]\\b',
    're:\\b(rd|rmdir)\\b.*\\s/s\\b',
    're:\\bremove-item\\b.*-r(ecurse)?\\b',
    're::\\(\\)\\s*\\{',
    're:\\bsudo\\b',
    're:\\breg(\\.exe)?\\s+(delete|add|import)\\b',
    're:\\bchmod\\s+(-\\w*R|--recursive)\\b',
    're:\\b(set-executionpolicy|takeown|icacls)\\b'
  ],
  protect: ['**/.git/**', '**/.seven/**', '.env', '.env.*']
}

function clean(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  return [...new Set(list.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean))]
}

export class PermissionStore {
  private rules: PermissionRules

  constructor() {
    const saved = readJson<Partial<PermissionRules> | null>(FILE, null)
    this.rules = saved
      ? { allow: clean(saved.allow), deny: clean(saved.deny), protect: clean(saved.protect) }
      : { ...DEFAULT_RULES }
  }

  get(): PermissionRules {
    return { allow: [...this.rules.allow], deny: [...this.rules.deny], protect: [...this.rules.protect] }
  }

  set(next: PermissionRules): PermissionRules {
    for (const entry of clean(next.deny)) {
      if (entry.startsWith('re:')) {
        try {
          new RegExp(entry.slice(3), 'i')
        } catch {
          throw new Error(`The deny rule "${entry}" is not a valid regular expression. Fix the pattern after re:, or drop the re: to block any command containing that text.`)
        }
      }
    }
    this.rules = { allow: clean(next.allow), deny: clean(next.deny), protect: clean(next.protect) }
    writeJson(FILE, this.rules)
    return this.get()
  }
}

import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { PermissionRules, ShellInfo } from '@shared/types'
import { Button, SaveState, SettingCard, SettingRow, Textarea, useAutosavedState } from '../components/ui'
import { engine } from '../lib/ipc'
import { failed } from '../lib/notify'
import { textLines } from '@shared/text'
import { noteFailure } from '../store/problems'

export function PermissionsPanel({ className }: { className?: string }) {
  type Draft = { allow: string; deny: string; protect: string }
  const [shell, setShell] = useState<ShellInfo | null>(null)
  const autosave = useAutosavedState<Draft | null>(null, (d) => engine('permissions.set', { allow: textLines(d!.allow), deny: textLines(d!.deny), protect: textLines(d!.protect) }), { when: (d) => d !== null })
  const rules = autosave.value

  const load = (r: PermissionRules) => autosave.reset({ allow: r.allow.join('\n'), deny: r.deny.join('\n'), protect: r.protect.join('\n') })

  useEffect(() => {
    engine('permissions.get').then(load).catch(failed('Could not load permissions'))
    engine('shell.info').then(setShell).catch(noteFailure('permissions', 'Could not read the shell', () => setShell(null)))
  }, [])

  if (!rules) return null

  const change = (next: Draft) => autosave.set(next)

  const reset = async () => {
    const defaults = await engine('permissions.defaults')
    change({ allow: defaults.allow.join('\n'), deny: defaults.deny.join('\n'), protect: defaults.protect.join('\n') })
  }

  const edit = (key: 'allow' | 'deny' | 'protect') => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    change({ ...rules, [key]: e.target.value })
  }

  return (
    <SettingCard
      className={className}
      title="Permissions"
      actions={
        <>
          <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => void reset()}>
            Defaults
          </Button>
          <SaveState status={autosave.status} error={autosave.error} />
        </>
      }
      intro={
        <>
        Commands run in <span className="text-white">{shell ? `${shell.name} (${shell.path})` : 'no shell found'}</span>. They are not sandboxed: a
        command can do anything you can. Your approval is the real safeguard; the rules below reduce how often you are asked and catch obvious
        mistakes, but no list of patterns can stop every way of writing a command.
        </>
      }
    >
      <SettingRow
        wide
        label="Allowed commands"
        hint="One per line. A command runs without asking only if it starts with one of these, has no chaining, pipes, redirects, variables or globs, and doesn't point outside the workspace."
      >
        <Textarea mono rows={5} value={rules.allow} onChange={edit('allow')} />
      </SettingRow>
      <SettingRow
        wide
        label="Denied commands"
        hint={'One per line. Blocked in every mode, including Trusted. Plain text matches anywhere in the command; start a line with re: for a regular expression. A tripwire, not a guarantee.'}
      >
        <Textarea mono rows={8} value={rules.deny} onChange={edit('deny')} />
      </SettingRow>
      <SettingRow wide label="Protected paths" hint="One glob per line, relative to the workspace. Edits to these always ask, even in Trusted mode.">
        <Textarea mono rows={4} value={rules.protect} onChange={edit('protect')} />
      </SettingRow>
    </SettingCard>
  )
}

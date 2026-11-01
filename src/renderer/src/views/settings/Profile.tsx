import { useEffect, useState } from 'react'
import { Input, SaveState, SettingCard, SettingRow, useAutosavedState } from '../../components/ui'
import { engine } from '../../lib/ipc'
import { Chip } from '../../components/chat/References'
import { MarkdownEditor } from '../../components/data/MarkdownEditor'

export function Profile() {
  const [loaded, setLoaded] = useState(false)
  const autosave = useAutosavedState({ name: '', about: '' }, (u) => engine('user.set', u), { when: () => loaded })
  const { name, about } = autosave.value
  useEffect(() => {
    void engine('user.get')
      .then((u) => {
        autosave.reset({ name: u.name, about: u.about })
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])
  return (
    <SettingCard
      title="You"
      actions={
        <>
          <span className="font-mono text-[10.5px] text-faint">kept in this vault</span>
          <SaveState status={autosave.status} error={autosave.error} />
        </>
      }
    >
      <SettingRow label="Name" hint="What every agent calls you. When you say I, me or my, this is who they take it to mean.">
        <Input value={name} disabled={!loaded} onChange={(e) => autosave.set((u) => ({ ...u, name: e.target.value }))} placeholder="Your name" maxLength={60} className="w-72" />
      </SettingRow>
      <SettingRow
        wide
        label="What every agent should know"
        hint="Anything you want every agent to always have: how to talk to you, what you're into, what to avoid. @links work, the same as in chat. Kept short, since it goes into every chat."
      >
        <div className="flex min-h-44 w-full">
          <MarkdownEditor
            compact
            value={about}
            onValue={(text) => autosave.set((u) => ({ ...u, about: text.slice(0, 4000) }))}
            placeholder="I'm in the UK, so metric and British spelling. Keep replies short unless I ask for more."
            className="min-w-0 flex-1"
          />
        </div>
      </SettingRow>
      <SettingRow label="Your profile page" hint="Agents know this page for everything longer. Type /profile in a chat to have an agent update it.">
        <Chip kind="page" refText="User Profile" />
      </SettingRow>
    </SettingCard>
  )
}

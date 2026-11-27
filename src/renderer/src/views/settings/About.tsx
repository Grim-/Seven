import { BookOpen } from 'lucide-react'
import { Button, SettingCard, SettingRow } from '../../components/ui'
import { openWelcomeTour } from '../../components/shell/WelcomeModal'
import { useApp } from '../../store/app'
import { useVault } from '../../store/vault'

export function About() {
  const info = useApp((s) => s.info)
  const vault = useVault((s) => s.status)
  return (
    <SettingCard title="About">
      <SettingRow label="Quick tour" hint="A short overview of chat modes, pages, modules, and links.">
        <Button size="sm" variant="secondary" icon={<BookOpen />} onClick={openWelcomeTour}>
          Open quick tour
        </Button>
      </SettingRow>
      <SettingRow label="Vault">
        <div className="font-ui text-[12px] text-dim">{vault.configured ? (vault.unlocked ? 'Set up, unlocked' : 'Set up, locked') : 'Not set up: files are stored unencrypted'}</div>
      </SettingRow>
      <SettingRow label="Version">
        <div className="font-ui text-[12px] text-dim">
          {info?.version} · {info?.platform}
        </div>
      </SettingRow>
    </SettingCard>
  )
}


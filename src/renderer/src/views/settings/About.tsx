import { SettingCard, SettingRow } from '../../components/ui'
import { useApp } from '../../store/app'
import { useVault } from '../../store/vault'

export function About() {
  const info = useApp((s) => s.info)
  const vault = useVault((s) => s.status)
  return (
    <SettingCard title="About">
      <SettingRow label="Vault">
        <div className="font-mono text-[12px] text-dim">{vault.configured ? (vault.unlocked ? 'Set up, unlocked' : 'Set up, locked') : 'Not set up: files are stored unencrypted'}</div>
      </SettingRow>
      <SettingRow label="Version">
        <div className="font-mono text-[12px] text-dim">
          {info?.version} · {info?.platform}
        </div>
      </SettingRow>
    </SettingCard>
  )
}


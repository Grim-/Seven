import { ArchiveRestore, Brain, FolderOpen, Info, Keyboard, Lock, Palette, ShieldCheck, UserRound, Volume2 } from 'lucide-react'
import { registerSettings } from '../../registries/settings'
import { MemoryPanel } from '../MemoryPanel'
import { PermissionsPanel } from '../PermissionsPanel'
import { VaultPanel } from '../../components/vault/Vault'
import { VaultsPanel } from '../../components/vault/Vaults'
import { Profile } from './Profile'
import { Appearance } from './Appearance'
import { Sound } from './Sound'
import { Startup } from './Startup'
import { FilesFolders } from './FilesFolders'
import { Upkeep } from './Upkeep'
import { About } from './About'

function Vault() {
  return (
    <>
      <VaultPanel />
      <VaultsPanel />
    </>
  )
}

export function registerCoreSettings(): void {
  registerSettings({ id: 'you', group: 'You', label: 'Profile', hint: 'What agents call you and know', icon: <UserRound />, words: ['name', 'about me', 'profile page'], Page: Profile })
  registerSettings({ id: 'appearance', group: 'Look and feel', label: 'Appearance', hint: 'Theme, pictures, side panel', icon: <Palette />, words: ['theme', 'animated backgrounds', 'agent pictures', 'avatar', 'pictures in chat', 'side panel tabs'], Page: Appearance })
  registerSettings({ id: 'sound', group: 'Look and feel', label: 'Sound and voice', hint: 'Music, sounds, voices', icon: <Volume2 />, words: ['music', 'sounds', 'voices', 'default voice', 'piper', 'speech'], Page: Sound })
  registerSettings({ id: 'startup', group: 'Look and feel', label: 'Startup and overlay', hint: 'Start with Windows, hotkey', icon: <Keyboard />, words: ['start with windows', 'overlay', 'hotkey', 'button position', 'tray'], Page: Startup })
  registerSettings({ id: 'files', group: 'Storage', label: 'Files and folders', hint: 'Data, tools, models, linked', icon: <FolderOpen />, words: ['data folder', 'tools folder', 'skills folder', 'model folders', 'linked folders', 'dropped pictures', 'off limits'], Page: FilesFolders })
  registerSettings({ id: 'upkeep', group: 'Storage', label: 'Backup and upkeep', hint: 'Backup, restore, clear, index', icon: <ArchiveRestore />, words: ['back up', 'backup', 'export', 'obsidian', 'restore', 'clear everything', 'search index', 'check files'], Page: Upkeep })
  registerSettings({ id: 'memory', group: 'Agents', label: 'Memory and context', hint: 'Memory limits, search, model state', icon: <Brain />, words: ['pinned memories', 'model state', 'memory search model', 'embedding'], Page: MemoryPanel })
  registerSettings({ id: 'permissions', group: 'Agents', label: 'Permissions', hint: 'Allow, deny, protect', icon: <ShieldCheck />, words: ['allowed commands', 'denied commands', 'protected paths', 'shell'], Page: PermissionsPanel })
  registerSettings({ id: 'vault', group: 'Security', label: 'Vault', hint: 'Encryption, keys, vaults', icon: <Lock />, words: ['passphrase', 'lock', 'keys', 'api keys', 'vaults', 'switch vault', 'encryption'], Page: Vault })
  registerSettings({ id: 'about', group: 'Seven', label: 'About', hint: 'Version', icon: <Info />, words: ['version'], Page: About })
}

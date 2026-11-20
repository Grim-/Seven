import { ArchiveRestore, Brain, Command, Download, FolderOpen, Info, Keyboard, Lock, Palette, Scale, ShieldCheck, UserRound, Volume2 } from 'lucide-react'
import { registerSettings } from '../../registries/settings'
import { MemoryPanel } from '../MemoryPanel'
import { PermissionsPanel } from '../PermissionsPanel'
import { VaultPanel } from '../../components/vault/Vault'
import { VaultsPanel } from '../../components/vault/Vaults'
import { Profile } from './Profile'
import { Appearance } from './Appearance'
import { Sound } from './Sound'
import { Keybinds } from './Keybinds'
import { Startup } from './Startup'
import { FilesFolders } from './FilesFolders'
import { Upkeep } from './Upkeep'
import { Helpers } from './Helpers'
import { Credits } from './Credits'
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
  registerSettings({
    id: 'keybinds',
    group: 'Look and feel',
    label: 'Keybinds',
    hint: 'Shortcuts across chat, tabletop, files and play',
    icon: <Keyboard />,
    words: [
      'keybinds',
      'shortcuts',
      'hotkeys',
      'shift+v',
      'ctrl+k',
      'ctrl+space',
      'ctrl+shift+f',
      'ctrl+shift+g',
      'shift+esc',
      'chat view mode',
      'tabletop',
      'cinema',
      'surfacetop',
      'commands',
      'play'
    ],
    Page: Keybinds
  })
  registerSettings({ id: 'startup', group: 'Look and feel', label: 'Startup and overlay', hint: 'Start with Windows, overlay', icon: <Command />, words: ['start with windows', 'overlay', 'hotkey', 'button position', 'tray'], Page: Startup })
  registerSettings({ id: 'files', group: 'Storage', label: 'Files and folders', hint: 'Data, tools, models, linked', icon: <FolderOpen />, words: ['data folder', 'tools folder', 'skills folder', 'model folders', 'linked folders', 'dropped pictures', 'off limits'], Page: FilesFolders })
  registerSettings({ id: 'upkeep', group: 'Storage', label: 'Backup and upkeep', hint: 'Backup, restore, clear, index, problems', icon: <ArchiveRestore />, words: ['back up', 'backup', 'export', 'obsidian', 'restore', 'clear everything', 'search index', 'check files', 'problems', 'errors', 'crash'], Page: Upkeep })
  registerSettings({ id: 'memory', group: 'Agents', label: 'Memory and context', hint: 'Memory limits, search, model state', icon: <Brain />, words: ['pinned memories', 'model state', 'memory search model', 'embedding'], Page: MemoryPanel })
  registerSettings({ id: 'permissions', group: 'Agents', label: 'Permissions', hint: 'Allow, deny, protect', icon: <ShieldCheck />, words: ['allowed commands', 'denied commands', 'protected paths', 'shell'], Page: PermissionsPanel })
  registerSettings({ id: 'vault', group: 'Security', label: 'Vault', hint: 'Encryption, keys, vaults', icon: <Lock />, words: ['passphrase', 'lock', 'keys', 'api keys', 'vaults', 'switch vault', 'encryption'], Page: Vault })
  registerSettings({
    id: 'helpers',
    group: 'Seven',
    label: 'Helper installers',
    hint: 'llama-server, sd-server, versions and updates',
    icon: <Download />,
    words: ['helpers', 'installers', 'llama-server', 'sd-server', 'llama.cpp', 'stable-diffusion.cpp', 'cuda', 'vulkan', 'cpu', 'versions', 'updates', 'binaries'],
    Page: Helpers
  })
  registerSettings({
    id: 'credits',
    group: 'Seven',
    label: 'Credits & Attribution',
    hint: 'Bundled data, local runtimes and licenses',
    icon: <Scale />,
    words: ['credits', 'attribution', 'licenses', 'srd', 'dnd', 'cc-by-4.0', 'llama.cpp', 'stable-diffusion.cpp', 'piper', 'electron'],
    Page: Credits
  })
  registerSettings({ id: 'about', group: 'Seven', label: 'About', hint: 'Version', icon: <Info />, words: ['version'], Page: About })
}

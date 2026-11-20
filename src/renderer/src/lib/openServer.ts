import { useApp } from '../store/app'
import { setViewPlace } from './viewPlace'

export type ServerKind = 'llama-server' | 'sd-server'

/** Switch straight to the Servers view, optionally focusing llama-server or sd-server. */
export function openServerView(kind?: ServerKind): void {
  if (kind) setViewPlace('server.kind', kind)
  useApp.getState().setView('server')
}

/** Switch straight to Settings → Helper installers, optionally focusing a helper. */
export function openHelperInstaller(kind?: ServerKind): void {
  if (kind) setViewPlace('settings.helpers.id', kind)
  setViewPlace('settings.section', 'helpers')
  useApp.getState().setView('settings')
}

/** Switch straight to the Models → Download models (Hugging Face / Packs) view. */
export function openModelDownloads(): void {
  setViewPlace('models.selected', null)
  setViewPlace('models.hub', 'search')
  useApp.getState().setView('models')
}

/** Switch straight to the installed Models list (closing any open download view). */
export function openInstalledModels(): void {
  setViewPlace('models.hub', null)
  setViewPlace('models.selected', null)
  useApp.getState().setView('models')
}

import { noteMainFailure } from './problems'
import { Menu, Tray, nativeImage } from 'electron'
import icon from '../../resources/icon.png?asset'

interface TrayActions {
  showApp: () => void
  resetWindow: () => void
  toggleOverlay: () => void
  isOverlayEnabled: () => boolean
  quit: () => void
}

export interface SevenTray {
  tray: Tray
  refresh: () => void
}

export function createTray(actions: TrayActions): SevenTray | null {
  try {
    const image = nativeImage.createFromPath(icon).resize({ width: 16, height: 16 })
    const tray = new Tray(image)
    tray.setToolTip('Seven')
    const rebuild = () =>
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: 'Open Seven', click: actions.showApp },
          { label: 'Reset window position', click: actions.resetWindow },
          {
            label: 'Show overlay',
            type: 'checkbox',
            checked: actions.isOverlayEnabled(),
            click: () => {
              actions.toggleOverlay()
              rebuild()
            }
          },
          { type: 'separator' },
          { label: 'Quit Seven', click: actions.quit }
        ])
      )
    rebuild()
    tray.on('click', actions.showApp)
    return { tray, refresh: rebuild }
  } catch (err) {
    noteMainFailure(err, 'tray', 'Could not create the tray icon', 'error')
    return null
  }
}

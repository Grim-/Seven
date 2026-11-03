import { useEffect } from 'react'
import { MotionConfig, motion } from 'motion/react'
import { TitleBar } from './components/shell/TitleBar'
import { Taskbar } from './components/shell/Taskbar'
import { ThemeStage } from './components/shell/ThemeStage'
import { AudioHost } from './components/shell/Audio'
import { ContextMenuHost, TooltipHost, Toaster, DropOverlay } from './components/ui'
import { UnlockDialog } from './components/vault/Vault'
import { LockScreen } from './components/vault/LockScreen'
import { ReminderAlarms } from './components/reminders/Reminders'
import { bootstrap } from './store/bootstrap'
import { listenBrowser } from './components/side/BrowserTab'
import { useFileDrop } from './lib/useFileDrop'
import { dropFiles } from './lib/dropFiles'
import { WindowProvider } from './lib/window'
import { useApp } from './store/app'
import { useWindows } from './store/windows'
import { viewOf } from './views/registry'
import { ExportHost } from './components/export/ExportModal'
import { PlayHost } from './components/play/PlayHost'
import { PicturePickerHost } from './components/data/PicturePicker'
import { CarryHost } from './components/carry/CarryModals'
import { DropPicturesHost } from './components/files/DropPictures'
import { useCinema, useCinemaKey } from './lib/cinema'

export function App() {
  const view = useApp((s) => s.view)
  const { Component: View, app } = viewOf(view)
  const [cinemaOn] = useCinema()
  const cinema = view === 'chat' && cinemaOn
  useCinemaKey(view === 'chat', cinemaOn)
  useEffect(() => {
    void bootstrap('app')
  }, [])

  useEffect(() => listenBrowser(), [])

  const fileDrop = useFileDrop((_, e, dropped) => void dropFiles(dropped, e.shiftKey))
  return (
    <MotionConfig reducedMotion="user">
    <div className="relative flex h-full flex-col bg-bg text-text">
      <ThemeStage />
      <AudioHost />
      {!cinema && <TitleBar />}
      <main className="relative z-10 min-h-0 flex-1" {...fileDrop.props}>
        <DropOverlay show={fileDrop.over} label="Drop files to add them to Files" className="z-[300]" />
        <motion.div key={view} className="h-full" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} onPointerDownCapture={() => useWindows.getState().focus(view)}>
          <WindowProvider id={view} app={app ?? 'view'} focused>
            <View />
          </WindowProvider>
        </motion.div>
      </main>
      {!cinema && <Taskbar />}
      <LockScreen />
      <Toaster />
      <ContextMenuHost />
      <ExportHost />
      <PlayHost />
      <PicturePickerHost />
      <CarryHost />
      <DropPicturesHost />
      <TooltipHost />
      <UnlockDialog />
      <ReminderAlarms />
    </div>
    </MotionConfig>
  )
}

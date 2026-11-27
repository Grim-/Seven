import { useEffect } from 'react'
import { MotionConfig, motion } from 'motion/react'
import { TitleBar } from './components/shell/TitleBar'
import { Taskbar } from './components/shell/Taskbar'
import { ThemeStage } from './components/shell/ThemeStage'
import { AudioHost } from './components/shell/Audio'
import { ContextMenuHost, DecodeText, LoadingScreen, TooltipHost, Toaster, DropOverlay } from './components/ui'
import { UnlockDialog, useLocked } from './components/vault/Vault'
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
import { GenerateImageHost } from './components/pictures/GenerateImageModal'
import { ImageModelSetupModalHost } from './components/models/ImageModelConfigPanel'
import { CarryHost } from './components/carry/CarryModals'
import { PortabilityHost } from './components/portability/PortabilityHost'
import { DropPicturesHost } from './components/files/DropPictures'
import { SaveLocationHost } from './components/files/SaveLocationModal'
import { DataConversionHost } from './components/conversions/DataConversionModal'
import { StageOverlay } from './registries/presentations'
import { WelcomeModalHost } from './components/shell/WelcomeModal'
import { useCinema, useCinemaKey } from './lib/cinema'
import { skinSurface } from './components/skins/skinSurface'

function StartupScreen() {
  const startup = useApp((s) => s.startup)
  const engineStatus = useApp((s) => s.engine)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <DecodeText className="font-label text-[18px] font-bold caps-34 text-accent" text="Seven" />
      <LoadingScreen
        className="w-full flex-none p-0"
        title="Seven"
        steps={[
          { label: 'Settings & vault', done: startup.settings },
          { label: 'Local engine', done: startup.engine, detail: engineStatus.state === 'crashed' || engineStatus.restarts > 0 ? 'restarting' : undefined },
          { label: 'Models, agents & data', done: startup.workspace }
        ]}
      />
    </div>
  )
}

export function App() {
  const view = useApp((s) => s.view)
  const startup = useApp((s) => s.startup)
  const engineStatus = useApp((s) => s.engine)
  const locked = useLocked()
  const bootDone = startup.settings && (startup.engine || engineStatus.state === 'crashed')
  const showWorkspace = bootDone && (locked ? view === 'settings' : startup.ready)
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
    <div {...skinSurface('app')} className="fixed inset-0 flex flex-col bg-bg text-ink">
      <ThemeStage />
      <AudioHost />
      {!cinema && <TitleBar />}
      <main className="relative z-10 min-h-0 flex-1" {...fileDrop.props}>
        <DropOverlay show={fileDrop.over} label="Drop files to add them to Files" className="z-[300]" />
        {!bootDone || (!locked && !startup.ready) ? (
          <StartupScreen />
        ) : showWorkspace ? (
          <motion.div key={view} className="h-full" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} onPointerDownCapture={() => useWindows.getState().focus(view)}>
            <WindowProvider id={view} app={app ?? 'view'} focused>
              <View />
            </WindowProvider>
          </motion.div>
        ) : null}
      </main>
      {showWorkspace && !cinema && <Taskbar />}
      <LockScreen />
      <Toaster />
      <ContextMenuHost />
      <ExportHost />
      <PlayHost />
      <PicturePickerHost />
      <GenerateImageHost />
      <ImageModelSetupModalHost />
      <CarryHost />
      <PortabilityHost />
      <DropPicturesHost />
      <SaveLocationHost />
      <DataConversionHost />
      <TooltipHost />
      <StageOverlay />
      <WelcomeModalHost />
      <UnlockDialog />
      <ReminderAlarms />
    </div>
    </MotionConfig>
  )
}

import { useEffect, type ReactNode } from 'react'
import { create } from 'zustand'
import { Compass, Cpu, Download, FolderOpen, MessageSquare, Server, Wrench } from 'lucide-react'
import { Button, DecodeText, Modal } from '../ui'
import { useApp } from '../../store/app'
import { usePlaces } from '../../store/places'
import { useLocked } from '../vault/Vault'
import { openHelperInstaller, openModelDownloads } from '../../lib/openServer'

const DISMISSED_KEY = 'app.welcomeDismissed'

const useWelcome = create<{ open: boolean; openModal: () => void; closeModal: () => void }>((set) => ({
  open: false,
  openModal: () => set({ open: true }),
  closeModal: () => set({ open: false })
}))

export function openWelcomeTour(): void {
  useWelcome.getState().openModal()
}

interface TourItem {
  id: string
  icon: ReactNode
  title: string
  wide?: boolean
  body: ReactNode
}

const ITEMS: TourItem[] = [
  {
    id: 'chat',
    icon: <MessageSquare className="h-4 w-4 text-accent" />,
    title: 'Chat: Three View Modes (Try Tabletop!)',
    wide: true,
    body: (
      <div className="flex flex-col gap-1.5">
        <p>
          Top of the screen is the agent&apos;s side; bottom is yours — <strong className="text-white">click either portrait</strong> for quick controls. Use the view-mode button on the chat bar (or{' '}
          <kbd className="border border-line/60 bg-black/60 px-1 py-px font-mono text-[10.5px] text-white">Shift+V</kbd>) to switch anytime:
        </p>
        <ul className="flex flex-col gap-1 pl-3 text-[12px]">
          <li>
            <strong className="text-white">Default</strong> — standard chat layout with richer visual outputs (3-output view).
          </li>
          <li>
            <strong className="text-accent">Tabletop</strong> — live workspace surface behind chat where you pin slates to view/edit things and see agent edits live.{' '}
            <strong className="text-white">Right-click the canvas</strong> to place a slate or change the surface background.
          </li>
          <li>
            <strong className="text-white">Cinema</strong> — fullscreen, immersive view with an edge rail.
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 'files',
    icon: <FolderOpen className="h-4 w-4 text-cyan" />,
    title: 'Pages, Files, Links & Importing Data',
    body: (
      <>
        Pages, files, character sheets, repos, and boards are all <strong className="text-white">Kinds</strong>. Type{' '}
        <code className="border border-line/50 bg-black/60 px-1 py-px font-mono text-[11px] text-accent">@kind:name</code> anywhere to link or pull anything in. To import test or starter packs (
        <code className="font-mono text-[11px] text-white">.sevenpack</code> / <code className="font-mono text-[11px] text-white">.json</code>), use the <strong className="text-white">Import</strong> button at the top of the{' '}
        <strong className="text-white">Data</strong> page.
      </>
    )
  },
  {
    id: 'modules',
    icon: <Wrench className="h-4 w-4 text-accent" />,
    title: 'Modules',
    body: (
      <>
        Turn capabilities on or off in <strong className="text-white">Tools</strong> (Web &amp; Browser, Cards, Storyteller, Workouts, Image, Play preview). Disabling a module hides its kinds without deleting your data.
      </>
    )
  },
  {
    id: 'models',
    icon: <Cpu className="h-4 w-4 text-cyan" />,
    title: 'Models & Local Helpers',
    wide: true,
    body: (
      <>
        Install local runners (<code className="font-mono text-[11px] text-white">llama-server</code> for chat, <code className="font-mono text-[11px] text-white">sd-server</code> for images) in{' '}
        <strong className="text-white">Settings → Helper installers</strong>, download local models in <strong className="text-white">Models → Download models</strong>, or add a remote API in{' '}
        <strong className="text-white">Models</strong>.
      </>
    )
  }
]

export function WelcomeModalHost() {
  const open = useWelcome((s) => s.open)
  const closeModal = useWelcome((s) => s.closeModal)
  const ready = useApp((s) => s.startup.ready)
  const locked = useLocked()
  const placesLoaded = usePlaces((s) => s.loaded)
  const dismissed = usePlaces((s) => Boolean(s.places[DISMISSED_KEY]))

  useEffect(() => {
    if (!ready || locked || !placesLoaded || dismissed) return
    useWelcome.getState().openModal()
  }, [ready, locked, placesLoaded, dismissed])

  const dismiss = () => {
    usePlaces.getState().save(DISMISSED_KEY, true)
    closeModal()
  }

  const jumpTo = (action: () => void) => {
    dismiss()
    action()
  }

  return (
    <Modal
      open={open}
      width={780}
      title="Welcome to Seven"
      onClose={dismiss}
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 font-mono text-[11.5px] text-ink">
            Reopen anytime in{' '}
            <span className="border border-line/60 bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              Settings → About
            </span>
          </span>
          <Button variant="primary" onClick={dismiss}>
            Got it
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center justify-between gap-3 border-b border-line/40 pb-2.5">
          <DecodeText className="font-mono text-[13px] font-bold uppercase tracking-[0.26em] text-accent" text="Quick tour" />
          <span className="flex items-center gap-1.5 font-mono text-[11.5px] text-ink">
            <kbd className="border border-accent/60 bg-accent/10 px-1.5 py-0.5 text-[11px] font-bold text-accent">Ctrl+K</kbd>
            <span>searches &amp; jumps anywhere</span>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {ITEMS.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col gap-1.5 border border-line/50 bg-black/45 p-3 ${item.wide ? 'sm:col-span-2' : ''}`}
            >
              <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-white">
                {item.icon}
                <span>{item.title}</span>
              </div>
              <div className="text-[12.5px] leading-relaxed text-dim">{item.body}</div>
              {item.id === 'models' && (
                <div className="mt-1 flex flex-wrap gap-1.5 pt-1">
                  <Button size="sm" variant="secondary" icon={<Server />} onClick={() => jumpTo(() => openHelperInstaller())}>
                    Helper installers
                  </Button>
                  <Button size="sm" variant="secondary" icon={<Download />} onClick={() => jumpTo(() => openModelDownloads())}>
                    Download models
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2.5 border border-line/40 border-l-2 border-l-accent bg-accent/[0.04] px-3 py-2 text-[12.5px] text-dim">
          <Compass className="h-4 w-4 shrink-0 text-accent" />
          <span>
            There are a lot of buttons — <strong className="text-white">try them</strong>. Right-click almost anything for menus, check the composer bar, and hover tabs for quick links.
          </span>
        </div>
      </div>
    </Modal>
  )
}

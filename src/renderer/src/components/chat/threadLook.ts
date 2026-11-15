import { createContext, useContext } from 'react'

export interface ThreadLook {
  viewport: string
  column: string
  gap: string
  user: { width: string; label: string; box: string }
  agent: { width: string; label: string; body: string; avatar: number; bigAvatars: boolean }
  times: boolean
  foldTools: boolean
  composer: { root: string; field: string; avatar: number; round: boolean }
  outputs: boolean
  ownsComposer: boolean
  compactBars: boolean
  divider: boolean
}

const SLATE_USER = 'notch-sm relative border border-line bg-gradient-to-b from-accent/[0.12] to-accent/[0.04] whitespace-pre-wrap text-white after:absolute after:bottom-0 after:right-0 after:h-1.5 after:w-1.5 after:bg-accent'
const SLATE_AGENT =
  'relative border-l border-l-line pl-3.5 text-white before:absolute before:left-[-1px] before:top-0 before:h-4 before:w-px before:bg-accent before:shadow-[0_0_6px_var(--color-accent)]'
const TAG = 'font-mono text-[9.5px] font-semibold uppercase tracking-[0.2em]'
const BAR_FIELD = 'notch-sm border border-line bg-black/60 backdrop-blur-md px-3 py-2.5 text-white inset-field glow-focus placeholder:text-dim/60'

export const THREAD_LOOKS = {
  panel: {
    viewport: 'px-6 py-5',
    column: 'mx-auto max-w-4xl',
    gap: 'pb-6',
    user: { width: 'max-w-[78%]', label: 'font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-soft', box: 'notch-sm border border-line bg-accent/[0.06] px-3.5 py-2.5 text-[14.5px] leading-relaxed whitespace-pre-wrap text-white' },
    agent: { width: 'max-w-[86%]', label: 'font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-teal', body: 'border-l-2 border-l-line pl-3.5 text-white', avatar: 20, bigAvatars: true },
    times: false,
    foldTools: false,
    composer: { root: 'border-t border-line/60 bg-black/75 backdrop-blur-md p-3', field: 'border border-line bg-black/60 px-3 py-2.5 text-white inset-field glow-focus placeholder:text-dim/60', avatar: 72, round: false },
    outputs: true,
    ownsComposer: true,
    compactBars: true,
    divider: false
  },
  slate: {
    viewport: 'px-3 py-3',
    column: '',
    gap: 'pb-4',
    user: { width: 'max-w-[88%]', label: `${TAG} text-accent-soft`, box: `${SLATE_USER} px-3 py-2 text-[14px] leading-relaxed` },
    agent: { width: 'max-w-full', label: `${TAG} text-accent`, body: `${SLATE_AGENT} text-[14px] leading-relaxed`, avatar: 0, bigAvatars: false },
    times: true,
    foldTools: true,
    composer: { root: 'px-3 pb-3 pt-2', field: `${BAR_FIELD} text-[14px] leading-relaxed`, avatar: 0, round: true },
    outputs: false,
    ownsComposer: false,
    compactBars: true,
    divider: false
  },
  cinema: {
    viewport: 'px-1 py-5',
    column: '',
    gap: 'pb-5',
    user: { width: 'max-w-[72%]', label: `${TAG} text-accent-soft`, box: `${SLATE_USER} px-3.5 py-2 text-[15px] leading-relaxed` },
    agent: { width: 'max-w-[88%]', label: `${TAG} text-accent`, body: `${SLATE_AGENT} text-[15.5px] leading-[1.65]`, avatar: 0, bigAvatars: false },
    times: true,
    foldTools: true,
    composer: { root: 'pt-2', field: `${BAR_FIELD} text-[14.5px] leading-relaxed`, avatar: 0, round: false },
    outputs: false,
    ownsComposer: true,
    compactBars: false,
    divider: false
  },
  tabletop: {
    viewport: 'px-6 py-5',
    column: 'mx-auto max-w-4xl',
    gap: 'pb-6',
    user: { width: 'max-w-[78%]', label: 'font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-soft', box: 'notch-sm border border-line bg-black/75 backdrop-blur-md px-3.5 py-2.5 text-[14.5px] leading-relaxed whitespace-pre-wrap text-white' },
    agent: { width: 'max-w-[86%]', label: 'font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-teal', body: 'border-l-2 border-l-line bg-black/65 backdrop-blur-md p-3.5 text-white', avatar: 20, bigAvatars: true },
    times: false,
    foldTools: true,
    composer: { root: 'border-t border-line/60 bg-black/80 backdrop-blur-md p-3', field: 'border border-line bg-black/60 px-3 py-2.5 text-white inset-field glow-focus placeholder:text-dim/60', avatar: 72, round: false },
    outputs: false,
    ownsComposer: true,
    compactBars: true,
    divider: false
  }
} satisfies Record<string, ThreadLook>

export type ThreadLookId = keyof typeof THREAD_LOOKS

export const ThreadLookContext = createContext<ThreadLook>(THREAD_LOOKS.panel)

export function useThreadLook(): ThreadLook {
  return useContext(ThreadLookContext)
}

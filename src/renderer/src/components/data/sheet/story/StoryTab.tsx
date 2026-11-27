import { useMemo, useState, type ReactNode } from 'react'
import { Eye, Plus } from 'lucide-react'
import {
  mindMemoriesText,
  newSession,
  relinkStory,
  storyText,
  type Story,
  type StoryPhase,
  type StorySession
} from '@shared/story'
import type { CharacterMind, CharacterSheet } from '@shared/types'
import { cn } from '../../../../lib/cn'
import { Button, Eyebrow, Modal } from '../../../ui'
import { SessionComposer } from './SessionComposer'
import { StoryCastSidebar } from './StoryCastSidebar'
import { StoryNow } from './StoryNow'
import { StoryThreads } from './StoryThreads'
import { campaignHolders } from '../holders'
import { useSheetHolds } from '../../../../lib/campaignHold'

export function StoryTab({
  sheet,
  story,
  mind,
  profile,
  compact = false,
  campaign,
  onChange,
  onOpenFacet
}: {
  sheet: CharacterSheet
  campaign: string | null
  story: Story
  mind?: CharacterMind | null
  profile?: ReactNode
  compact?: boolean
  onChange: (story: Story) => void
  onOpenFacet?: (facet: string) => void
}) {
  const [query, setQuery] = useState('')
  const [composing, setComposing] = useState<StorySession | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const campaigns = campaignHolders(sheet.id, useSheetHolds(sheet.id, campaign))

  const sessions = story.sessions
  const memories = mind?.memories ?? []
  const relationships = sheet.relationships ?? []

  const openComposer = (phase: StoryPhase = 'session') => {
    setComposing(newSession(undefined, { phase, kind: phase === 'backstory' ? undefined : 'scene' }))
  }

  const saveComposer = () => {
    if (!composing) return
    onChange({ ...story, sessions: [...sessions, composing] })
    setComposing(null)
  }

  const promptPreview = useMemo(() => {
    const sText = storyText(story, false)
    const mText = mindMemoriesText(memories)
    return [sText, mText].filter(Boolean).join('\n\n')
  }, [story, memories])

  return (
    <div
      className={cn(
        'mx-auto grid w-full max-w-[1360px] grid-cols-1 items-start',
        compact ? 'gap-3 pt-2' : 'gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_20rem]'
      )}
    >
      <main className="flex min-w-0 flex-col gap-5">
        <section className="flex flex-col gap-3 border border-accent/45 tone-panel-50 p-4 shadow-[inset_3px_0_0_var(--color-accent)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Eyebrow className="text-accent">Present Situation &amp; Active Scene</Eyebrow>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" icon={<Eye />} onClick={() => setPreviewOpen(true)}>
                Agent view
              </Button>
              <Button size="sm" variant="primary" icon={<Plus />} onClick={() => openComposer('session')}>
                Log scene / interaction
              </Button>
            </div>
          </div>
          <StoryNow story={story} onChange={onChange} large />
        </section>

        {profile}
        <StoryThreads story={story} onChange={onChange} query={query} />
        {campaigns.map((h) => (
          <StoryThreads key={h.key} title={`Threads in ${h.label}`} story={{ ...story, threads: h.hold.threads }} onChange={(next) => h.save({ ...h.hold, threads: next.threads })} query={query} />
        ))}
      </main>

      {!compact && (
        <StoryCastSidebar
          self={sheet.id}
          onRelink={(kind, ref, to) => onChange(relinkStory(story, kind, ref, to))}
          story={story}
          relationships={relationships}
          query={query}
          onQuery={setQuery}
          onOpenRelations={() => onOpenFacet?.('relations')}
          onOpenPreview={() => setPreviewOpen(true)}
        />
      )}

      <SessionComposer session={composing} number={sessions.length + 1} onChange={setComposing} onClose={() => setComposing(null)} onSave={saveComposer} />

      <Modal open={previewOpen} wide title="What the Agent Receives from This Story" onClose={() => setPreviewOpen(false)}>
        <div className="flex flex-col gap-3">
          <div className="text-[12.5px] text-dim">
            This compact summary is injected into default agent context. Older logs, unpinned backstory chapters, full markdown prose, and resolved threads stay indexed on demand via <span className="font-ui text-secondary-ink">story_recall</span>.
          </div>
          <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap border border-line/50 tone-panel-70 p-3 font-ui text-[12px] leading-relaxed text-ink/90">
            {promptPreview || '(No story context written yet.)'}
          </pre>
        </div>
      </Modal>
    </div>
  )
}

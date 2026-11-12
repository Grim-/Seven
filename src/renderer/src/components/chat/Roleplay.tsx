import { useMemo } from 'react'
import { agentSheets, type AgentProfile } from '@shared/types'
import { showName } from '@shared/ids'
import { AgentAvatar } from '../agents/look'
import { CharacterAvatar } from './CharacterAvatar'
import { useKindEntries } from '../../views/data/useKindEntries'
import { Markdown } from './Markdown'
import { assetUrl, findPage, useAsset, useData } from '../../store/data'
import { openSevenLink } from '../../lib/links'
import { cn } from '../../lib/cn'

type Block = { kind: 'say'; speaker: string; text: string } | { kind: 'act'; text: string } | { kind: 'tell'; text: string }

const SAY = /^\s*\**([\p{L}\p{N}][\p{L}\p{N}' .-]{0,40}?)\**\s*:\s*((?:\*[^*\n]+\*\s*)*["“«].*)$/u
const ACT = /^\s*\*(?!\*)([^*\n].*?)\*\s*$/

export function parseRoleplay(text: string): Block[] {
  const blocks: Block[] = []
  const tell: string[] = []
  const flush = () => {
    const body = tell.join('\n').trim()
    if (body) blocks.push({ kind: 'tell', text: body })
    tell.length = 0
  }
  for (const line of text.split('\n')) {
    const say = SAY.exec(line)
    if (say) {
      flush()
      const last = blocks[blocks.length - 1]
      if (last?.kind === 'say' && last.speaker === say[1].trim()) last.text += `\n\n${say[2].trim()}`
      else blocks.push({ kind: 'say', speaker: say[1].trim(), text: say[2].trim() })
      continue
    }
    const act = ACT.exec(line)
    if (act) {
      flush()
      blocks.push({ kind: 'act', text: act[1].trim() })
      continue
    }
    if (!line.trim()) {
      flush()
      continue
    }
    tell.push(line)
  }
  flush()
  return blocks
}

function hue(name: string): number {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

const words = (text: string) => text.toLowerCase().replace(/["“”'.,]/g, ' ').split(/\s+/).filter(Boolean)

function Speaker({ name, agent }: { name: string; agent: AgentProfile | null }) {
  const pages = useData((s) => s.pages)
  const isAgent = agent && agent.name.trim().toLowerCase() === name.toLowerCase()
  const lower = name.toLowerCase()
  const sheets = agentSheets(agent)
  const librarySheets = useKindEntries('sheet')
  const matchedSheet = useMemo(() => {
    if (isAgent) return null
    const fromRoster = sheets.find((s) => {
      const sLower = s.toLowerCase()
      const sName = showName(s).toLowerCase()
      return sLower === lower || sName === lower || sName.startsWith(lower) || lower.startsWith(sName)
    })
    if (fromRoster) return fromRoster

    if (librarySheets?.length) {
      const fromLib = librarySheets.find((h) => {
        const hTitle = h.title.toLowerCase()
        const hId = showName(h.id).toLowerCase()
        return hTitle === lower || hId === lower || hTitle.startsWith(lower) || lower.startsWith(hTitle)
      })
      if (fromLib) return fromLib.id
    }
    return null
  }, [isAgent, sheets, librarySheets, lower])

  if (isAgent) return <AgentAvatar agent={agent} size={52} />
  if (matchedSheet) return <CharacterAvatar sheetId={matchedSheet} size={52} openOnClick />

  const said = words(name)
  const page = findPage(pages, name) ?? pages.find((p) => p.title.toLowerCase().startsWith(`${lower} `)) ?? pages.find((p) => p.image && said.length > 0 && said.every((w) => words(p.title).includes(w)))
  const picture = useAsset(page?.image ?? '')
  const h = hue(name)
  if (page && picture)
    return (
      <button type="button" title={`Open ${page.title}`} onClick={() => openSevenLink(`seven:page/${encodeURIComponent(page.id)}`)} className="h-[52px] w-[52px] shrink-0 overflow-hidden border border-line/60 hover:border-accent">
        <img src={assetUrl(picture)} alt={name} className="h-full w-full object-cover" />
      </button>
    )
  return (
    <button
      type="button"
      title={page ? `Open ${page.title}` : name}
      disabled={!page}
      onClick={() => page && openSevenLink(`seven:page/${encodeURIComponent(page.id)}`)}
      className="flex h-[52px] w-[52px] shrink-0 items-center justify-center border font-mono text-[20px] font-bold enabled:hover:brightness-125"
      style={{ borderColor: `hsl(${h} 70% 55% / 0.7)`, background: `hsl(${h} 60% 20% / 0.5)`, color: `hsl(${h} 80% 75%)` }}
    >
      {name.slice(0, 1).toUpperCase()}
    </button>
  )
}

export function RoleplayText({ text, agent }: { text: string; agent: AgentProfile | null }) {
  const blocks = useMemo(() => parseRoleplay(text), [text])
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b, i) =>
        b.kind === 'say' ? (
          <div key={i} className="flex items-start gap-3">
            <Speaker name={b.speaker} agent={agent} />
            <div className="min-w-0 flex-1 border border-line/50 bg-black/40 px-3.5 py-2">
              <div className="mb-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-accent">{b.speaker}</div>
              <div className="text-[15px] leading-relaxed [&_em]:text-cyan/80">
                <Markdown text={b.text} />
              </div>
            </div>
          </div>
        ) : b.kind === 'act' ? (
          <div key={i} className={cn('border-l-2 border-l-cyan/50 pl-3 text-[14px] italic leading-relaxed text-cyan/85')}>
            <Markdown text={b.text} />
          </div>
        ) : (
          <div key={i} className="text-[14px] leading-relaxed text-white/80">
            <Markdown text={b.text} />
          </div>
        )
      )}
    </div>
  )
}

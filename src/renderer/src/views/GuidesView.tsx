import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  Copy,
  ExternalLink,
  Film,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sparkles,
  X,
  ZoomIn
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { BUILTIN_GUIDES, groupGuidesBySection, resolveGuideMedia } from '../guides/catalog'
import { extractGuideSection, searchGuides, slugifyHeading, type GuideDoc } from '../guides/parser'
import { CodeBlock, Diagram } from '../components/chat/Code'
import { Drawing } from '../components/chat/Drawing'
import { Button, Eyebrow, Panel, ViewHeader } from '../components/ui'
import { cn } from '../lib/cn'
import { copyText } from '../lib/notify'
import { useViewPlace } from '../lib/viewPlace'
import { useApp } from '../store/app'
import { useEscapeLayer } from '../lib/escape'

function isCustomBlock(node: unknown): boolean {
  const first = (node as { children?: { properties?: { className?: unknown } }[] } | undefined)?.children?.[0]
  const cls = first?.properties?.className
  if (!Array.isArray(cls)) return false
  return cls.some(
    (c) =>
      typeof c === 'string' &&
      (c === 'language-svg' ||
        c === 'language-mermaid' ||
        c === 'language-prompt' ||
        c.startsWith('language-prompt:') ||
        c === 'language-copy' ||
        c.startsWith('language-copy:'))
  )
}

function promptLabelFromClass(className: string | undefined): string | null {
  if (!className) return null
  const match = /(?:^|\s)language-(prompt|copy)(?::([^\s]+))?/i.exec(className)
  if (!match) return null
  if (match[2]) return match[2].replace(/[-_]+/g, ' ').trim()
  return match[1].toLowerCase() === 'copy' ? 'Copyable Block' : 'Prompt To Paste'
}

function CopyIconButton({
  text,
  label,
  toastMessage = 'Copied to clipboard',
  className
}: {
  text: string
  label?: string
  toastMessage?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const onCopy = () => {
    void copyText(text, toastMessage)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button
      type="button"
      onClick={onCopy}
      title={label ?? 'Copy to clipboard'}
      className={cn(
        'inline-flex items-center gap-1 border border-line/50 tone-well-70 px-2 py-0.5 font-label text-[10px] font-bold caps-5 text-dim transition-colors hover:border-accent hover:text-accent cursor-pointer',
        copied && 'border-ok/60 bg-ok/15 text-ok hover:border-ok hover:text-ok',
        className
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {label && <span>{copied ? 'Copied' : label}</span>}
    </button>
  )
}

function PromptCopyCard({ label, text }: { label: string; text: string }) {
  const cleaned = text.replace(/\n$/, '')
  const lines = cleaned.split('\n')
  const isLong = lines.length > 16
  const [expanded, setExpanded] = useState(!isLong)
  const [copied, setCopied] = useState(false)
  const words = cleaned.trim().split(/\s+/).filter(Boolean).length

  const copyAll = () => {
    void copyText(cleaned, `${label} copied`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="not-prose my-4 overflow-hidden border border-accent/45 border-l-2 border-l-accent tone-panel-60 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/45 tone-well-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span className="font-label text-[10.5px] font-bold caps-12 text-accent">{label}</span>
          <span className="font-data text-[10px] text-faint">
            {words} words · {lines.length} lines
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 border border-line/50 tone-well-70 px-2 py-1 font-label text-[10px] font-bold caps-5 text-dim hover:border-line hover:text-ink cursor-pointer"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Collapse' : 'Show all'}
            </button>
          )}
          <button
            type="button"
            onClick={copyAll}
            className={cn(
              'inline-flex items-center gap-1.5 border px-2.5 py-1 font-label text-[10.5px] font-bold caps-5 transition-colors cursor-pointer',
              copied
                ? 'border-ok bg-ok/20 text-ok'
                : 'border-accent bg-accent/15 text-accent hover:bg-accent hover:text-on-accent'
            )}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy prompt'}</span>
          </button>
        </div>
      </div>
      <div className={cn('relative overflow-hidden', !expanded && 'max-h-72')}>
        <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-words bg-transparent px-3.5 py-3 font-mono text-[12px] leading-relaxed text-ink/90 select-text">
          {cleaned}
        </pre>
        {!expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-gradient-to-t from-[var(--color-panel)] via-[var(--color-panel)]/80 to-transparent pb-2">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="pointer-events-auto border border-line/60 tone-panel-90 px-2.5 py-0.5 font-label text-[10px] font-bold caps-5 text-dim hover:border-accent hover:text-accent cursor-pointer"
            >
              Show full prompt ({lines.length} lines)
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function headingText(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(headingText).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    return headingText((children as { props?: { children?: React.ReactNode } }).props?.children)
  }
  return ''
}

function GuideLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEscapeLayer(true, onClose)
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[130] flex flex-col items-center justify-center bg-scrim/90 p-6 backdrop-blur-[var(--panel-blur)]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] max-w-[92vw] flex-col border border-line/70 tone-panel-95 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line/50 tone-well-40 px-3 py-2">
          <span className="truncate font-ui text-[12px] text-ink">{alt || 'Guide media'}</span>
          <button
            type="button"
            onClick={onClose}
            title="Close preview"
            className="p-1 text-dim hover:text-ink cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
          <img src={src} alt={alt} className="max-h-[78vh] max-w-[86vw] object-contain" />
        </div>
      </div>
    </div>
  )
}

function GuideArticle({
  guide,
  onOpenGuide,
  onOpenView,
  onPreviewMedia
}: {
  guide: GuideDoc
  onOpenGuide: (slug: string) => void
  onOpenView: (viewId: string) => void
  onPreviewMedia: (media: { src: string; alt: string }) => void
}) {
  const seenHeadings = new Map<string, number>()
  const nextHeadingId = (rawText: string) => {
    const base = slugifyHeading(rawText) || 'section'
    const count = seenHeadings.get(base) ?? 0
    seenHeadings.set(base, count + 1)
    return count === 0 ? base : `${base}-${count + 1}`
  }

  return (
    <div className="prose-seven max-w-none select-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) =>
          url.startsWith('guide:') || url.startsWith('seven-view:') ? url : url
        }
        components={{
          pre: ({ node, children }) => {
            if (isCustomBlock(node)) return <>{children}</>
            const codeChild = (node as { children?: { children?: { value?: string }[] }[] } | undefined)?.children?.[0]
            const rawCode = (codeChild?.children ?? []).map((c) => c.value ?? '').join('').replace(/\n$/, '')
            return (
              <div className="group/code relative my-3">
                <pre>{children}</pre>
                {rawCode && (
                  <CopyIconButton
                    text={rawCode}
                    label="Copy"
                    toastMessage="Block copied"
                    className="absolute right-2 top-2 opacity-0 transition-opacity group-hover/code:opacity-100 focus:opacity-100"
                  />
                )}
              </div>
            )
          },
          h2: ({ children }) => {
            const label = headingText(children)
            const id = nextHeadingId(label)
            const sectionMd = extractGuideSection(guide.body, id)
            return (
              <h2 id={id} className="group/heading flex scroll-mt-6 items-center justify-between gap-2">
                <span>{children}</span>
                {sectionMd && (
                  <CopyIconButton
                    text={sectionMd}
                    label="Copy section"
                    toastMessage={`Copied "${label}"`}
                    className="shrink-0 opacity-0 transition-opacity group-hover/heading:opacity-100 focus:opacity-100"
                  />
                )}
              </h2>
            )
          },
          h3: ({ children }) => {
            const label = headingText(children)
            const id = nextHeadingId(label)
            const sectionMd = extractGuideSection(guide.body, id)
            return (
              <h3 id={id} className="group/heading flex scroll-mt-6 items-center justify-between gap-2">
                <span>{children}</span>
                {sectionMd && (
                  <CopyIconButton
                    text={sectionMd}
                    label="Copy section"
                    toastMessage={`Copied "${label}"`}
                    className="shrink-0 opacity-0 transition-opacity group-hover/heading:opacity-100 focus:opacity-100"
                  />
                )}
              </h3>
            )
          },
          code: ({ className, children }) => {
            const promptLabel = promptLabelFromClass(className)
            if (promptLabel) return <PromptCopyCard label={promptLabel} text={String(children)} />
            return className?.includes('language-svg') ? (
              <Drawing source={String(children)} />
            ) : className?.includes('language-mermaid') ? (
              <Diagram source={String(children)} />
            ) : className?.includes('language-') ? (
              <CodeBlock className={className} source={String(children)} />
            ) : (
              <code className={className}>{children}</code>
            )
          },
          img: ({ src, alt }) => {
            const resolved = resolveGuideMedia(typeof src === 'string' ? src : undefined)
            const label = alt ?? ''
            const isGif = /\.gif(\?.*)?$/i.test(src ?? '') || /\.gif(\?.*)?$/i.test(resolved ?? '')
            if (!resolved) return null
            return (
              <figure className="my-4 overflow-hidden border border-line/60 tone-well-45">
                <button
                  type="button"
                  onClick={() => onPreviewMedia({ src: resolved, alt: label })}
                  title="Click to zoom"
                  className="group relative block w-full cursor-zoom-in overflow-hidden text-left"
                >
                  <img
                    src={resolved}
                    alt={label}
                    className="mx-auto max-h-[28rem] w-full object-contain transition-transform duration-200 group-hover:scale-[1.01]"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-2.5 flex items-center gap-1 border border-line/60 tone-panel-90 px-2 py-0.5 font-label text-[9.5px] font-bold caps-5 text-dim opacity-0 transition-opacity group-hover:opacity-100">
                    <ZoomIn className="h-3 w-3 text-accent" />
                    Zoom
                  </span>
                  {isGif && (
                    <span className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1 border border-accent/60 tone-panel-90 px-1.5 py-0.5 font-label text-[9.5px] font-bold caps-5 text-accent">
                      <Film className="h-2.5 w-2.5" />
                      GIF
                    </span>
                  )}
                </button>
                {label && (
                  <figcaption className="border-t border-line/40 tone-panel-50 px-3 py-1.5 font-ui text-[11px] text-dim">
                    {label}
                  </figcaption>
                )}
              </figure>
            )
          },
          a: ({ href, children }) => {
            if (href?.startsWith('guide:')) {
              const slug = href.slice('guide:'.length).trim()
              return (
                <button
                  type="button"
                  onClick={() => onOpenGuide(slug)}
                  className="inline-flex items-center gap-1 font-medium text-accent underline decoration-accent/45 underline-offset-2 hover:text-ink cursor-pointer"
                >
                  {children}
                </button>
              )
            }
            if (href?.startsWith('seven-view:')) {
              const viewId = href.slice('seven-view:'.length).trim()
              return (
                <button
                  type="button"
                  onClick={() => onOpenView(viewId)}
                  className="inline-flex items-center gap-1 border border-accent/45 bg-accent/10 px-1.5 py-0.5 font-ui text-[11.5px] font-semibold text-accent transition-colors hover:border-accent hover:bg-accent/20 hover:text-ink cursor-pointer"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>{children}</span>
                </button>
              )
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-secondary-ink underline decoration-secondary-ink/40 underline-offset-2 hover:text-ink"
              >
                <span>{children}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )
          }
        }}
      >
        {guide.body}
      </ReactMarkdown>
    </div>
  )
}

export function GuidesView() {
  const setView = useApp((s) => s.setView)
  const [selectedSlug, setSelectedSlug] = useViewPlace<string>('guides.selected', BUILTIN_GUIDES[0]?.slug ?? '')
  const [sidebarOpen, setSidebarOpen] = useViewPlace<boolean>('guides.sidebarOpen', true)
  const [query, setQuery] = useState('')
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const articleScrollRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => searchGuides(BUILTIN_GUIDES, query), [query])
  const visibleGuides = useMemo(() => results.map((r) => r.guide), [results])
  const snippetBySlug = useMemo(() => new Map(results.map((r) => [r.guide.slug, r.snippet])), [results])
  const sections = useMemo(() => groupGuidesBySection(visibleGuides), [visibleGuides])

  const activeGuide = useMemo(
    () => BUILTIN_GUIDES.find((g) => g.slug === selectedSlug) ?? BUILTIN_GUIDES[0] ?? null,
    [selectedSlug]
  )

  const activeIndex = activeGuide ? BUILTIN_GUIDES.findIndex((g) => g.slug === activeGuide.slug) : -1
  const prevGuide = activeIndex > 0 ? BUILTIN_GUIDES[activeIndex - 1] : null
  const nextGuide = activeIndex >= 0 && activeIndex < BUILTIN_GUIDES.length - 1 ? BUILTIN_GUIDES[activeIndex + 1] : null

  useEffect(() => {
    articleScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [activeGuide?.slug])

  const openGuide = (slug: string) => {
    const exact = BUILTIN_GUIDES.find((g) => g.slug === slug || g.slug.endsWith(`-${slug}`))
    if (exact) setSelectedSlug(exact.slug)
  }

  const jumpToHeading = (id: string) => {
    const el = articleScrollRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ViewHeader
        title="Guides & Handbook"
        subtitle="Built-in practical guides for getting the most out of Seven — read-only and separate from your library files."
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 border border-line/50 tone-panel-45 px-2 py-1 font-label text-[10px] caps-5 text-dim">
              <Lock className="h-3 w-3 text-accent" />
              Built-in · Read-only
            </span>
            <Button
              size="sm"
              variant="ghost"
              icon={sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? 'Hide index' : 'Show index'}
            </Button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden p-3 pt-0">
        {/* LEFT NAVIGATION RAIL */}
        {sidebarOpen && (
          <Panel
            className="w-72 shrink-0"
            bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-line/50 tone-well-60 px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-faint" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search all guides…"
                className="h-7 min-w-0 flex-1 bg-transparent font-ui text-[12px] text-ink placeholder:text-faint focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  title="Clear search"
                  onClick={() => setQuery('')}
                  className="p-0.5 text-faint hover:text-ink cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2.5">
              {sections.length === 0 ? (
                <div className="px-2 py-6 text-center font-ui text-[12px] text-dim">
                  No guides match “{query}”.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {sections.map((group) => (
                    <div key={group.section} className="flex flex-col gap-1">
                      <Eyebrow className="px-2 text-accent-soft">{group.section}</Eyebrow>
                      {group.guides.map((g) => {
                        const active = g.slug === activeGuide?.slug
                        const snippet = snippetBySlug.get(g.slug)
                        return (
                          <button
                            key={g.slug}
                            type="button"
                            onClick={() => setSelectedSlug(g.slug)}
                            className={cn(
                              'flex flex-col gap-0.5 border px-2.5 py-2 text-left transition-colors cursor-pointer',
                              active
                                ? 'border-accent/60 bg-accent/12 text-ink'
                                : 'border-transparent text-dim hover:border-line/40 hover:bg-ink/[0.04] hover:text-ink'
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <BookOpen className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-accent' : 'text-faint')} />
                              <span className={cn('truncate font-ui text-[12.5px]', active ? 'font-semibold text-ink' : 'font-medium')}>
                                {g.title}
                              </span>
                            </div>
                            {snippet ? (
                              <span className="line-clamp-2 pl-5 font-ui text-[10.5px] leading-snug text-dim">
                                {snippet}
                              </span>
                            ) : g.summary ? (
                              <span className="line-clamp-2 pl-5 font-ui text-[10.5px] leading-snug text-faint">
                                {g.summary}
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-line/40 tone-well-50 px-3 py-2 font-ui text-[10.5px] text-faint">
              <span>{BUILTIN_GUIDES.length} built-in guides</span>
              <button
                type="button"
                onClick={() => openGuide('06-writing-guides')}
                className="text-accent hover:underline cursor-pointer"
              >
                How to edit
              </button>
            </div>
          </Panel>
        )}

        {/* CENTER READING PANE — WRAPPED IN THEMED PANEL SURFACE FOR FULL READABILITY OVER ANY BACKGROUND */}
        <Panel className="min-w-0 flex-1" bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div ref={articleScrollRef} className="min-h-0 flex-1 overflow-y-auto">
            {activeGuide ? (
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-6 sm:px-8">
                <div className="flex flex-col gap-2.5 border-b border-line/50 pb-5">
                  <div className="flex flex-wrap items-center gap-2 font-label text-[10px] caps-12 text-accent">
                    <Compass className="h-3.5 w-3.5" />
                    <span>{activeGuide.section}</span>
                    <ChevronRight className="h-3 w-3 text-faint" />
                    <span className="text-dim">{activeGuide.readMinutes} min read</span>
                    <span className="flex-1" />
                    <CopyIconButton
                      text={`# ${activeGuide.title}\n\n${activeGuide.body}`}
                      label="Copy page"
                      toastMessage={`Copied "${activeGuide.title}"`}
                    />
                  </div>
                  <h1 className="font-ui text-[26px] font-semibold tracking-tight text-ink">
                    {activeGuide.title}
                  </h1>
                  {activeGuide.summary && (
                    <p className="font-ui text-[13.5px] leading-relaxed text-dim">{activeGuide.summary}</p>
                  )}
                  {activeGuide.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {activeGuide.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setQuery(tag)}
                          className="border border-line/50 tone-well-50 px-2 py-0.5 font-ui text-[10.5px] text-dim transition-colors hover:border-accent/60 hover:text-accent cursor-pointer"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <GuideArticle
                  guide={activeGuide}
                  onOpenGuide={openGuide}
                  onOpenView={(viewId) => setView(viewId)}
                  onPreviewMedia={setLightbox}
                />

                {/* PREV / NEXT ARTICLE FOOTER */}
                <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line/50 pt-5 sm:grid-cols-2">
                  {prevGuide ? (
                    <button
                      type="button"
                      onClick={() => setSelectedSlug(prevGuide.slug)}
                      className="flex flex-col items-start gap-1 border border-line/50 tone-well-50 p-3 text-left transition-colors hover:border-accent/60 hover:tone-well-75 cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1 font-label text-[10px] caps-12 text-faint">
                        <ArrowLeft className="h-3 w-3" />
                        Previous
                      </span>
                      <span className="font-ui text-[13px] font-semibold text-ink">{prevGuide.title}</span>
                    </button>
                  ) : (
                    <div />
                  )}
                  {nextGuide ? (
                    <button
                      type="button"
                      onClick={() => setSelectedSlug(nextGuide.slug)}
                      className="flex flex-col items-end gap-1 border border-line/50 tone-well-50 p-3 text-right transition-colors hover:border-accent/60 hover:tone-well-75 cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1 font-label text-[10px] caps-12 text-faint">
                        Next
                        <ArrowRight className="h-3 w-3" />
                      </span>
                      <span className="font-ui text-[13px] font-semibold text-ink">{nextGuide.title}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-dim">No built-in guides found.</div>
            )}
          </div>
        </Panel>

        {/* RIGHT TABLE OF CONTENTS RAIL */}
        {activeGuide && activeGuide.headings.length >= 2 && (
          <Panel
            className="hidden w-56 shrink-0 xl:flex"
            bodyClassName="flex flex-1 flex-col overflow-y-auto p-4"
          >
            <Eyebrow className="mb-2.5 text-faint">On This Page</Eyebrow>
            <nav className="flex flex-col gap-1">
              {activeGuide.headings.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => jumpToHeading(h.id)}
                  className={cn(
                    'truncate py-1 text-left font-ui text-[11.5px] text-dim transition-colors hover:text-accent cursor-pointer',
                    h.level === 3 && 'pl-3 text-[11px] text-faint'
                  )}
                  title={h.text}
                >
                  {h.text}
                </button>
              ))}
            </nav>
          </Panel>
        )}
      </div>

      {lightbox && (
        <GuideLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
      )}
    </div>
  )
}

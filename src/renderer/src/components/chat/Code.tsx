import { useEffect, useMemo, useRef, useState } from 'react'
import type { HighlighterGeneric, ThemedToken } from 'shiki'

const THEME = 'github-dark'

type Highlighter = HighlighterGeneric<string, string>

let shiki: Promise<{ highlighter: Highlighter; known: (lang: string) => boolean }> | null = null
const loaded = new Map<string, Promise<boolean>>()

function highlighterFor(lang: string): Promise<Highlighter | null> {
  shiki ??= import('shiki').then(async (m) => ({
    highlighter: (await m.createHighlighter({ themes: [THEME], langs: [], engine: m.createJavaScriptRegexEngine() })) as unknown as Highlighter,
    known: (l: string) => l in m.bundledLanguages
  }))
  return shiki.then(async ({ highlighter, known }) => {
    if (!known(lang)) return null
    let ready = loaded.get(lang)
    if (!ready) {
      ready = highlighter.loadLanguage(lang as never).then(
        () => true,
        () => false
      )
      loaded.set(lang, ready)
    }
    return (await ready) ? highlighter : null
  })
}

function useHighlighter(lang: string | null): Highlighter | null {
  const [state, setState] = useState<{ lang: string; highlighter: Highlighter | null } | null>(null)
  useEffect(() => {
    if (!lang) return
    let alive = true
    void highlighterFor(lang).then(
      (highlighter) => alive && setState({ lang, highlighter }),
      () => alive && setState({ lang, highlighter: null })
    )
    return () => {
      alive = false
    }
  }, [lang])
  return lang && state?.lang === lang ? state.highlighter : null
}

function tokenStyle(t: ThemedToken): React.CSSProperties {
  const f = t.fontStyle ?? 0
  return { color: t.color, fontStyle: f & 1 ? 'italic' : undefined, fontWeight: f & 2 ? 'bold' : undefined, textDecoration: f & 4 ? 'underline' : undefined }
}

export function languageOf(className: string | undefined): string | null {
  return /(?:^|\s)language-([\w+#.-]+)/.exec(className ?? '')?.[1]?.toLowerCase() ?? null
}

export function CodeBlock({ className, source }: { className?: string; source: string }) {
  const lang = languageOf(className)
  const highlighter = useHighlighter(lang)
  const code = source.replace(/\n$/, '')
  const lines = useMemo(() => {
    if (!highlighter || !lang) return null
    try {
      return highlighter.codeToTokensBase(code, { lang, theme: THEME })
    } catch {
      return null
    }
  }, [highlighter, lang, code])
  if (!lines) return <code className={className}>{source}</code>
  return (
    <code className={className}>
      {lines.map((line, i) => (
        <span key={i}>
          {line.map((t, j) => (
            <span key={j} style={tokenStyle(t)}>
              {t.content}
            </span>
          ))}
          {i < lines.length - 1 ? '\n' : null}
        </span>
      ))}
    </code>
  )
}

let mermaid: Promise<typeof import('mermaid').default> | null = null
let counter = 0

function loadMermaid(): Promise<typeof import('mermaid').default> {
  mermaid ??= import('mermaid').then((m) => {
    m.default.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict', fontFamily: 'inherit' })
    return m.default
  })
  return mermaid
}

export function Diagram({ source }: { source: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [drawn, setDrawn] = useState(false)
  const text = source.trim()
  useEffect(() => {
    let alive = true
    const timer = window.setTimeout(() => {
      void loadMermaid()
        .then(async (m) => {
          if (!(await m.parse(text, { suppressErrors: true }))) throw new Error('This diagram has a syntax error. Check the first line names a diagram type such as flowchart TD, sequenceDiagram or timeline.')
          const { svg } = await m.render(`seven-mermaid-${++counter}`, text)
          if (!alive || !host.current) return
          host.current.innerHTML = svg
          setDrawn(true)
          setFailed(null)
        })
        .catch((e: unknown) => {
          if (alive) setFailed(e instanceof Error ? e.message : String(e))
        })
    }, 250)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [text])
  return (
    <div className="my-2">
      <div ref={host} className={drawn && !failed ? 'flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full' : 'hidden'} />
      {(!drawn || failed) && (
        <pre>
          <code>{text}</code>
          {failed && <div className="mt-2 font-sans text-[11px] text-alert">{failed}</div>}
        </pre>
      )}
    </div>
  )
}

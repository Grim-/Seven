import { referenceHref, referencePattern } from '@shared/text'
import { showName } from '@shared/ids'
import { Chip } from './References'
import { memo, useMemo, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { openSevenLink } from '../../lib/links'
import { Drawing, LibraryImage } from './Drawing'
import { CodeBlock, Diagram } from './Code'
import { cn } from '../../lib/cn'

function isPictureBlock(node: unknown): boolean {
  const first = (node as { children?: { properties?: { className?: unknown } }[] } | undefined)?.children?.[0]
  const cls = first?.properties?.className
  return Array.isArray(cls) && (cls.includes('language-svg') || cls.includes('language-mermaid'))
}

export type LineEdit = (change: (lines: string[]) => string[]) => void

const TASK = /^(\s*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\])/

export function toggleTask(lines: string[], index: number): string[] {
  const m = TASK.exec(lines[index] ?? '')
  if (!m) return lines
  const next = [...lines]
  next[index] = lines[index].replace(TASK, (_all, a: string, mark: string, b: string) => `${a}${mark === ' ' ? 'x' : ' '}${b}`)
  return next
}

function indent(line: string): number {
  return (/^\s*/.exec(line)?.[0] ?? '').replace(/\t/g, '    ').length
}

export function removeItem(lines: string[], index: number): string[] {
  if (index < 0 || index >= lines.length) return lines
  const base = indent(lines[index])
  let end = index + 1
  while (end < lines.length && (lines[end].trim() === '' ? end + 1 < lines.length && indent(lines[end + 1]) > base : indent(lines[end]) > base)) end += 1
  return [...lines.slice(0, index), ...lines.slice(end)]
}

export function removeDone(lines: string[]): string[] {
  let out = lines
  for (let i = out.length - 1; i >= 0; i--) {
    const m = TASK.exec(out[i])
    if (m && m[2] !== ' ') out = removeItem(out, i)
  }
  return out
}

export function countDone(text: string): number {
  return text.split('\n').filter((l) => {
    const m = TASK.exec(l)
    return Boolean(m && m[2] !== ' ')
  }).length
}

type HastNode = { type?: string; tagName?: string; properties?: Record<string, unknown>; children?: HastNode[]; position?: { start: { line: number } } }

function checkedIn(node: HastNode | undefined): boolean {
  if (!node) return false
  if (node.tagName === 'input') return node.properties?.checked === true
  return (node.children ?? []).some((c) => (c.tagName === 'input' ? c.properties?.checked === true : c.tagName === 'p' ? checkedIn(c) : false))
}

function EditableItem({ node, className, children, onLines }: { node?: HastNode; className?: string; children?: ReactNode; onLines: LineEdit }) {
  const line = (node?.position?.start.line ?? 0) - 1
  const task = className?.includes('task-list-item')
  const checked = task && checkedIn(node)
  return (
    <li className={`group/item relative ${task ? 'list-none' : ''}`}>
      <span className="flex items-start gap-1.5">
        {task && (
          <button
            type="button"
            title={checked ? 'Mark not done' : 'Mark done'}
            onClick={() => onLines((lines) => toggleTask(lines, line))}
            className={`mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center border ${checked ? 'border-accent bg-accent/20 text-accent' : 'border-line text-transparent hover:border-accent'}`}
          >
            <Check className="h-3 w-3" />
          </button>
        )}
        <span className={`min-w-0 flex-1 ${checked ? 'line-through opacity-50' : ''}`}>{children}</span>
        <button type="button" title="Remove" onClick={() => onLines((lines) => removeItem(lines, line))} className="mt-[2px] shrink-0 text-faint opacity-0 hover:text-alert group-hover/item:opacity-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    </li>
  )
}


function keepSeven(url: string): string {
  return url.startsWith('seven:') ? url : defaultUrlTransform(url)
}

export const Markdown = memo(function Markdown({ text, onPage, onEntry, onLines, className }: { text: string; onPage?: (ref: string) => void; onEntry?: (kind: string, ref: string) => boolean; onLines?: LineEdit; className?: string }) {
  const source = useMemo(() => text.replace(referencePattern(), (_m, lead: string, kind: string, ref: string, _action: string | undefined, part: string | undefined) => `${lead}[${showName(ref.replace(/^"|"$/g, '')).replace(/[[\]]/g, '')}](${referenceHref(kind, ref)} "@${kind}${part ? `#${part}` : ''}")`), [text])
  return (
    <div className={cn('prose-seven', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={keepSeven}
        components={{
          pre: ({ node, children }) => (isPictureBlock(node) ? <>{children}</> : <pre>{children}</pre>),
          code: ({ className, children }) =>
            className?.includes('language-svg') ? (
              <Drawing source={String(children)} />
            ) : className?.includes('language-mermaid') ? (
              <Diagram source={String(children)} />
            ) : className?.includes('language-') ? (
              <CodeBlock className={className} source={String(children)} />
            ) : (
              <code className={className}>{children}</code>
            ),
          ...(onLines
            ? {
                li: ({ node, className, children }: { node?: unknown; className?: string; children?: ReactNode }) => (
                  <EditableItem node={node as HastNode} className={className} onLines={onLines}>
                    {children}
                  </EditableItem>
                ),
                input: ({ type, ...rest }: { type?: string }) => (type === 'checkbox' ? null : <input type={type} {...rest} />)
              }
            : {}),
          img: ({ src, alt }) => (typeof src === 'string' && src.startsWith('seven:') ? <LibraryImage href={src} alt={alt ?? ''} /> : <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} />),
          a: ({ href, title, children }) =>
            href?.startsWith('seven:') && title?.startsWith('@') ? (
              <Chip
                kind={title.slice(1).split('#')[0]}
                part={title.split('#')[1] ?? null}
                refText={decodeURIComponent(href.slice(href.indexOf('/') + 1))}
                onOpen={
                  onEntry
                    ? () => {
                        if (!onEntry(title.slice(1).split('#')[0], decodeURIComponent(href.slice(href.indexOf('/') + 1)))) openSevenLink(href)
                      }
                    : onPage && title === '@page'
                      ? () => onPage(decodeURIComponent(href.slice('seven:page/'.length)))
                      : undefined
                }
              />
            ) : href?.startsWith('seven:') ? (
              <button
                type="button"
                className="text-accent underline decoration-accent/40 underline-offset-2 hover:text-ink"
                onClick={() => (onPage && href.startsWith('seven:page/') ? onPage(decodeURIComponent(href.slice('seven:page/'.length))) : openSevenLink(href))}
              >
                {children}
              </button>
            ) : (
              <a href={href}>{children}</a>
            )
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
})

import { useRef, useState, type ReactNode } from 'react'
import { useAui, useAuiState } from '@assistant-ui/react'
import type { TextMessagePartProps } from '@assistant-ui/react'
import { Eye, FolderOpen, Link, PanelRight, Pin, X } from 'lucide-react'
import { referenceHref, referencePattern } from '@shared/text'
import { showName } from '@shared/ids'
import { openSevenLink } from '../../lib/links'
import { useIncludeText } from '../../lib/useIncludeText'
import { copyText } from '../../lib/notify'
import { FloatLayer, openMenu, type MenuItem } from '../ui'
import { showInPanel } from '../data/showInPanel'
import { EntryInspect } from '../entries/EntryInspect'
import { useResolvedRef } from '../entries/useResolvedRef'
import { pinToChatTable } from './tabletopStore'
import { kindUi } from '../../registries/kinds'

function copyLinks(e: ClipboardEvent): void {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !e.clipboardData) return
  const common = sel.getRangeAt(0).commonAncestorContainer
  const within = (common instanceof Element ? common : common.parentElement)?.closest<HTMLElement>('[data-link]')
  if (within?.dataset.link) {
    e.clipboardData.setData('text/plain', within.dataset.link)
    e.preventDefault()
    return
  }
  const box = document.createElement('div')
  for (let i = 0; i < sel.rangeCount; i++) box.append(sel.getRangeAt(i).cloneContents())
  const chips = box.querySelectorAll<HTMLElement>('[data-link]')
  if (!chips.length) return
  chips.forEach((chip) => chip.replaceWith(chip.dataset.link ?? ''))
  box.style.cssText = 'position:fixed;left:-99999px;top:0;white-space:pre-wrap'
  document.body.append(box)
  const text = box.innerText
  box.remove()
  e.clipboardData.setData('text/plain', text)
  e.clipboardData.setData('text/html', box.innerHTML)
  e.preventDefault()
}

if (typeof document !== 'undefined') document.addEventListener('copy', copyLinks)

export function Chip({ kind, refText, action = null, part = null, onRemove, onOpen, menu = [] }: { kind: string; refText: string; action?: string | null; part?: string | null; onRemove?: () => void; onOpen?: () => void; menu?: MenuItem[] }) {
  const cleanRef = refText.replace(/^"|"$/g, '')
  const link = `@${kind}:${cleanRef}${action ? `:${action}` : ''}${part ? `#${part}` : ''}`
  const { kind: resolvedKind, id: resolvedId, title: displayTitle, label: displayKind } = useResolvedRef(kind, cleanRef)
  const anchor = useRef<HTMLSpanElement>(null)
  const [inspecting, setInspecting] = useState<string | null | false>(false)

  const included = useIncludeText(kind, refText, onRemove || action ? null : part)
  const openFull = () => (onOpen ? onOpen() : openSevenLink(referenceHref(resolvedKind, resolvedId)))

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.ctrlKey || e.metaKey || onOpen) {
      openFull()
      return
    }
    setInspecting((v) => (v === false ? part : false))
  }

  const handleMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    openMenu(e, showName(displayTitle), [
      { label: 'Inspect here', icon: <Eye />, onSelect: () => setInspecting(part) },
      ...(kindUi(resolvedKind).slateParts ?? []).map((p) => ({ label: `Inspect ${p.label} here`, icon: <Eye />, onSelect: () => setInspecting(p.part) })),
      { label: 'Pin to chat table', icon: <Pin />, onSelect: () => pinToChatTable(resolvedKind, resolvedId, displayTitle) },
      { label: 'Show in chat panel', icon: <PanelRight />, onSelect: () => void showInPanel(`${resolvedKind}/${resolvedId}`, part) },
      { label: 'Open in Data', icon: <FolderOpen />, onSelect: openFull },
      { label: '', separator: true },
      { label: 'Copy link', icon: <Link />, onSelect: () => void copyText(link, 'Link copied', link) },
      ...(menu.length ? [{ label: '', separator: true }, ...menu] : [])
    ])
  }

  if (included !== null)
    return (
      <>
        <span ref={anchor} data-link={link} role="link" title={`From ${link} · Click to inspect · Right-click for actions`} onClick={handleClick} onContextMenu={handleMenu} className="seven-include cursor-pointer">
          {included}
        </span>
        {inspecting !== false && (
          <FloatLayer anchor={anchor} onClose={() => setInspecting(false)} side="bottom" align="start">
            <EntryInspect kind={kind} refText={refText} part={inspecting || null} onClose={() => setInspecting(false)} />
          </FloatLayer>
        )}
      </>
    )
  return (
    <>
      <span
        ref={anchor}
        data-link={link}
        onContextMenu={handleMenu}
        className="seven-chip"
      >
        <button
          type="button"
          title={`${displayKind}: ${showName(displayTitle)}${action ? ` · Placeholder :${action} (pulls a fresh value on submit)` : ''} · Click to inspect in chat · Right-click for actions`}
          onClick={handleClick}
          className="seven-chip-btn"
        >
          <span className="seven-chip-kind">
            {displayKind}
          </span>
          <span className="seven-chip-title">{showName(displayTitle)}</span>
          {action && <span className="seven-chip-action">:{action}</span>}
          {part && <span className="seven-chip-part">#{part}</span>}
        </button>
        {onRemove && (
          <button type="button" title="Remove" onClick={onRemove} className="seven-chip-remove">
            <X className="h-3 w-3" />
          </button>
        )}
      </span>
      {inspecting !== false && (
        <FloatLayer anchor={anchor} onClose={() => setInspecting(false)} side="bottom" align="start">
          <EntryInspect kind={kind} refText={refText} part={inspecting || null} onClose={() => setInspecting(false)} />
        </FloatLayer>
      )}
    </>
  )
}

export function withReferences(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(referencePattern())) {
    const start = (m.index ?? 0) + m[1].length
    if (start > last) out.push(text.slice(last, start))
    out.push(<Chip key={start} kind={m[2]} refText={m[3]} action={m[4] ?? null} part={m[5] ?? null} />)
    last = (m.index ?? 0) + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function UserTextPart({ text }: TextMessagePartProps) {
  return <>{withReferences(text)}</>
}

export function ComposerReferences() {
  const text = useAuiState((s) => (s.composer.isEditing ? s.composer.text : ''))
  const aui = useAui()
  const found = [...text.matchAll(referencePattern())].filter((m) => (m.index ?? 0) + m[0].length < text.length)
  if (!found.length) return null
  const remove = (m: RegExpMatchArray) => {
    const start = (m.index ?? 0) + m[1].length
    aui.composer.setText((text.slice(0, start) + text.slice((m.index ?? 0) + m[0].length)).replace(/ {2,}/g, ' '))
  }
  return (
    <div className="flex flex-wrap gap-1.5 border-t border-line/60 tone-panel-40 px-3 pt-2">
      {found.map((m) => (
        <Chip key={m.index} kind={m[2]} refText={m[3]} action={m[4] ?? null} part={m[5] ?? null} onRemove={() => remove(m)} />
      ))}
    </div>
  )
}

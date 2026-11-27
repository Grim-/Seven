import { Check, Plus, Sparkles } from 'lucide-react'
import type { ImageContextSnippet, ImagePromptContext } from '@shared/types'
import { cn } from '../../lib/cn'
import { Button } from '../ui'

function appendSnippet(prompt: string, snippetText: string): string {
  const trimmed = prompt.trim()
  if (!trimmed) return snippetText
  const lower = trimmed.toLowerCase()
  const needle = snippetText.toLowerCase()
  if (lower.includes(needle)) return prompt
  const sep = /[,.;:\n]$/.test(trimmed) ? ' ' : ', '
  return `${trimmed}${sep}${snippetText}`
}

export function ImageContextSnippets({
  context,
  prompt,
  onPromptChange
}: {
  context: ImagePromptContext | null
  prompt: string
  onPromptChange: (next: string) => void
}) {
  if (!context || context.snippets.length === 0) return null

  const lowerPrompt = prompt.toLowerCase()
  const hasSnippet = (s: ImageContextSnippet) => lowerPrompt.includes(s.text.toLowerCase())

  const insertAll = () => {
    let next = prompt
    for (const s of context.snippets) next = appendSnippet(next, s.text)
    onPromptChange(next)
  }

  return (
    <div className="flex flex-col gap-1.5 border border-line/60 tone-panel-35 px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-label text-[10px] font-bold caps-14 text-accent">
          {context.title}
        </span>
        <span className="text-[11px] text-faint">Click fields to add to prompt</span>
        <span className="flex-1" />
        {context.suggestedPrompt && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Sparkles />}
            onClick={() => onPromptChange(context.suggestedPrompt!)}
            title="Use suggested prompt built from visual fields"
          >
            Suggested
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={insertAll}>
          Insert all
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {context.snippets.map((s) => {
          const active = hasSnippet(s)
          return (
            <button
              key={s.id}
              type="button"
              title={s.text}
              onClick={() => onPromptChange(appendSnippet(prompt, s.text))}
              className={cn(
                'inline-flex max-w-[16rem] items-center gap-1 border px-2 py-0.5 font-ui text-[11px] transition-colors',
                active
                  ? 'border-accent/60 bg-accent/15 text-accent'
                  : 'border-line/70 tone-well-40 text-dim hover:border-line-hover hover:text-ink'
              )}
            >
              {active ? <Check className="h-3 w-3 shrink-0" /> : <Plus className="h-3 w-3 shrink-0 text-faint" />}
              <span className="truncate">{s.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

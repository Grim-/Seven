import { TokenTextarea } from '../ui'
import { useRepoTokens } from './useRepoTokens'

export function StoryText({ value, onValue, placeholder, rows = 3 }: { value: string; onValue: (v: string) => void; placeholder?: string; rows?: number }) {
  const tokens = useRepoTokens()
  return <TokenTextarea value={value} onValue={onValue} tokens={tokens} rows={Math.max(rows, Math.min(14, value.split('\n').length + 1))} placeholder={placeholder} />
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent-soft">{title}</h3>
        {hint && <span className="text-[11.5px] text-faint">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

import { Pencil } from 'lucide-react'
import { cn } from '../../lib/cn'
import { InlineEdit } from './InlineEdit'

export function InlineTitle({ value, onSave, placeholder = 'Untitled', className }: { value: string; onSave: (next: string) => void; placeholder?: string; className?: string }) {
  return <InlineEdit value={value} onSave={onSave} required placeholder={placeholder} title="Rename" className={cn('text-[20px] font-semibold text-ink hover:text-accent', className)} trailing={<Pencil className="h-3.5 w-3.5 shrink-0 self-center text-faint opacity-0 group-hover:opacity-100" />} />
}

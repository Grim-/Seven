import { Info } from 'lucide-react'
import { Tooltip } from './feedback'

export function InfoTip({ title, text }: { title: string; text?: string }) {
  if (!text) return null
  return (
    <Tooltip title={title} body={text}>
      <Info className="h-3 w-3 shrink-0 cursor-help text-faint hover:text-accent" />
    </Tooltip>
  )
}

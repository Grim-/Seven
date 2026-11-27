import { Check, X } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { EffectSteps } from './EffectSteps'
import type { EffectArm, ListPath } from './tree'

export function EffectArmView({ arm, path }: { arm: EffectArm; path: ListPath }) {
  const pass = arm.branch.tone === 'pass'
  return (
    <div className="flex min-w-0 flex-col border border-dashed border-ink/10 px-2 pb-1.5 pt-2">
      <span className={cn('mb-1.5 flex items-center gap-1.5 font-label text-[10px] font-bold caps-14 ', pass ? 'text-ok' : 'text-alert')}>
        {pass ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
        {arm.branch.label}
      </span>
      <EffectSteps nodes={arm.nodes} path={path} compact />
    </div>
  )
}

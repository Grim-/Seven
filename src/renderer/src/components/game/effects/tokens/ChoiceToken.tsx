import { choiceLabel } from '@shared/game/core/params'
import { cn } from '../../../../lib/cn'
import { registerEffectToken, type TokenEditProps, type TokenProps } from './registry'

function Text({ spec, value }: TokenProps) {
  return <>{choiceLabel(spec, typeof value === 'string' ? value : String(spec.default))}</>
}

function Edit({ spec, value, onChange, close }: TokenEditProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(spec.choices ?? []).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => {
            onChange(c)
            close()
          }}
          className={cn('border px-2.5 py-1 font-ui text-[12px]', c === value ? 'border-accent bg-accent text-on-accent' : 'border-line/60 text-dim hover:border-dim hover:text-ink')}
        >
          {choiceLabel(spec, c)}
        </button>
      ))}
    </div>
  )
}

registerEffectToken('choice', { Text, Edit })

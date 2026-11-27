import { useState } from 'react'
import { Cpu, Loader2, Play, Settings } from 'lucide-react'
import type { AgentProfile } from '@shared/types'
import { chatCanAnswer } from '../../lib/sendOrQueue'
import { failed } from '../../lib/notify'
import { useApp } from '../../store/app'
import { isRunnable, modelName, sortModels, useModels } from '../../store/models'
import { Button } from '../ui'
import { cn } from '../../lib/cn'

export interface ModelReadyControlProps {
  agent?: AgentProfile | null
  compact?: boolean
  className?: string
}

/**
 * Shared inline control showing whether the selected agent's model is ready,
 * with a one-click local model loader or setup button when unloaded.
 */
export function ModelReadyControl({ agent = null, compact = false, className }: ModelReadyControlProps) {
  const models = useModels((s) => s.list)
  const host = useModels((s) => s.host)
  const loadModel = useModels((s) => s.load)
  const [pickedId, setPickedId] = useState('')

  const runnable = sortModels(models.filter(isRunnable), host.modelId)
  const targetId = pickedId && runnable.some((m) => m.id === pickedId) ? pickedId : (host.modelId ?? runnable[0]?.id ?? '')
  const ready = agent ? chatCanAnswer(agent) : host.status === 'ready'
  const loading = host.status === 'loading'
  const activeLabel = modelName(models, agent?.modelId ?? host.modelId)

  const handleLoad = () => {
    if (!targetId || loading) return
    void loadModel(targetId).catch(failed('Could not load model'))
  }

  if (ready) {
    return (
      <div className={cn('flex items-center gap-1.5 font-ui text-[10px] text-ok', className)}>
        <Cpu className="h-3 w-3 shrink-0" />
        <span className="truncate caps-5 ">
          READY{activeLabel ? ` · ${activeLabel}` : ''}
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 font-ui text-[10px]', className)}>
      {runnable.length > 0 ? (
        <>
          <select
            value={targetId}
            onChange={(e) => setPickedId(e.target.value)}
            disabled={loading}
            aria-label="Choose local model to load"
            className={cn(
              'min-w-0 flex-1 border border-line/70 tone-panel-90 px-1.5 font-ui text-[10px] text-ink outline-none focus:border-accent',
              compact ? 'h-6' : 'h-7'
            )}
          >
            {runnable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="primary"
            icon={loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            disabled={!targetId || loading}
            onClick={handleLoad}
            className={cn(compact ? 'h-6 px-2 text-[9.5px]' : 'h-7 px-2.5 text-[10px]')}
          >
            {loading ? `LOADING ${Math.round(host.progress * 100)}%` : 'LOAD MODEL'}
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          icon={<Settings className="h-3 w-3" />}
          onClick={() => useApp.getState().setView('models')}
          className={cn(compact ? 'h-6 px-2 text-[9.5px]' : 'h-7 px-2.5 text-[10px]')}
        >
          SETUP MODEL
        </Button>
      )}
    </div>
  )
}

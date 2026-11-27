import { ChevronDown, Cloud, Power, Settings2, Star } from 'lucide-react'
import { Popover, StatusBadge, type Tone } from '../ui'
import { isRunnable, modelName, sortModels, useModels } from '../../store/models'
import { useApp } from '../../store/app'
import { toast } from '../../store/toasts'
import { formatBytes } from '../../lib/format'
import { cn } from '../../lib/cn'
import { failed } from '../../lib/notify'

export function ModelPicker({ agentModelId }: { agentModelId: string | null }) {
  const host = useModels((s) => s.host)
  const list = useModels((s) => s.list)
  const load = useModels((s) => s.load)
  const unload = useModels((s) => s.unload)
  const setView = useApp((s) => s.setView)

  const effective = agentModelId ?? host.modelId
  const remote = Boolean(effective && list.find((m) => m.id === effective)?.remote)
  const tone: Tone = remote ? 'ok' : host.status === 'loading' ? 'busy' : effective && (agentModelId ? true : host.status === 'ready') ? 'ok' : 'warn'
  const label = remote ? `${modelName(list, effective!)} · remote` : host.status === 'loading' ? `Loading ${Math.round(host.progress * 100)}%` : effective ? modelName(list, effective) : 'No model loaded'
  const loadedId = host.status === 'ready' ? host.modelId : null

  const pick = (id: string) => {
    if (id === loadedId) return
    if (list.find((m) => m.id === id)?.remote) {
      toast.info('Remote models aren’t loaded', 'Give an agent this model in Agents; that agent uses it when it replies.')
      return
    }
    load(id).catch(failed('Model load failed'))
  }

  return (
    <Popover
      disabled={host.status === 'loading'}
      title={label}
      className="w-96"
      trigger={
        <StatusBadge tone={tone}>
          <span className="flex min-w-0 items-center gap-1">
            <span className="max-w-36 truncate">{label}</span>
            <ChevronDown className="h-3 w-3 shrink-0" />
          </span>
        </StatusBadge>
      }
    >
      {(close) => (
        <>
          {agentModelId && (
            <div className="border-b border-line/50 px-3 py-2 text-[11.5px] text-dim">
              {remote ? `This agent always uses ${modelName(list, agentModelId)}, a remote model: its chats are sent there.` : `This agent always uses ${modelName(list, agentModelId)}; it is loaded again when you send.`}
            </div>
          )}
          <div className="max-h-80 overflow-y-auto">
            {list.length === 0 && <div className="px-3 py-3 text-[12.5px] text-dim">No models yet. Add a folder in Models.</div>}
            {sortModels(list.filter(isRunnable), loadedId).map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  close()
                  pick(m.id)
                }}
                className={cn('flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent/10', m.id === loadedId && 'bg-ok/5')}
              >
                <Star className={cn('h-3.5 w-3.5 shrink-0', m.favourite ? 'text-accent' : 'text-transparent')} fill={m.favourite ? 'currentColor' : 'none'} />
                <span title={m.name} className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{m.name}</span>
                {m.quant && <span className="shrink-0 font-ui text-[10.5px] text-tint-purple">{m.quant}</span>}
                {m.remote ? <Cloud className="h-3.5 w-3.5 shrink-0 text-accent" /> : <span className="shrink-0 font-ui text-[10.5px] text-faint">{formatBytes(m.sizeBytes)}</span>}
                {m.id === loadedId && <span className="shrink-0 font-label text-[10px] caps-5 text-ok">Loaded</span>}
              </button>
            ))}
          </div>
          <div className="flex border-t border-line/50">
            {loadedId && (
              <button
                onClick={() => {
                  close()
                  unload().catch(failed('Unload failed'))
                }}
                className="flex flex-1 items-center gap-2 px-3 py-2 text-[12px] text-dim hover:text-ink"
              >
                <Power className="h-3.5 w-3.5" /> Unload
              </button>
            )}
            <button
              onClick={() => {
                close()
                setView('models')
              }}
              className="flex flex-1 items-center gap-2 px-3 py-2 text-[12px] text-dim hover:text-ink"
            >
              <Settings2 className="h-3.5 w-3.5" /> Manage models
            </button>
          </div>
        </>
      )}
    </Popover>
  )
}

import type { ServerStatus } from '@shared/types'
import { AlertBox, Fact, FactGrid, Fold, LogBox, SettingCard } from '../ui'
import { useModels } from '../../store/models'

export function MemoryServerPanel({ status }: { status: ServerStatus }) {
  const memory = status.memory
  const name = useModels((s) => s.list.find((m) => m.id === memory.modelId)?.name ?? null)
  return (
    <SettingCard title="Memory search">
      <div className="flex flex-col gap-3 p-3.5">
        <FactGrid>
          <Fact label="State">{memory.running ? 'Running' : memory.modelId ? 'Starts when an agent searches its memory' : 'No memory search model set'}</Fact>
          <Fact label="Model">{name ?? '—'}</Fact>
          <Fact label="Process">{memory.pid ?? '—'}</Fact>
        </FactGrid>
        {memory.error && <AlertBox>{memory.error}</AlertBox>}
      </div>
      <Fold label="Log" count={memory.log.length}>
        <div className="px-3.5 pb-3">
          <LogBox lines={memory.log} />
        </div>
      </Fold>
    </SettingCard>
  )
}

import type { InstallChoice } from '@shared/types'
import { Fact, FactGrid, GridRow, GridTable } from '../../ui'
import { formatBytes } from '../../../lib/format'

const COLUMNS = [
  { label: 'File', width: 'minmax(0,1fr)' },
  { label: 'Size', width: '6rem', right: true }
]

export function ReviewStep({ tag, choice, root, folder, source }: { tag: string; choice: InstallChoice; root: string; folder: string; source: string }) {
  return (
    <div className="flex flex-col gap-3">
      <FactGrid>
        <Fact label="Release">{tag}</Fact>
        <Fact label="Build">{choice.label}</Fact>
        <Fact label="Download">{formatBytes(choice.size)}</Fact>
        <Fact label="From">{source}</Fact>
        <Fact label="New folder">
          <span className="font-mono text-[12px]">{folder}</span>
        </Fact>
        <Fact label="Inside" wide>
          <span className="font-mono text-[12px]">{root}</span>
        </Fact>
      </FactGrid>
      <GridTable columns={COLUMNS}>
        {choice.files.map((f) => (
          <GridRow key={f.name}>
            <span className="truncate font-mono text-[12px]">{f.name}</span>
            <span className="text-right font-mono text-[12px] text-dim">{formatBytes(f.size)}</span>
          </GridRow>
        ))}
      </GridTable>
      <p className="text-[12.5px] text-white/80">Nothing has been downloaded yet. After it installs, Seven runs it to check it works; you then choose whether to make it active.</p>
    </div>
  )
}

import type { LibrarySection } from '@shared/types'
import type { DataSelection } from '../../store/data'
import { kindUi } from '../../registries/kinds'
import { useFileDrop } from '../../lib/useFileDrop'
import { dropFiles } from '../../lib/dropFiles'
import { DropOverlay } from '../../components/ui'
import { EntryView } from './EntryView'
import { KindList } from './KindList'

export function KindPane({ section, selected, select }: { section: LibrarySection; selected: DataSelection; select: (s: DataSelection | null) => void }) {
  const kind = section.kind
  const fileDrop = useFileDrop((_, e, dropped) => void dropFiles(dropped, e.shiftKey, kind), section.importable)
  const Browser = kindUi(kindUi(kind).showsAs ?? kind).browser
  const ui = kindUi(kind)
  const Screen = ui.present?.Screen
  const id = selected.id === 'all' ? null : selected.id

  let content: React.ReactNode
  if (Browser) content = <Browser section={section} select={select} />
  else if (ui.whole && Screen) content = <Screen key={`${kind}/${selected.id}`} kind={kind} id={id} select={select} />
  else if (!id && ui.home) content = <ui.home section={section} selected={selected} select={select} />
  else if (!id) content = <KindList section={section} selected={selected} select={select} />
  else if (Screen) content = <Screen key={`${kind}/${id}`} kind={kind} id={id} select={select} />
  else content = <EntryView key={`${kind}/${id}`} section={section} id={id} selected={selected} select={select} />

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col" {...fileDrop.props}>
      {section.importable && <DropOverlay show={fileDrop.over} label={`Drop to import into ${section.plural}`} />}
      {content}
    </div>
  )
}

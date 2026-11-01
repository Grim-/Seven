import type { LibrarySection } from '@shared/types'
import type { DataSelection } from '../../store/data'
import { kindUi } from '../../registries/kinds'
import { EntryView } from './EntryView'
import { KindList } from './KindList'

export function KindPane({ section, selected, select }: { section: LibrarySection; selected: DataSelection; select: (s: DataSelection | null) => void }) {
  const kind = section.kind
  const Browser = kindUi(kindUi(kind).showsAs ?? kind).browser
  if (Browser) return <Browser section={section} select={select} />
  const ui = kindUi(kind)
  const Screen = ui.present?.Screen
  const id = selected.id === 'all' ? null : selected.id
  if (ui.whole && Screen) return <Screen key={`${kind}/${selected.id}`} kind={kind} id={id} select={select} />
  if (!id && ui.home) return <ui.home section={section} selected={selected} select={select} />
  if (!id) return <KindList section={section} selected={selected} select={select} />
  if (Screen) return <Screen key={`${kind}/${id}`} kind={kind} id={id} select={select} />
  return <EntryView key={`${kind}/${id}`} section={section} id={id} selected={selected} select={select} />
}

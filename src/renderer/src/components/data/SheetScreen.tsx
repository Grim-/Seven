import { useEffect, useState } from 'react'
import { Plus, UserRound } from 'lucide-react'
import type { CharacterSheet } from '@shared/types'
import { showName } from '@shared/ids'
import { KindShell, askText } from '../ui'
import { engine, on } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { toast } from '../../store/toasts'
import type { DataSelection } from '../../store/data'
import type { KindScreenProps } from '../../registries/kinds'
import { onLibraryChange } from '../../lib/library'
import { AssetMedia } from '../pictures/AssetMedia'
import { SheetEditor } from './sheet/SheetEditor'
import { entryMenuAt } from '../../views/data/entryMenu'

export function askNewSheet(select: (s: DataSelection | null) => void): void {
  askText('New character', 'Name', '', async (title) => {
    try {
      const sheet = await engine('sheets.save', { id: null, title, fields: [], values: {} })
      select({ kind: 'sheet', id: sheet.id })
    } catch (err) {
      toast.error('Could not make the sheet', errorText(err))
    }
  })
}

function useSheets(): CharacterSheet[] {
  const [list, setList] = useState<CharacterSheet[]>([])
  useEffect(() => {
    const load = () =>
      void engine('sheets.list')
        .then(setList)
        .catch(() => setList([]))
    load()
    const off = onLibraryChange(load)
    const offPage = on('page.changed', load)
    return () => {
      off()
      offPage()
    }
  }, [])
  return list
}

function SheetList({ select }: { select: KindScreenProps['select'] }) {
  const sheets = useSheets()
  return (
    <KindShell
      id="sheets"
      layouts={['cards', 'tiles', 'deck', 'list']}
      items={sheets.map((s) => ({
        key: s.id,
        title: showName(s.title),
        subtitle: s.dnd ? [s.dnd.race, s.dnd.cls ? `${s.dnd.cls} ${s.dnd.level}` : `level ${s.dnd.level}`].filter(Boolean).join(' ') : s.fields.filter((f) => s.values[f]?.trim()).join(', ') || 'empty',
        icon: <UserRound className="h-4 w-4" />,
        thumb: s.image ? <AssetMedia id={s.image} className="h-full w-full object-cover" /> : undefined,
        updatedAt: s.updatedAt
      }))}
      onOpen={(item) => select({ kind: 'sheet', id: item.key })}
      onMenu={(e, item) => entryMenuAt(e, 'sheet', item.key, item.title)}
      adds={[{ label: 'New character', icon: <Plus />, onClick: () => askNewSheet(select) }]}
      empty="No characters yet."
    />
  )
}

export function SheetScreen({ id, select }: KindScreenProps) {
  const [sheet, setSheet] = useState<CharacterSheet | null | undefined>(undefined)
  useEffect(() => {
    if (!id) return setSheet(null)
    let live = true
    void engine('sheets.get', { id })
      .then((s) => live && setSheet(s))
      .catch(() => live && setSheet(null))
    return () => {
      live = false
    }
  }, [id])
  if (id && sheet === undefined) return <div className="font-mono text-[11px] text-dim">Loading…</div>
  if (sheet) return <SheetEditor key={sheet.id} start={sheet} />
  return <SheetList select={select} />
}

import { useMemo, useState } from 'react'
import { UserPlus } from 'lucide-react'
import type { WorldMeta } from '@shared/world'
import type { WorldMapUse } from '@shared/maps'
import type { StoredFaction } from '@shared/game/factions'
import type { CompendiumRef } from '@shared/compendium'
import { DND_STATS } from '@shared/dnd'
import { monsterToSheetInput } from '@shared/game/creatures'
import { Button, EmptyState, Fact, FactGrid, Field, FieldGrid, Input, ListRow, SearchListPanel } from '../ui'
import { useCompendiumList } from '../dnd/useCompendiumList'
import { AbilityScoreGrid } from '../dnd/AbilityScoreGrid'
import { FactionSelect } from '../factions/FactionSelect'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { listKeys } from '../../lib/listKeys'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { entryMenuAt } from '../../views/data/entryMenu'
import { JoinFooter } from './JoinFooter'
import { WorldMapUseSelect } from './WorldMapUseSelect'

const fact = (m: CompendiumRef, key: string): string => String(m.facts?.[key] ?? '')

function matches(m: CompendiumRef, q: string): boolean {
  return [m.name, fact(m, 'type'), fact(m, 'cr')].some((v) => v.toLowerCase().includes(q))
}

export function BestiaryCreate({ world, uses, onClose, onAdded }: { world: WorldMeta; uses: WorldMapUse[]; onClose: () => void; onAdded: (sheet: string) => void }) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [name, setName] = useState<{ of: string; text: string } | null>(null)
  const [faction, setFaction] = useState<string | null | undefined>(undefined)
  const [map, setMap] = useState('')
  const [creating, setCreating] = useState(false)
  const { refs } = useCompendiumList('monster')
  const factions: StoredFaction[] = useLive(() => engine('factions.list', { world: world.id }), 'factions.changed', [world.id]) ?? []

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? refs.filter((m) => matches(m, q)).slice(0, 50) : refs.slice(0, 40)
  }, [refs, query])
  const active = shown.find((m) => m.id === picked) ?? shown[0] ?? null
  const title = active && name?.of === active.id ? name.text : (active?.name ?? '')
  const chosenFaction = faction === undefined ? (factions.find((f) => f.defaultStance === 'hostile')?.id ?? factions[0]?.id ?? null) : faction
  const target = map || uses[0]?.map || ''

  const create = async (m: CompendiumRef) => {
    setCreating(true)
    try {
      const { entry } = await engine('dnd.get', { kind: 'monster', id: m.id })
      const input = monsterToSheetInput({ monster: entry, customName: (m.id === active?.id ? title.trim() : '') || entry.name, factionId: chosenFaction })
      const sheet = await engine('sheets.save', input)
      await engine('worlds.addCharacter', { id: world.id, sheet: sheet.id, map: target || null })
      toast.success('Character Created', `${sheet.title} is a new character sheet in your Library and joined ${world.name}.`)
      onAdded(sheet.id)
      onClose()
    } catch (err) {
      failed('Could not create the character')(err)
    } finally {
      setCreating(false)
    }
  }

  const keys = listKeys(shown, active, (m) => setPicked(m.id), (m) => void create(m))

  return (
    <div className="grid min-h-[460px] grid-cols-1 gap-4 lg:grid-cols-12">
      <SearchListPanel query={query} onQuery={setQuery} placeholder="Search bestiary by name, type or CR" count={`${shown.length} creatures`} onKeyDown={keys} className="lg:col-span-5">
        {shown.map((m) => (
          <ListRow
            key={m.id}
            active={active?.id === m.id}
            onClick={() => setPicked(m.id)}
            onMenu={(e) => entryMenuAt(e, 'monster', m.id, m.name, [{ label: 'Create character from this', icon: <UserPlus />, onSelect: () => void create(m) }])}
            title={m.name}
            subtitle={[[fact(m, 'size'), fact(m, 'type')].filter(Boolean).join(' '), fact(m, 'hp') && `${fact(m, 'hp').split(' ')[0]} HP`, fact(m, 'ac') && `AC ${fact(m, 'ac')}`].filter(Boolean).join(' · ')}
            meta={fact(m, 'cr') ? `CR ${fact(m, 'cr')}` : undefined}
          />
        ))}
        {!shown.length && <EmptyState title="No match">Try another name, type or CR.</EmptyState>}
      </SearchListPanel>

      {active ? (
        <div className="flex flex-col justify-between gap-4 border border-line tone-panel-60 p-4 lg:col-span-7">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5 border border-line/60 tone-surface-60 p-3">
              <span className="truncate text-[14px] font-bold text-ink">{active.name}</span>
              <span className="truncate text-[11.5px] text-dim">{[fact(active, 'size'), fact(active, 'type'), fact(active, 'alignment')].filter(Boolean).join(', ')}</span>
            </div>

            <FactGrid>
              <Fact label="Challenge">{fact(active, 'cr') || 'Unset'}</Fact>
              <Fact label="Hit points">{fact(active, 'hp') || 'Unset'}</Fact>
              <Fact label="Armor class">{fact(active, 'ac') || 'Unset'}</Fact>
              <Fact label="Speed">{fact(active, 'speed') || 'Unset'}</Fact>
            </FactGrid>

            <AbilityScoreGrid stats={Object.fromEntries(DND_STATS.map((s) => [s, Number(active.facts?.[s]) || 10]))} />

            <FieldGrid>
              <Field label="Character name">
                <Input value={title} onChange={(e) => setName({ of: active.id, text: e.target.value })} placeholder={active.name} />
              </Field>
              <Field label="Faction" tip="Sets who they side with. Saved to the new sheet.">
                <FactionSelect value={chosenFaction} onChange={setFaction} />
              </Field>
              {uses.length > 0 && (
                <Field label="Map">
                  <WorldMapUseSelect uses={uses} value={target} onChange={setMap} />
                </Field>
              )}
            </FieldGrid>
          </div>

          <JoinFooter note="Becomes a new character sheet in your Library, not a world NPC." loud busy={creating} onCancel={onClose}>
            <Button size="sm" variant="primary" icon={<UserPlus className="h-3.5 w-3.5" />} onClick={() => void create(active)} disabled={creating}>
              {creating ? 'Creating…' : 'Create Character'}
            </Button>
          </JoinFooter>
        </div>
      ) : (
        <div className="flex items-center justify-center border border-line tone-panel-60 lg:col-span-7">
          <EmptyState title="No creatures">Add monsters to the compendium first.</EmptyState>
        </div>
      )}
    </div>
  )
}

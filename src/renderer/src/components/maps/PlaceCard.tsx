import { Plus, UserPlus } from 'lucide-react'
import { placePath, type PlaceVisitor } from '@shared/maps'
import { PLACE_TYPE, PLACE_TYPE_KEY, type WorldChanges, type WorldEntity } from '@shared/world'
import { ActionBar, Eyebrow, Popover, SaveState, openMenu, useDraft, type MenuItem } from '../ui'
import { Chip } from '../chat/References'
import { CopyLinkButton } from '../data/CopyLinkButton'
import { LinkTextarea } from '../data/LinkTextarea'
import { EntryPicker } from '../library/EntryPicker'
import { failed } from '../../lib/notify'
import { CharacterRow } from './CharacterRow'
import { PlayList } from '../play/PlayList'
import { placePlay } from '../play/playHolder'
import { useWorldPlayer } from '../play/useWorldPlayer'
import { Facts } from '../entries/EntryCard'
import { LinkFaceList } from '../entries/LinkFaces'
import { ChangedBy } from '../agents/ChangedBy'
import { engine } from '../../lib/ipc'
import { placeName } from './placeShapes'
import { characterItems, setWhere } from './placeActions'

interface Props {
  world: string
  placeKey: string
  places: Record<string, WorldEntity>
  changes: WorldChanges
  here: PlaceVisitor[]
  actions: MenuItem[]
  onSelect: (key: string) => void
}

const text = (v: unknown) => (typeof v === 'string' ? v : '')

export function PlaceCard({ world, placeKey, places, changes, here, actions, onSelect }: Props) {
  const place = places[placeKey] ?? {}
  const { draft, change, status, error } = useDraft({ Now: text(place.Now), Files: text(place.Files) }, (v) => engine('worlds.put', { id: world, type: PLACE_TYPE_KEY, key: placeKey, entity: v }))
  const path = placePath(places, placeKey)
  const regionKey = typeof place.Region === 'string' && place.Region ? place.Region : null
  const inside = Object.keys(places).filter((k) => places[k]?.Inside === placeKey)
  const extra = Object.entries(place).filter(([k, v]) => !(k in PLACE_TYPE.fields) && v !== '' && v !== null && !(Array.isArray(v) && !v.length))
  const now = changes.Now
  const player = useWorldPlayer(world)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {(regionKey || path.length > 1) && (
          <div className="flex flex-wrap items-center gap-1 font-ui text-[11px] text-dim">
            {regionKey && <Chip kind="world" refText={`${world}/region/${regionKey}`} />}
            {path.slice(0, -1).map((k, i) => (
              <span key={k} className="inline-flex items-center gap-1">
                {(regionKey || i > 0) && <span className="text-faint">›</span>}
                <Chip kind="world" refText={`${world}/place/${k}`} onOpen={() => onSelect(k)} />
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold caps-6 text-ink">{placeName(places, placeKey)}</span>
          <CopyLinkButton kind="world" id={`${world}/place/${placeKey}`} />
          <span className="flex-1" />
          <SaveState status={status} error={error} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Now</Eyebrow>
          <LinkTextarea rolls={false} rows={2} value={draft.Now} placeholder="What is happening here right now — type @ to link entries…" onValue={(Now) => change({ ...draft, Now })} />
          {now && <ChangedBy by={now.by} at={Date.parse(now.at)} />}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Eyebrow>Who is here</Eyebrow>
            <span className="flex-1" />
            <Popover trigger={<UserPlus className="h-3.5 w-3.5 text-accent" />} title="Put a character here">
              {(close) => <EntryPicker kind="sheet" title="Put a character here" inline onClose={close} onPick={(hit) => void setWhere(hit.id, placeKey, world).then(close, failed('Could not move them'))} />}
            </Popover>
          </div>
          {here.length ? here.map((v) => <CharacterRow key={v.sheet} visitor={v} onRemove={() => void setWhere(v.sheet, null, world).catch(failed('Could not remove them'))} onMenu={(e) => openMenu(e, v.name, characterItems(v, places, placeKey, world))} />) : <span className="text-[12px] text-faint">Nobody is stationed here.</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Eyebrow>Files &amp; Pages</Eyebrow>
            <span className="flex-1" />
            <Popover trigger={<Plus className="h-3.5 w-3.5 text-accent" />} title="Link page, sheet, or document">
              {(close) => (
                <EntryPicker
                  kind={null}
                  title="Link page, sheet, or document"
                  inline
                  onClose={close}
                  onPick={(hit) => {
                    const ref = `@${hit.kind}:${hit.id}`
                    const next = draft.Files ? `${draft.Files} ${ref}` : ref
                    change({ ...draft, Files: next })
                    close()
                  }}
                />
              )}
            </Popover>
          </div>
          <LinkTextarea rolls={false} rows={2} value={draft.Files} placeholder="@page:the_den @sheet:mara" onValue={(Files) => change({ ...draft, Files })} />
        </div>
        <LinkFaceList text={draft.Files} />
        <PlayList play={placePlay(world, placeKey, place, player, here.flatMap((v) => (v.agent ? [v.agent] : [])))} />
        {extra.length > 0 && <Facts rows={extra.map(([k, v]) => [k.replace(/_/g, ' '), Array.isArray(v) ? v.join(', ') : String(v)])} />}
        {inside.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Eyebrow>Inside</Eyebrow>
            <div className="flex flex-wrap gap-1.5">
              {inside.map((k) => (
                <Chip key={k} kind="world" refText={`${world}/place/${k}`} onOpen={() => onSelect(k)} />
              ))}
            </div>
          </div>
        )}
      </div>
      <ActionBar items={actions} className="shrink-0 border-t border-line/40 p-2.5" />
    </div>
  )
}

import { Aperture, ArrowUpRight, Copy, Download, Eye, ImagePlus, Link, PanelRight, Plus, Save, Sparkles, UserRound, X } from 'lucide-react'
import { showName } from '@shared/ids'
import { actorEntry, actorLink, splitNpcRef } from '@shared/worldNpcs'
import { Button, InlineTitle, SaveState, openMenu, type MenuItem, type SaveStatus } from '../../ui'
import { AssetMedia } from '../../pictures/AssetMedia'
import { showInPanel } from '../showInPanel'
import { engine } from '../../../lib/ipc'
import { openEntry } from '../../../lib/library'
import { copyText, failed } from '../../../lib/notify'
import { toast } from '../../../store/toasts'
import { Whereabouts } from '../../worlds/Whereabouts'
import { useWhereabouts } from '../../worlds/useWhereabouts'

export function SheetHeader({
  id,
  title,
  image,
  fields,
  wornBy,
  status,
  error,
  previewing,
  onRename,
  onPortrait,
  onClearPortrait,
  onGeneratePortrait,
  onAddField,
  onPreview
}: {
  id: string
  title: string
  image: string | null
  fields: number
  wornBy: string[]
  status: SaveStatus
  error: string | null
  previewing: boolean
  onRename: (title: string) => void
  onPortrait: () => void
  onClearPortrait?: () => void
  onGeneratePortrait?: () => void
  onAddField: () => void
  onPreview: () => void
}) {
  const link = actorLink(id)
  const entry = actorEntry(id)
  const npcRef = splitNpcRef(id)
  const isWorldNpc = npcRef !== null
  const here = useWhereabouts(id)

  const lifecycleItems: MenuItem[] = npcRef
    ? [
        {
          label: 'Write Save State to World Template',
          icon: <Save />,
          onSelect: () =>
            void engine('npcs.writeToTemplate', { world: npcRef.world, id: npcRef.id, asArchetype: false })
              .then(() =>
                toast.success(
                  'Saved to World Template',
                  `${showName(title)}'s current state was written to the world baseline.`
                )
              )
              .catch(failed('Could not write to world template'))
        },
        {
          label: 'Promote to Standalone Character (Move)',
          icon: <ArrowUpRight />,
          onSelect: () =>
            void engine('npcs.promoteToSheet', { world: npcRef.world, id: npcRef.id })
              .then((sheet) => {
                toast.success(
                  'Promoted to Character',
                  `${showName(sheet.title)} moved to your Characters library.`,
                  { label: 'Open Character', onSelect: () => openEntry('sheet', sheet.id) }
                )
                openEntry('sheet', sheet.id)
              })
              .catch(failed('Could not promote NPC to character'))
        },
        {
          label: 'Save Independent Copy to Characters',
          icon: <Copy />,
          onSelect: () =>
            void engine('npcs.copyToSheet', { world: npcRef.world, id: npcRef.id, layer: 'play' })
              .then((sheet) =>
                toast.success(
                  'Saved Copy to Characters',
                  `${showName(sheet.title)} was copied to your Characters library.`,
                  { label: 'Open Copy', onSelect: () => openEntry('sheet', sheet.id) }
                )
              )
              .catch(failed('Could not copy NPC to character'))
        }
      ]
    : here
      ? [
          {
            label: `Copy into ${here.worldName} as Unique World NPC`,
            icon: <Download />,
            onSelect: () =>
              void engine('npcs.copyFromSheet', {
                world: here.world,
                sheet: id,
                archetype: false,
                place: here.place ?? null,
                map: here.map ?? null
              })
                .then((npc) =>
                  toast.success(
                    'Copied into World',
                    `${showName(npc.title)} now has an independent World NPC copy in ${here.worldName}.`,
                    { label: 'Open NPC', onSelect: () => openEntry('world', `${here.world}/npc/${npc.id}`) }
                  )
                )
                .catch(failed('Could not copy into world'))
          },
          {
            label: `Copy into ${here.worldName} as World Archetype`,
            icon: <Sparkles />,
            onSelect: () =>
              void engine('npcs.copyFromSheet', {
                world: here.world,
                sheet: id,
                archetype: true
              })
                .then((npc) =>
                  toast.success(
                    'Saved as World Archetype',
                    `${showName(npc.title)} is now a reusable Archetype in ${here.worldName}.`,
                    { label: 'Open Archetype', onSelect: () => openEntry('world', `${here.world}/npc/${npc.id}`) }
                  )
                )
                .catch(failed('Could not save as archetype'))
          }
        ]
      : []

  return (
    <div className="flex flex-wrap items-start gap-5 border-b border-line/50 bg-gradient-to-b from-accent/[0.06] to-transparent p-5">
      <div className="group/portrait relative h-40 w-40 shrink-0 overflow-hidden border border-line-strong tone-panel-60">
        <button title={image ? 'Change portrait' : 'Add a portrait'} onClick={onPortrait} className="h-full w-full cursor-pointer">
          {image ? (
            <AssetMedia id={image} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-faint group-hover/portrait:text-accent">
              <UserRound className="h-12 w-12" />
              <span className="font-label text-[10px] caps-16 ">Add portrait</span>
            </span>
          )}
          {image && (
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 tone-panel-70 py-1 font-label text-[10px] caps-5 text-accent opacity-0 group-hover/portrait:opacity-100">
              <ImagePlus className="h-3 w-3" /> Change
            </span>
          )}
        </button>
        {image && onClearPortrait && (
          <button
            type="button"
            title="Clear portrait"
            onClick={(e) => {
              e.stopPropagation()
              onClearPortrait()
            }}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center border border-line/60 tone-well-80 text-dim hover:border-alert hover:text-alert cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="font-label text-[10.5px] caps-20 text-accent-soft">{isWorldNpc ? 'World NPC' : 'Character'}</span>
        <InlineTitle value={title} onSave={onRename} className="text-[30px] font-bold leading-tight tracking-wide" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-dim">
          <span>{fields} fields</span>
          <span>{wornBy.length ? `Worn by ${wornBy.join(', ')}` : isWorldNpc ? 'Bound to world' : 'No agent wears it yet (pick it under Character in an agent)'}</span>
          <SaveState status={status} error={error} />
        </div>
        <Whereabouts sheet={id} className="max-w-xl" />
        <div className="mt-1 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" icon={<Plus />} onClick={onAddField}>
            Add field
          </Button>
          {onGeneratePortrait && (
            <Button size="sm" variant="secondary" icon={<Aperture />} onClick={onGeneratePortrait}>
              Generate portrait
            </Button>
          )}
          {image && onClearPortrait && (
            <Button size="sm" variant="ghost" icon={<X />} onClick={onClearPortrait}>
              Clear portrait
            </Button>
          )}
          {lifecycleItems.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              icon={<ArrowUpRight />}
              onClick={(e) => openMenu(e, showName(title), lifecycleItems)}
            >
              {isWorldNpc ? 'World / Character…' : 'Copy into World…'}
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={<Eye />} onClick={onPreview}>
            {previewing ? 'Back to the sheet' : 'As an agent reads it'}
          </Button>
          <Button size="sm" variant="ghost" icon={<Link />} onClick={() => void copyText(link, 'Link copied', link)}>
            Copy link
          </Button>
          <Button size="sm" variant="ghost" icon={<PanelRight />} onClick={() => void showInPanel(`${entry.kind}/${entry.id}`)}>
            Show in chat panel
          </Button>
        </div>
      </div>
    </div>
  )
}

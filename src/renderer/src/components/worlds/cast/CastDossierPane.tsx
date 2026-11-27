import type { MouseEvent, PointerEvent } from 'react'
import { ArrowLeft, ExternalLink, Maximize2, Minimize2, MoreHorizontal, X } from 'lucide-react'
import { showName } from '@shared/ids'
import { Button, openMenu } from '../../ui'
import { Chip } from '../../chat/References'
import { CopyLinkButton } from '../../data/CopyLinkButton'
import { SheetEditor } from '../../data/sheet/SheetEditor'
import { Whereabouts } from '../Whereabouts'
import { engine } from '../../../lib/ipc'
import { openEntry } from '../../../lib/library'
import { failed } from '../../../lib/notify'
import { useLive } from '../../../lib/useLive'
import { toast } from '../../../store/toasts'
import { entryMenuAt } from '../../../views/data/entryMenu'
import { CAST_ROLE_LABELS, type CastMember } from './castTypes'
import { castMemberExtraMenuItems, type CastActionCallbacks } from './castActions'

export function CastDossierPane({
  member,
  actionsCtx,
  almanacId,
  fullWidth = false,
  width,
  expanded,
  onToggleExpand,
  onResizeStart,
  onBack,
  onClose
}: {
  member: CastMember
  actionsCtx: CastActionCallbacks
  almanacId: string | null
  fullWidth?: boolean
  width: number
  expanded: boolean
  onToggleExpand: () => void
  onResizeStart: (e: PointerEvent) => void
  onBack?: () => void
  onClose: () => void
}) {
  const sheet = useLive(
    () => engine('sheets.get', { id: member.actorId }),
    ['page.changed', 'npcs.changed', 'saves.changed', 'stories.changed'],
    [member.actorId]
  )

  const inParty = actionsCtx.partyIds.includes(member.actorId)
  const extraItems = castMemberExtraMenuItems(member, actionsCtx)

  const handleHeaderMenu = (e: MouseEvent) => {
    entryMenuAt(e, member.entry.kind, member.entry.id, member.title, extraItems)
  }

  const layerNotice = member.archetype
    ? 'Archetype Template · :roll and #random bake per individual when stamped'
    : !member.isWorldNpc
      ? 'Standalone Character · Linked from Characters library'
      : !member.hasTemplate
        ? `In Active Save${member.sourceTemplateId ? ` · Stamped from ${member.sourceTemplateId}` : ''}`
        : member.hasOverrides
          ? 'World NPC · Live playthrough changes in Save'
          : 'World NPC · Synced with World Baseline'

  return (
    <div
      style={fullWidth ? undefined : { width: `${width}px` }}
      className={
        fullWidth
          ? 'flex min-h-0 flex-1 flex-col bg-bg font-ui'
          : 'relative z-20 flex min-h-0 shrink-0 flex-col border-l border-line/60 tone-panel-95 font-ui shadow-panel backdrop-blur-[var(--panel-blur)]'
      }
    >
      {!fullWidth && (
        <div
          onPointerDown={onResizeStart}
          onDoubleClick={onToggleExpand}
          title="Drag edge to resize (360px–980px) · Double-click to toggle width"
          className="group absolute inset-y-0 -left-1.5 z-30 flex w-3 cursor-ew-resize items-center justify-center hover:bg-secondary-ink/30"
        >
          <div className="h-8 w-0.5 bg-line/60 group-hover:bg-secondary-ink" />
        </div>
      )}

      {/* DOSSIER TOP BAR */}
      <div
        onContextMenu={handleHeaderMenu}
        className="flex shrink-0 items-center justify-between gap-2 border-b border-line/60 tone-sidebar-80 px-3 py-2"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onBack && (
            <Button size="sm" variant="ghost" icon={<ArrowLeft />} onClick={onBack} title="Back to Cast">
              Cast
            </Button>
          )}
          <span className="font-label text-[9.5px] font-bold caps-8 text-accent">
            {CAST_ROLE_LABELS[member.roleKind]}
          </span>
          <span className="truncate text-[14px] font-bold text-ink">{showName(member.title)}</span>
          <Chip kind={member.entry.kind} refText={member.entry.id} />
          <CopyLinkButton kind={member.entry.kind} id={member.entry.id} />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            icon={<ExternalLink />}
            title="Open standalone view"
            onClick={() => openEntry(member.entry.kind, member.entry.id)}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={<MoreHorizontal />}
            title="Lifecycle & conversion actions"
            onClick={(e) => openMenu(e, showName(member.title), extraItems)}
          />
          {!fullWidth && (
            <Button
              size="sm"
              variant="ghost"
              icon={expanded ? <Minimize2 /> : <Maximize2 />}
              title={expanded ? 'Compact width' : 'Expand width'}
              onClick={onToggleExpand}
            />
          )}
          {!fullWidth && <Button size="sm" variant="ghost" icon={<X />} title="Close dossier" onClick={onClose} />}
        </div>
      </div>

      {/* STAGE BAR */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-line/50 tone-surface-50 px-3 py-2 text-[11.5px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-dim">{layerNotice}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {!member.archetype && member.roleKind !== 'player' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void engine('worlds.setPlayer', { id: actionsCtx.worldId, sheet: member.actorId })
                    .then(() =>
                      toast.success('Protagonist Set', `${showName(member.title)} is now your active character.`)
                    )
                    .catch(failed('Could not set active character'))
                }
              >
                Play As
              </Button>
            )}

            {!member.archetype && actionsCtx.saveId && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void (inParty
                    ? engine('saves.takeOut', { sheet: member.actorId })
                    : engine('saves.bring', { id: actionsCtx.saveId!, sheet: member.actorId })
                  ).catch(failed('Could not update party'))
                }
              >
                {inParty ? 'Leave Party' : 'Join Party'}
              </Button>
            )}

            {member.isWorldNpc && member.npcId && member.archetype && actionsCtx.onOpenStamp && (
              <Button size="sm" variant="primary" onClick={() => actionsCtx.onOpenStamp?.(member)}>
                Stamp ×N…
              </Button>
            )}

            {member.isWorldNpc && member.npcId && member.hasOverrides && (
              <Button
                size="sm"
                variant="secondary"
                title={
                  member.hasTemplate
                    ? 'Copy live save state back to the authored World Template'
                    : 'Save this stamped individual as a permanent Unique NPC in the World Template'
                }
                onClick={() =>
                  void engine('npcs.writeToTemplate', {
                    world: actionsCtx.worldId,
                    id: member.npcId!,
                    asArchetype: false
                  })
                    .then(() =>
                      toast.success(
                        'Written to World Template',
                        `${showName(member.title)}'s current state is saved to ${actionsCtx.worldName}.`
                      )
                    )
                    .catch(failed('Could not write to world template'))
                }
              >
                {member.hasTemplate ? 'Write to World' : 'Keep in World'}
              </Button>
            )}

            {member.isWorldNpc && member.npcId && member.hasOverrides && member.hasTemplate && (
              <Button
                size="sm"
                variant="ghost"
                title="Discard save-layer overrides and restore the World Template baseline"
                onClick={() =>
                  void engine('npcs.resetInSave', { world: actionsCtx.worldId, id: member.npcId! })
                    .then(() => toast.info('Reverted', `${showName(member.title)} restored to world baseline.`))
                    .catch(failed('Could not revert overrides'))
                }
              >
                Revert
              </Button>
            )}
          </div>
        </div>

        {!member.archetype && <Whereabouts sheet={member.actorId} />}
      </div>

      {/* FULL 6-TAB CHARACTER SHEET EDITOR */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        {!sheet ? (
          <div className="p-6 text-center text-[12px] text-dim">Loading character sheet…</div>
        ) : (
          <SheetEditor key={sheet.id} start={sheet} compact campaign={almanacId} />
        )}
      </div>
    </div>
  )
}

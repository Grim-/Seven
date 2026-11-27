import type { MouseEvent } from 'react'
import { getFactionStance, STANCE_BADGE, type StoredFaction } from '@shared/game/factions'
import { showName } from '@shared/ids'
import { Button } from '../../ui'
import { Chip, withReferences } from '../../chat/References'
import { SheetPortrait } from '../../data/SheetPortrait'
import { entryMenuAt } from '../../../views/data/entryMenu'
import { cn } from '../../../lib/cn'
import { CAST_ROLE_LABELS, type CastMember, type CastRoleKind } from './castTypes'
import { castMemberExtraMenuItems, type CastActionCallbacks } from './castActions'

const ROLE_BADGE_CLASS: Record<CastRoleKind, string> = {
  player: 'border-accent bg-accent/15 text-accent',
  party: 'border-ok/60 bg-ok/15 text-ok',
  'world-npc': 'border-secondary/60 tone-well-60 text-secondary-ink',
  character: 'border-line-strong tone-well-60 text-ink',
  stamped: 'border-warn/50 bg-warn/10 text-warn',
  archetype: 'border-accent-soft/60 tone-well-60 text-accent-soft'
}

export function CastMemberCard({
  member,
  active,
  picked,
  factions,
  playerFactionId,
  actionsCtx,
  onClick
}: {
  member: CastMember
  active: boolean
  picked: boolean
  factions: StoredFaction[]
  playerFactionId: string
  actionsCtx: CastActionCallbacks
  onClick: (e: MouseEvent) => void
}) {
  const factionObj = member.faction ? factions.find((f) => f.id === member.faction) ?? null : null
  const targetFactionId =
    member.faction || (member.roleKind === 'player' || member.roleKind === 'party' ? 'player_party' : '')
  const stance = targetFactionId ? getFactionStance(factions, playerFactionId, targetFactionId) : null
  const stanceBadge = stance && member.roleKind !== 'player' ? STANCE_BADGE[stance] : null
  const hpPct =
    member.hp && member.hp.max > 0 ? Math.max(0, Math.min(100, (member.hp.cur / member.hp.max) * 100)) : null
  const narrativeBeat = member.doing || (member.goal ? `Goal: ${member.goal}` : '') || member.line

  const openCardMenu = (e: MouseEvent) => {
    const extras = castMemberExtraMenuItems(member, actionsCtx)
    entryMenuAt(e, member.entry.kind, member.entry.id, member.title, extras)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-on={active || picked ? '' : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(e as unknown as MouseEvent)
        }
      }}
      onContextMenu={openCardMenu}
      className={cn(
        'group relative flex min-w-0 flex-col gap-2 border p-3 text-left transition-colors cursor-pointer',
        active
          ? 'border-accent tone-card-80 shadow-glow'
          : picked
            ? 'border-secondary tone-card-70'
            : 'border-line/50 tone-card-40 hover:border-line-hover hover:tone-card-70'
      )}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <SheetPortrait
          image={member.image}
          className={cn(
            'h-12 w-12 shrink-0 border',
            member.roleKind === 'player' ? 'border-accent' : 'border-line/60'
          )}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-1.5">
            <span className="truncate font-ui text-[13.5px] font-bold text-ink" title={showName(member.title)}>
              {withReferences(showName(member.title))}
            </span>
            <span
              className={cn(
                'shrink-0 border px-1.5 py-px font-label text-[9px] font-bold caps-5',
                ROLE_BADGE_CLASS[member.roleKind]
              )}
            >
              {CAST_ROLE_LABELS[member.roleKind]}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            {factionObj && (
              <span onClick={(e) => e.stopPropagation()}>
                <Chip kind="world" refText={`${actionsCtx.worldId}/faction/${factionObj.id}`} />
              </span>
            )}
            {stanceBadge && !member.archetype && (
              <span className={cn('border px-1 py-px font-bold caps', stanceBadge.cls)}>
                {stanceBadge.label}
              </span>
            )}
            {member.mood && (
              <span className="border border-line/50 tone-well-50 px-1.5 py-px text-secondary-ink">
                {withReferences(member.mood)}
              </span>
            )}
            {member.hasOverrides && member.hasTemplate && (
              <span
                className="border border-accent/40 bg-accent/10 px-1 py-px font-label text-[8.5px] caps text-accent"
                title="Has playthrough changes in the active save"
              >
                Live Save
              </span>
            )}
          </div>
        </div>
      </div>

      {narrativeBeat ? (
        <div className="line-clamp-2 font-body text-[12px] leading-snug text-dim">
          {withReferences(narrativeBeat)}
        </div>
      ) : (
        <div className="font-ui text-[11px] text-faint">
          {member.archetype ? 'Reusable world archetype' : 'No active scene note yet'}
        </div>
      )}

      {(member.hp || member.statPills.length > 0 || member.archetype) && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-line/30 pt-2">
          <div className="flex flex-wrap items-center gap-1">
            {member.hp && (
              <div className="flex items-center gap-1.5 border border-line/50 tone-well-60 px-1.5 py-0.5 font-data text-[10px] text-ink">
                <span className="text-dim">HP</span>
                <span>
                  {member.hp.cur}/{member.hp.max}
                </span>
                {hpPct !== null && (
                  <span className="h-1.5 w-8 overflow-hidden border border-line/40 tone-panel-60">
                    <span
                      className={cn('block h-full', hpPct <= 30 ? 'bg-alert' : 'bg-ok')}
                      style={{ width: `${hpPct}%` }}
                    />
                  </span>
                )}
              </div>
            )}
            {member.statPills.slice(0, 3).map((st) => (
              <span
                key={st.id}
                title={st.label}
                className={cn(
                  'border px-1.5 py-0.5 font-data text-[10px]',
                  st.modified
                    ? 'border-secondary/60 tone-well-60 text-secondary-ink'
                    : 'border-line/40 tone-well-40 text-dim'
                )}
              >
                {st.label} {st.value}
              </span>
            ))}
          </div>

          {member.archetype && actionsCtx.onOpenStamp && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation()
                actionsCtx.onOpenStamp?.(member)
              }}
              className="h-6 px-2 text-[10.5px]"
              title="Stamp 1..N individuals from this archetype into the save"
            >
              Stamp
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

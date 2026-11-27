import { Plus } from 'lucide-react'
import { useCompactLayout } from '../../../lib/form'
import { useViewPlace } from '../../../lib/viewPlace'
import { ActionBar, Button, EmptyState, Gutter, ListPane, ListToggle, MainPane, MakeOrSaved, Panel, SidePane, Split } from '../../ui'
import { AvatarInspector } from './AvatarInspector'
import { AvatarList } from './AvatarList'
import { AvatarStage } from './AvatarStage'
import { PoseRail } from './PoseRail'
import { avatarActions } from './avatarActions'
import { BASE_POSE, type PoseActions } from './poses'
import { useAvatarDraft } from './useAvatarDraft'
import { usePoseLook } from './usePoseLook'
import { useStagePreview } from './useStagePreview'
import { TreatmentStackEditor } from './treatments/TreatmentStackEditor'

export { NEW_AVATAR } from './useAvatarDraft'

const LIST = { id: 'avatar-list', width: 220, min: 180, max: 420 }
const INSPECTOR = { id: 'avatar-inspector', width: 380, min: 300, max: 960 }

export function AvatarsPanel({ initial = null }: { initial?: string | null }) {
  const studio = useAvatarDraft(initial)
  const look = usePoseLook(studio.draft, studio.set)
  const target = studio.preview ? `studio-avatar:${studio.preview.id}` : null
  const preview = useStagePreview(target, look.editing)
  const compact = useCompactLayout()
  const [listOpen, setListOpen] = useViewPlace('avatarStudio.listOpen', true)
  const [listWidth, setListWidth] = useViewPlace('avatarStudio.listWidth', LIST.width)
  const [inspectorWidth, setInspectorWidth] = useViewPlace('avatarStudio.inspectorWidth', INSPECTOR.width)

  const pick = (key: string) => {
    look.edit(key)
    preview.show(key)
  }
  const create = () => {
    studio.create()
    pick(BASE_POSE)
  }
  const actions: PoseActions = { marked: look.marked, onPick: pick, onClear: look.clear, readOnly: studio.readOnly }
  const { draft, preview: avatar } = studio

  const inspector = draft && (
    <AvatarInspector
      look={look}
      renderer={draft.renderer}
      readOnly={studio.readOnly}
      onRenderer={studio.switchRenderer}
      extraTabs={
        avatar
          ? [
              {
                value: 'signal',
                label: 'Signal',
                body: () => <TreatmentStackEditor avatar={avatar} entries={draft.treatments ?? []} onChange={(treatments) => studio.set({ treatments })} editing={look.editing} readOnly={studio.readOnly} />
              }
            ]
          : []
      }
      footer={
        <>
          <MakeOrSaved made={!studio.isNew} saver={studio.editor} what="avatar" onMake={studio.make} disabled={!draft.name.trim()} />
          {studio.avatar && <ActionBar row items={avatarActions(studio, studio.avatar)} className="ml-auto" />}
        </>
      }
    />
  )

  return (
    <Panel
      className="min-w-0 flex-1"
      title="Avatars"
      meta={`${studio.list.length}`}
      actions={
        <Button size="sm" variant="badge" icon={<Plus />} onClick={create}>
          New avatar
        </Button>
      }
      bodyClassName="flex min-h-0 p-0"
    >
      <Split className="w-full">
        <ListPane id={LIST.id} open={listOpen} width={listWidth} min={LIST.min} max={LIST.max} reset={LIST.width} onWidth={setListWidth} onClose={() => setListOpen(false)}>
          <AvatarList studio={studio} onNew={create} onPicked={() => compact && setListOpen(false)} />
        </ListPane>
        <MainPane id="avatar-stage">
          <div className="flex min-h-0 flex-1">
            <ListToggle open={listOpen} onToggle={() => setListOpen(!listOpen)} what="the avatars" />
            {draft && avatar && target ? (
              <>
                <PoseRail avatar={avatar} editing={look.editing} actions={actions} className="w-36 shrink-0 border-r border-line/40 phone:w-auto" />
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  <AvatarStage avatar={avatar} saved={studio.avatar} draft={draft} readOnly={studio.readOnly} set={studio.set} preview={preview} target={target} editing={look.editing} actions={actions} />
                  {compact && <div className="min-h-0 flex-1 border-t border-line/40">{inspector}</div>}
                </div>
              </>
            ) : (
              <EmptyState title="No avatar selected">Pick one from the list, or make a new one.</EmptyState>
            )}
          </div>
        </MainPane>
        {!compact && inspector && (
          <>
            <Gutter resets={INSPECTOR.id} />
            <SidePane id={INSPECTOR.id} width={inspectorWidth} min={INSPECTOR.min} max={INSPECTOR.max} reset={INSPECTOR.width} onWidth={setInspectorWidth} className="border-l border-line/40">
              {inspector}
            </SidePane>
          </>
        )}
      </Split>
    </Panel>
  )
}

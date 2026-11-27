import type { KnowledgeScope, WorldKnowledge } from '@shared/worldKnowledge'
import { Field, Input, Segmented, TagInput, Toggle } from '../ui'
import { MarkdownEditor } from '../data/MarkdownEditor'
import { LinkFaceList } from '../entries/LinkFaces'
import { PictureField } from '../pictures/PictureField'

const SCOPES: { value: KnowledgeScope; label: string }[] = [
  { value: 'global', label: 'Global' },
  { value: 'local', label: 'Local' }
]

type Cue = 'world' | 'always' | 'never'

const CUES: { value: Cue; label: string }[] = [
  { value: 'world', label: 'As the world' },
  { value: 'always', label: 'Always' },
  { value: 'never', label: 'Never' }
]

export function KnowledgeEditor({ value, onChange }: { value: WorldKnowledge; onChange: (next: WorldKnowledge) => void }) {
  return (
    <div className="flex flex-col gap-4 font-ui">
      <Field label="Name">
        <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="e.g. The Veil" />
      </Field>
      <Field label="Who knows it" hint={value.scope === 'global' ? 'Every character in this world.' : 'Only the characters given it.'}>
        <Segmented value={value.scope} options={SCOPES} onChange={(scope) => onChange({ ...value, scope })} />
      </Field>
      <Field label="What is true" hint="Written to stand on its own. Link places, people and pages with @.">
        <div className="flex flex-col gap-1.5">
          <MarkdownEditor compact rolls={false} value={value.text} onValue={(text) => onChange({ ...value, text })} />
          <LinkFaceList text={value.text} />
        </div>
      </Field>
      <Field label="Tags" hint="Topic keywords that bring it to mind.">
        <TagInput value={value.tags} onChange={(tags) => onChange({ ...value, tags })} />
      </Field>
      <Field label="Bring to mind on cues" hint="When its tags or words come up, those who know it are reminded. As the world follows the world's setting.">
        <Segmented
          value={value.cue === undefined ? 'world' : value.cue ? 'always' : 'never'}
          options={CUES}
          onChange={(c) => onChange({ ...value, cue: c === 'world' ? undefined : c === 'always' })}
        />
      </Field>
      <Toggle checked={value.pinned === true} onChange={(pinned) => onChange({ ...value, pinned: pinned || undefined })} label="Front of mind (always in context for those who know it)" />
      <Field label="Picture">
        <PictureField value={value.image} onChange={(image) => onChange({ ...value, image })} options={{ what: 'a picture for this knowledge' }} />
      </Field>
    </div>
  )
}

import { blankKnowledge, knowledgeRef, splitKnowledgeRef, type WorldKnowledge } from '@shared/worldKnowledge'
import { engine } from '../../lib/ipc'
import type { KindScreenProps } from '../../registries/kinds'
import { StoredScreen } from '../decisions/StoredScreen'
import { KnowledgeEditor } from './KnowledgeEditor'

async function getHeld(ref: string): Promise<WorldKnowledge | null> {
  const parts = splitKnowledgeRef(ref)
  const got = parts ? await engine('knowledge.get', { ref }) : null
  return parts && got ? { ...got, id: knowledgeRef(parts.world, got.id) } : null
}

async function saveHeld(value: WorldKnowledge, previous: string | null): Promise<WorldKnowledge> {
  const parts = splitKnowledgeRef(previous ?? value.id)
  if (!parts) throw new Error('This knowledge has no world.')
  const saved = await engine('knowledge.save', { world: parts.world, entry: { ...value, id: parts.id }, previousId: parts.id })
  return { ...saved, id: knowledgeRef(parts.world, saved.id) }
}

export function KnowledgeScreen(props: KindScreenProps) {
  return (
    <StoredScreen<WorldKnowledge>
      {...props}
      what="knowledge"
      event="knowledge.changed"
      get={getHeld}
      save={saveHeld}
      blank={blankKnowledge}
      badge={(k) => k.scope}
      adds={false}
      Editor={KnowledgeEditor}
    />
  )
}

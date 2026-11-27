export const PRESENT_PREFIX = 'present_'

const PRESENTATION_NAMES: Record<string, string> = { choices: 'ask_user', document: 'working_document', suggest: 'suggest', timer: 'timer', aside: 'aside', handout: 'handout', action: 'action_check' }

export const RENAMED_TOOLS: Record<string, string> = {
  present_choices: 'ask_user',
  present_document: 'working_document',
  notify: 'notify_user',
  gather: 'gather_from_user',
  page_write: 'add_page',
  page_update: 'update_page',
  workout_log: 'log_exercise',
  exercise_write: 'add_exercise',
  remember: 'agent_remember',
  recall: 'agent_recall',
  story_recall: 'character_search_knowledge',
  add_character_memory: 'character_learn_memory',
  add_story_log: 'character_learn_event',
  set_story_where: 'character_set_state',
  set_character_relationship: 'character_set_relation'
}

export function currentToolName(name: string): string {
  return RENAMED_TOOLS[name] ?? name
}

export function presentationToolName(type: string): string {
  return PRESENTATION_NAMES[type] ?? `${PRESENT_PREFIX}${type}`
}

export function presentationTypeOf(name: string): string | null {
  const named = Object.entries(PRESENTATION_NAMES).find(([, n]) => n === name)
  if (named) return named[0]
  return name.startsWith(PRESENT_PREFIX) ? name.slice(PRESENT_PREFIX.length) : null
}

export const CORE_MODULES = ['core', 'mind']

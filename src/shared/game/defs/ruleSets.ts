export interface RuleSet {
  id: string
  name: string
  notes: string
}

export const RULE_SET_KIND = 'game_rules'

export function defRef(ruleSet: string, id: string): string {
  return `${ruleSet}/${id}`
}

export function splitDefRef(ref: string): { ruleSet: string | null; id: string } {
  const at = ref.indexOf('/')
  return at < 0 ? { ruleSet: null, id: ref } : { ruleSet: ref.slice(0, at), id: ref.slice(at + 1) }
}

export function ruleSetFor(wanted: string | null | undefined, sets: RuleSet[]): string {
  return wanted && sets.some((s) => s.id === wanted) ? wanted : (sets[0]?.id ?? '')
}

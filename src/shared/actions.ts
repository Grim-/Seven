import { showName, toId } from './ids'
import { NO_SWAP, cleanSwap, hasSwap, parseSwap, swapSentence, swapText, type CardSwap } from './cardDecks'
import { DND_SKILLS, DND_STATS, DND_STAT_NAMES, mod, saveBonus, skillBonus, spellAttack, type DndStats } from './dnd'
import type { RollerChoice } from './storedDecision'

export type ActionNeeds = 'any' | 'all'

export interface ActionCheck {
  against: string | null
  difficulty: number | null
  base: number | null
  pass: string | null
  fail: string | null
  passCards: CardSwap
  failCards: CardSwap
  passAction?: string | null
  failAction?: string | null
}

export interface Action {
  attempt: string
  needs: ActionNeeds
  by: string | null
  roller?: RollerChoice
  checks: ActionCheck[]
  pass: string
  fail: string
  passCards: CardSwap
  failCards: CardSwap
  passAction?: string | null
  failAction?: string | null
}

export interface CheckTarget {
  id: string
  label: string
  bonus: number
}

export interface CheckRoll {
  label: string
  bonus: number
  roll: number
  total: number
  target: number
  chance: number
  passed: boolean
}

export interface ActionResult {
  attempt: string
  needs: ActionNeeds
  character: { sheet: string; name: string; image: string | null } | null
  rolls: CheckRoll[]
  passed: boolean
  deciding: string | null
  outcome: string
  cards: CardSwap
  triggerAction: string | null
}

export const BASE = 10
export const MIDDLE = 0.5
export const CHANCE = 'chance'
export const NEEDS_LABEL: Record<ActionNeeds, string> = { any: 'one check, picked', all: 'every check passes' }

const CHECKS: { id: string; label: string; bonus: (d: DndStats) => number | null }[] = [
  ...DND_STATS.map((s) => ({ id: toId(DND_STAT_NAMES[s]), label: DND_STAT_NAMES[s], bonus: (d: DndStats) => mod(d.stats[s]) })),
  ...DND_STATS.map((s) => ({ id: `${toId(DND_STAT_NAMES[s])}_save`, label: `${DND_STAT_NAMES[s]} save`, bonus: (d: DndStats) => saveBonus(d, s) })),
  ...DND_SKILLS.map((s) => ({ id: toId(s.name), label: s.name, bonus: (d: DndStats) => skillBonus(d, s.id) })),
  { id: 'spell_attack', label: 'Spell attack', bonus: spellAttack }
]

export function checkNames(): { id: string; label: string }[] {
  return CHECKS.map(({ id, label }) => ({ id, label }))
}

export function checkTargets(d: DndStats | null): CheckTarget[] {
  if (!d) return []
  return CHECKS.flatMap((c) => {
    const bonus = c.bonus(d)
    return bonus === null ? [] : [{ id: c.id, label: c.label, bonus }]
  })
}

export function findTarget(targets: CheckTarget[], against: string | null): CheckTarget | null {
  if (!against || toId(against) === CHANCE) return null
  const key = toId(against)
  return targets.find((t) => t.id === key || toId(t.label) === key || t.id.startsWith(key)) ?? null
}

export function targetOf(check: Pick<ActionCheck, 'difficulty' | 'base'>): number {
  const difficulty = Math.min(1, Math.max(0, check.difficulty ?? MIDDLE))
  return (check.base ?? BASE) + 1 + Math.round(20 * (difficulty - MIDDLE))
}

export function chanceOf(bonus: number, target: number): number {
  return Math.min(1, Math.max(0, (21 - (target - bonus)) / 20))
}

const d20 = () => 1 + Math.floor(Math.random() * 20)
export const BLANK_CHECK: ActionCheck = { against: null, difficulty: null, base: null, pass: null, fail: null, passCards: NO_SWAP, failCards: NO_SWAP, passAction: null, failAction: null }

export function picksCheck(action: Action): boolean {
  return action.needs === 'any' && action.checks.length > 1
}

export function rollAction(action: Action, d: DndStats | null, character: ActionResult['character'], pick: number | null = null, die: () => number = d20): ActionResult {
  const targets = checkTargets(d)
  const all = action.checks.length ? action.checks : [BLANK_CHECK]
  const checks = picksCheck(action) ? [all[Math.min(Math.max(0, pick ?? 0), all.length - 1)]] : all
  const rolls = checks.map((c) => {
    const found = findTarget(targets, c.against)
    const bonus = found?.bonus ?? 0
    const target = targetOf(c)
    const roll = die()
    return { label: found?.label ?? 'Chance', bonus, roll, total: roll + bonus, target, chance: chanceOf(bonus, target), passed: roll + bonus >= target }
  })
  const firstPass = rolls.findIndex((r) => r.passed)
  const firstFail = rolls.findIndex((r) => !r.passed)
  const passed = action.needs === 'all' ? firstFail === -1 : firstPass !== -1
  const deciding = action.needs === 'all' ? (passed ? null : firstFail) : passed ? firstPass : null
  const own = deciding === null ? null : passed ? checks[deciding].pass : checks[deciding].fail
  const ownCards = deciding === null ? null : passed ? checks[deciding].passCards : checks[deciding].failCards
  const cards = ownCards && hasSwap(ownCards) ? ownCards : passed ? action.passCards : action.failCards
  const ownAction = deciding === null ? null : passed ? checks[deciding].passAction : checks[deciding].failAction
  const triggerAction = (ownAction ?? (passed ? action.passAction : action.failAction)) ?? null
  return { attempt: action.attempt, needs: action.needs, character, rolls, passed, deciding: deciding === null ? null : rolls[deciding].label, outcome: own || (passed ? action.pass : action.fail), cards, triggerAction }
}

const signedSum = (r: CheckRoll) => `${r.roll} ${r.bonus < 0 ? '-' : '+'} ${Math.abs(r.bonus)} = ${r.total} against ${r.target}`
const sentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`)

export function actionResultText(r: ActionResult): string {
  const decided = r.deciding === null ? null : r.rolls.find((x) => x.label === r.deciding)
  const how = decided ? `${decided.label} ${r.passed ? 'passed' : 'failed'} (rolled ${signedSum(decided)}).` : r.passed ? 'Every check passed.' : 'Every check failed.'
  return [
    'ACTION RESULT (rolled, not a choice)',
    `${r.character ? `${showName(r.character.name)} (@sheet:${r.character.sheet})` : 'Someone'} attempted: "${r.attempt}".`,
    how,
    ...(r.outcome.trim() ? [`Outcome: ${sentence(r.outcome)}`] : []),
    ...(hasSwap(r.cards) ? [swapSentence(r.cards)] : []),
    'Play out this outcome.'
  ].join('\n')
}


export function actionText(a: Action): string {
  const check = (c: ActionCheck) => {
    const head = [
      c.against ?? CHANCE,
      c.difficulty ?? MIDDLE,
      ...(c.base !== null && c.base !== BASE ? [`base ${c.base}`] : [])
    ].join(' ')
    const own = [
      c.pass ? `pass ${c.pass}` : '',
      c.fail ? `fail ${c.fail}` : '',
      c.passAction ? `pass action: ${c.passAction}` : '',
      c.failAction ? `fail action: ${c.failAction}` : '',
      ...cardLines(c)
    ].filter(Boolean).join(' | ')

    return `- ${head}${own ? `: ${own}` : ''}`
  }

  return [
    `${a.attempt} (${a.needs}${a.by ? `, by ${a.by}` : ''})`,
    ...a.checks.map(check),
    `pass: ${a.pass}`,
    `fail: ${a.fail}`,
    a.passAction ? `pass action: ${a.passAction}` : '',
    a.failAction ? `fail action: ${a.failAction}` : '',
    ...cardLines(a)
  ].filter(Boolean).join('\n')
}
// export function actionText(a: Action): string {
//   const check = (c: ActionCheck) => {
//     const head = [c.against ?? CHANCE, c.difficulty ?? MIDDLE, ...(c.base !== null && c.base !== BASE ? [`base ${c.base}`] : [])].join(' ')
//     const own = [c.pass ? `pass ${c.pass}` : '', c.fail ? `fail ${c.fail}` : '', ...cardLines(c)].filter(Boolean).join(' | ')
//     return `- ${head}${own ? `: ${own}` : ''}`
//   }
//   return [`${a.attempt} (${a.needs}${a.by ? `, by ${a.by}` : ''})`, ...a.checks.map(check), `pass: ${a.pass}`, `fail: ${a.fail}`, ...cardLines(a)].join('\n')
// }

function cardLines(o: { passCards: CardSwap; failCards: CardSwap }): string[] {
  return [hasSwap(o.passCards) ? `pass cards: ${swapText(o.passCards)}` : '', hasSwap(o.failCards) ? `fail cards: ${swapText(o.failCards)}` : ''].filter(Boolean)
}

const CARDS_PART = /^(pass|fail|yes|no) cards:/i

const PASS_WORDS = ['pass', 'yes']
const FAIL_WORDS = ['fail', 'no']

function parseCheck(line: string): ActionCheck {
  const [head, own = ''] = line.replace(/^-\s*/, '').split(/:(.*)/s)
  const words = head.trim().split(/\s+/)
  const baseAt = words.findIndex((w) => w.toLowerCase() === 'base')
  const base = baseAt >= 0 ? Number(words[baseAt + 1]) : NaN
  const rest = baseAt >= 0 ? words.slice(0, baseAt) : words
  const last = Number(rest[rest.length - 1])
  const difficulty = Number.isFinite(last) ? last : NaN
  const against = (Number.isFinite(difficulty) ? rest.slice(0, -1) : rest).join(' ').trim()
  const parts = own.split('|').map((x) => x.trim())
  const pick = (words: string[]) => {
    for (const p of parts) for (const w of words) if (!CARDS_PART.test(p) && p.toLowerCase().startsWith(`${w} `)) return p.slice(w.length + 1).trim() || null
    return null
  }
  const cards = (words: string[]) => {
    for (const p of parts) for (const w of words) if (p.toLowerCase().startsWith(`${w} cards:`)) return parseSwap(p.slice(w.length + 7))
    return NO_SWAP
  }
  const actionRef = (words: string[]) => {
    for (const p of parts) for (const w of words) if (p.toLowerCase().startsWith(`${w} action:`)) return p.slice(w.length + 8).trim() || null
    return null
  }
  return {
    against: against || null,
    difficulty: Number.isFinite(difficulty) ? difficulty : null,
    base: Number.isFinite(base) ? base : null,
    pass: pick(PASS_WORDS),
    fail: pick(FAIL_WORDS),
    passCards: cards(PASS_WORDS),
    failCards: cards(FAIL_WORDS),
    passAction: actionRef(PASS_WORDS),
    failAction: actionRef(FAIL_WORDS)
  }
}

export function parseActions(text: string): Action[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length && lines.some((l) => l.startsWith('- ') || /^(pass|fail|yes|no):/i.test(l)))
    .map((lines) => {
      const first = /^(.*?)\s*\((any|all)(?:,\s*by\s+([\w-]+))?\)\s*$/i.exec(lines[0])
      const value = (keys: string[]) => {
        for (const key of keys) {
          const line = lines.find((l) => l.toLowerCase().startsWith(`${key}:`))
          if (line) return line.slice(key.length + 1).trim()
        }
        return ''
      }
      return {
        attempt: (first ? first[1] : lines[0]).trim(),
        needs: (first?.[2].toLowerCase() === 'all' ? 'all' : 'any') as ActionNeeds,
        by: first?.[3] ?? null,
        checks: lines.filter((l) => l.startsWith('- ')).map(parseCheck),
        pass: value(PASS_WORDS),
        fail: value(FAIL_WORDS),
        passCards: parseSwap(value(PASS_WORDS.map((w) => `${w} cards`))),
        failCards: parseSwap(value(FAIL_WORDS.map((w) => `${w} cards`))),
        passAction: value(PASS_WORDS.map((w) => `${w} action`)) || null,
        failAction: value(FAIL_WORDS.map((w) => `${w} action`)) || null
      }
    })
}

export function cleanAction(raw: unknown): Action {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const text = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : null)
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
  const checks = Array.isArray(v.checks)
    ? (v.checks as Record<string, unknown>[]).map((c) => ({
        against: text(c?.against),
        difficulty: num(c?.difficulty),
        base: num(c?.base),
        pass: text(c?.pass),
        fail: text(c?.fail),
        passCards: cleanSwap(c?.passCards),
        failCards: cleanSwap(c?.failCards),
        passAction: text(c?.passAction),
        failAction: text(c?.failAction)
      }))
    : []
  const roller: RollerChoice = v.roller === 'agent' ? 'agent' : 'player'
  return {
    attempt: text(v.attempt) ?? 'Does it work?',
    needs: v.needs === 'all' ? 'all' : 'any',
    by: text(v.by),
    roller,
    checks,
    pass: text(v.pass) ?? '',
    fail: text(v.fail) ?? '',
    passCards: cleanSwap(v.passCards),
    failCards: cleanSwap(v.failCards),
    passAction: text(v.passAction),
    failAction: text(v.failAction)
  }
}

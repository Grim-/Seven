import { NO_SWAP, cleanSwap, hasSwap, parseSwap, swapSentence, swapText, type CardSwap } from './cardDecks'

export interface DecisionOption {
  text: string
  cards: CardSwap
}

export interface Decision {
  question: string
  options: DecisionOption[]
  own: boolean
  decider: string | null
}

export const OWN_ANSWER = 'something else'

const sentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`)
const optionShown = (o: DecisionOption) => (hasSwap(o.cards) ? `${o.text} (${swapText(o.cards)})` : o.text)
const optionList = (d: Decision) => `${d.options.map(optionShown).join(' · ')}.${d.own ? ' They may answer something else.' : ''}`
const cardsNote = (d: Decision) => (d.options.some((o) => hasSwap(o.cards)) ? ['The cards an option gains or loses are the user\'s: give or take them with give_card and take_card once it is chosen.'] : [])

// export function decisionText(d: Decision): string {
//   return [`${d.question} (${d.decider ? `${d.decider} decides` : 'you decide'})`, ...d.options.map((o) => `- ${o.text}${hasSwap(o.cards) ? ` | ${swapText(o.cards)}` : ''}`), ...(d.own ? [`- ${OWN_ANSWER}`] : [])].join('\n')
// }
export function decisionText(d: Decision): string {
  const options = d.options.map(
    (o) => `- ${o.text}${hasSwap(o.cards) ? ` | ${swapText(o.cards)}` : ''}`
  )

  return [
    `${d.question} (${d.decider ? `${d.decider} decides` : 'you decide'})`,
    ...options,
    ...(d.own ? [`- ${OWN_ANSWER}`] : [])
  ].filter(Boolean).join('\n')
}
function parseOption(line: string): DecisionOption {
  const [text, cards = ''] = line.slice(2).split(/\s\|\s(.*)/s)
  return { text: text.trim(), cards: parseSwap(cards) }
}

export function parseDecisions(text: string): Decision[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((lines) => lines.length > 1 && lines.slice(1).some((l) => l.startsWith('- ')))
    .map((lines) => {
      const first = /^(.*?)\s*\((you|[\w-]+)\s+decides?\)\s*$/i.exec(lines[0])
      const options = lines.filter((l) => l.startsWith('- ')).map(parseOption).filter((o) => o.text)
      const decider = first && first[2].toLowerCase() !== 'you' ? first[2] : null
      return { question: (first ? first[1] : lines[0]).trim(), options: options.filter((o) => o.text.toLowerCase() !== OWN_ANSWER), own: options.some((o) => o.text.toLowerCase() === OWN_ANSWER), decider }
    })
}

export function cleanDecision(raw: unknown): Decision {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const text = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : null)
  const option = (x: unknown): DecisionOption | null => {
    if (typeof x === 'string') return text(x) ? { text: text(x) as string, cards: NO_SWAP } : null
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
    return text(o.text) ? { text: text(o.text) as string, cards: cleanSwap(o.cards) } : null
  }
  const options = Array.isArray(v.options) ? v.options.map(option).filter((o): o is DecisionOption => o !== null) : []
  return { question: text(v.question) ?? 'What happens next?', options, own: v.own !== false, decider: text(v.decider) }
}

export function decisionForUser(d: Decision): string {
  return ['DECISION FOR THE USER (not rolled)', `Ask the user with ask_user: "${d.question}"`, `Options: ${optionList(d)}`, ...cardsNote(d), 'Carry on from their answer.'].join('\n')
}

export function decisionForAgent(d: Decision): string {
  return ['DECISION FOR YOU (not rolled)', `"${d.question}"`, `Options: ${optionList(d)}`, ...cardsNote(d), 'Choose one, say which, and play it out.'].join('\n')
}

export function decisionMade(d: Decision, choice: string, cards: CardSwap = NO_SWAP): string {
  return ['DECISION MADE BY THE USER', `"${d.question}" The user chose: ${sentence(choice)}`, ...(hasSwap(cards) ? [swapSentence(cards)] : []), 'Play this out.'].join('\n')
}

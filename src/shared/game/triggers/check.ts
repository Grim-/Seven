import { CREATURE_TEMPLATES, ITEM_TEMPLATES } from '../defs/templates'
import { registerTriggerType } from './trigger'

const CHECK_AGAINST = ['dc', 'creature']

registerTriggerType({
  type: 'check',
  label: 'Check',
  icon: 'dices',
  description: 'A roll against a difficulty, or an opposed check against a creature: searching, sneaking past, forcing a door.',
  fires: 'interact',
  params: {
    question: { label: 'What is tried', kind: 'text', default: '', description: 'Shown at the top, such as Search the well. Empty uses the trigger name.' },
    check: { label: 'Check', kind: 'template', templateKind: 'check', default: '', description: 'What the character rolls.' },
    against: { label: 'Against', kind: 'choice', choices: CHECK_AGAINST, default: 'dc', description: 'dc: a fixed difficulty. creature: a creature rolls against it (an opposed check); a tie goes to the creature.' },
    dc: { label: 'Difficulty (DC)', kind: 'number', default: 12, description: 'The total needed to pass, when against a difficulty.' },
    hideDc: { label: 'Hide the difficulty', kind: 'flag', default: false, description: 'The difficulty is shown only after the roll.' },
    creature: { label: 'Creature', kind: 'template', templateKind: CREATURE_TEMPLATES, default: '', description: 'Who rolls against it, when against a creature.' },
    creatureCheck: { label: 'Creature’s check', kind: 'template', templateKind: 'check', default: '', description: 'What the creature rolls. Empty uses the same check.' },
    pass: { label: 'On a pass', kind: 'text', long: true, default: '', description: 'What happens on a pass. Markdown.' },
    fail: { label: 'On a fail', kind: 'text', long: true, default: '', description: 'What happens on a fail. Markdown.' },
    passFlag: { label: 'A pass sets flag', kind: 'text', default: '', description: 'A flag set in the save on a pass, for other triggers to need.' },
    failFlag: { label: 'A fail sets flag', kind: 'text', default: '', description: 'A flag set in the save on a fail.' },
    passItem: { label: 'A pass finds', kind: 'template', templateKind: ITEM_TEMPLATES, default: '', description: 'An item to take on a pass. None for no item.' },
    passCount: { label: 'How many', kind: 'number', default: 1, min: 1, description: 'How many of that item.' },
    passGold: { label: 'Gold found', kind: 'number', default: 0, min: 0, description: 'Gold to take on a pass.' }
  }
})

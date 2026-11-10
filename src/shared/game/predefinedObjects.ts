import type { PropCollision } from '../maps'
import type { Size } from '../shapes'

export interface PredefinedObject {
  id: string
  name: string
  category: 'Containers' | 'Doors & Portals' | 'Interactables' | 'Environment'
  collision: PropCollision
  size: Size
  image: string
  actions: string
  decisions: string
  description: string
}

function svgData(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`
}

// Crisp, stylized SVG graphics adhering to Seven's dark theme palette (zinc, amber, cyan)
const CHEST_SVG = svgData(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <rect x="6" y="16" width="36" height="24" rx="2" fill="#18181b" stroke="#71717a" stroke-width="2"/>
  <path d="M6 22 L42 22" stroke="#52525b" stroke-width="1.5"/>
  <rect x="12" y="16" width="4" height="24" fill="#27272a" stroke="#52525b" stroke-width="1"/>
  <rect x="32" y="16" width="4" height="24" fill="#27272a" stroke="#52525b" stroke-width="1"/>
  <rect x="21" y="20" width="6" height="8" rx="1" fill="#f59e0b" stroke="#d97706" stroke-width="1.5"/>
  <circle cx="24" cy="23" r="1" fill="#18181b"/>
  <line x1="24" y1="24" x2="24" y2="26" stroke="#18181b" stroke-width="1"/>
</svg>
`)

const DOOR_SVG = svgData(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64" width="48" height="64">
  <rect x="6" y="4" width="36" height="56" rx="2" fill="#18181b" stroke="#52525b" stroke-width="2"/>
  <line x1="18" y1="4" x2="18" y2="60" stroke="#27272a" stroke-width="1.5"/>
  <line x1="30" y1="4" x2="30" y2="60" stroke="#27272a" stroke-width="1.5"/>
  <rect x="6" y="12" width="36" height="4" fill="#3f3f46"/>
  <rect x="6" y="48" width="36" height="4" fill="#3f3f46"/>
  <circle cx="10" cy="34" r="3" fill="#f59e0b" stroke="#d97706" stroke-width="1"/>
  <rect x="36" y="32" width="4" height="6" fill="#71717a"/>
</svg>
`)

const LEVER_SVG = svgData(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="32" height="48">
  <rect x="6" y="34" width="20" height="10" rx="1" fill="#27272a" stroke="#52525b" stroke-width="1.5"/>
  <line x1="16" y1="36" x2="24" y2="12" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
  <circle cx="25" cy="10" r="4" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5"/>
</svg>
`)

const SHRINE_SVG = svgData(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48" width="64" height="48">
  <rect x="8" y="28" width="48" height="16" rx="1" fill="#18181b" stroke="#52525b" stroke-width="2"/>
  <rect x="14" y="22" width="36" height="6" fill="#27272a" stroke="#71717a" stroke-width="1"/>
  <path d="M32 6 L38 18 L26 18 Z" fill="#06b6d4" stroke="#0891b2" stroke-width="1.5" opacity="0.85"/>
  <circle cx="32" cy="14" r="1.5" fill="#ffffff"/>
  <line x1="20" y1="34" x2="44" y2="34" stroke="#06b6d4" stroke-width="1" stroke-dasharray="2,2"/>
</svg>
`)

const SIGNPOST_SVG = svgData(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64" width="48" height="64">
  <rect x="22" y="16" width="4" height="44" fill="#52525b" stroke="#3f3f46" stroke-width="1"/>
  <path d="M8 8 L36 8 L42 16 L36 24 L8 24 Z" fill="#27272a" stroke="#a1a1aa" stroke-width="1.5"/>
  <line x1="12" y1="13" x2="32" y2="13" stroke="#e4e4e7" stroke-width="1"/>
  <line x1="12" y1="18" x2="26" y2="18" stroke="#71717a" stroke-width="1"/>
</svg>
`)

const PORTAL_SVG = svgData(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <ellipse cx="32" cy="32" rx="26" ry="26" fill="none" stroke="#8b5cf6" stroke-width="3" stroke-dasharray="6,4"/>
  <ellipse cx="32" cy="32" rx="18" ry="18" fill="#1e1b4b" stroke="#a855f7" stroke-width="2"/>
  <ellipse cx="32" cy="32" rx="8" ry="8" fill="#c084fc"/>
  <line x1="32" y1="6" x2="32" y2="58" stroke="#c084fc" stroke-width="1" stroke-opacity="0.5"/>
  <line x1="6" y1="32" x2="58" y2="32" stroke="#c084fc" stroke-width="1" stroke-opacity="0.5"/>
</svg>
`)

const CAMPFIRE_SVG = svgData(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <circle cx="24" cy="34" r="14" fill="#27272a" stroke="#52525b" stroke-width="1.5"/>
  <line x1="14" y1="38" x2="34" y2="30" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>
  <line x1="14" y1="30" x2="34" y2="38" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>
  <path d="M24 12 Q29 22 24 30 Q19 22 24 12 Z" fill="#f59e0b" stroke="#ea580c" stroke-width="1.5"/>
  <path d="M24 18 Q27 24 24 28 Q21 24 24 18 Z" fill="#fef08a"/>
</svg>
`)

const BOULDER_SVG = svgData(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48" width="64" height="48">
  <path d="M12 38 L8 24 L20 10 L44 8 L56 22 L52 38 Z" fill="#27272a" stroke="#52525b" stroke-width="2"/>
  <line x1="20" y1="10" x2="30" y2="24" stroke="#3f3f46" stroke-width="1.5"/>
  <line x1="30" y1="24" x2="52" y2="38" stroke="#3f3f46" stroke-width="1.5"/>
  <line x1="30" y1="24" x2="16" y2="34" stroke="#18181b" stroke-width="1.5"/>
</svg>
`)

const BRIDGE_SVG = svgData(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32" width="64" height="32">
  <rect x="2" y="6" width="60" height="20" fill="#27272a" stroke="#451a03" stroke-width="1.5"/>
  <line x1="12" y1="6" x2="12" y2="26" stroke="#78350f" stroke-width="2"/>
  <line x1="24" y1="6" x2="24" y2="26" stroke="#78350f" stroke-width="2"/>
  <line x1="36" y1="6" x2="36" y2="26" stroke="#78350f" stroke-width="2"/>
  <line x1="48" y1="6" x2="48" y2="26" stroke="#78350f" stroke-width="2"/>
  <line x1="2" y1="8" x2="62" y2="8" stroke="#d97706" stroke-width="1"/>
  <line x1="2" y1="24" x2="62" y2="24" stroke="#d97706" stroke-width="1"/>
</svg>
`)

export const PREDEFINED_OBJECTS: PredefinedObject[] = [
  {
    id: 'treasure_chest',
    name: 'Treasure Chest',
    category: 'Containers',
    collision: 'solid',
    size: { w: 48, h: 48 },
    image: CHEST_SVG,
    actions: `Lockpick the chest (any)
- Thieves' tools 14: pass The lock clicks open smoothly | fail The pick jams in the tumbler
- Athletics 16: pass You force the iron latch open | fail The metal latch holds firm
pass: The heavy iron latch springs free.
fail: The chest remains sealed shut.

Inspect for traps (any)
- Investigation 13: pass You identify a spring-needle mechanism | fail You find no obvious traps
pass: You carefully dismantle the trap mechanism.
fail: You cannot detect any hidden dangers.`,
    decisions: `What do you do with the chest? (you decide)
- Search the contents inside
- Inspect the lock for traps
- Leave the chest undisturbed`,
    description: 'An ironbound wooden trunk with a heavy brass clasp.'
  },
  {
    id: 'heavy_door',
    name: 'Heavy Ironbound Door',
    category: 'Doors & Portals',
    collision: 'solid',
    size: { w: 48, h: 64 },
    image: DOOR_SVG,
    actions: `Force open the door (any)
- Athletics 15: pass The heavy door groans and bursts inward | fail The door does not budge
- Thieves' tools 13: pass The tumblers align and the deadbolt slides back | fail The lock resists your tool
pass: The portal swings open, unbarring the passage.
fail: The door remains securely shut.

Listen at the door (any)
- Perception 11: pass You hear faint scraping sounds on the other side | fail Complete silence
pass: You gain insight into what awaits beyond.
fail: You cannot hear anything through the thick timber.`,
    decisions: `Approach the ironbound door (you decide)
- Push the heavy door open
- Knock firmly on the timber
- Step away and reconsider`,
    description: 'A reinforced dungeon portal barring entry.'
  },
  {
    id: 'wall_lever',
    name: 'Wall Lever',
    category: 'Interactables',
    collision: 'solid',
    size: { w: 32, h: 48 },
    image: LEVER_SVG,
    actions: `Inspect the lever mechanism (any)
- Investigation 12: pass You trace the gears to a hidden door | fail The mechanics are too obscured
pass: You understand what this lever controls.
fail: The contraption remains a mystery.

Throw the heavy lever (any)
- Athletics 10: pass The iron lever throws with a heavy thud | fail The rusted hinge is seized
pass: Gears grind and a mechanism activates in the distance.
fail: The lever refuses to move.`,
    decisions: `Pull the mechanical switch? (you decide)
- Pull the lever downwards
- Leave the lever in upright position`,
    description: 'A mechanical iron switch connected to hidden mechanisms.'
  },
  {
    id: 'ancient_shrine',
    name: 'Ancient Runed Shrine',
    category: 'Interactables',
    collision: 'solid',
    size: { w: 64, h: 48 },
    image: SHRINE_SVG,
    actions: `Decipher ancient runes (any)
- Religion 13: pass You recognize prayers to the Dawn Father | fail The archaic dialect eludes you
- Arcana 13: pass You identify protective abjuration wards | fail The arcane glyphs are illegible
pass: The meaning of the shrine reveals itself.
fail: The script remains undeciphered.`,
    decisions: `Interact with the ancient shrine (you decide)
- Kneel and offer a prayer for blessing
- Touch the glowing runic altar
- Step back reverently`,
    description: 'A weathered stone altar humming with residual arcane power.'
  },
  {
    id: 'notice_board',
    name: 'Notice Board',
    category: 'Interactables',
    collision: 'solid',
    size: { w: 48, h: 64 },
    image: SIGNPOST_SVG,
    actions: `Search notices for rumors (any)
- Investigation 10: pass You find a freshly posted monster bounty | fail Only mundane local announcements
- Perception 14: pass You spot a hidden thieves' cant marking | fail Nothing out of the ordinary
pass: You learn valuable local intelligence.
fail: You find no extraordinary information.`,
    decisions: `Read the posted notices (you decide)
- Study the bounty postings
- Read the missing travelers report
- Continue along your journey`,
    description: 'A wooden signpost cluttered with news, warnings, and bounties.'
  },
  {
    id: 'mystic_portal',
    name: 'Mystic Rift Portal',
    category: 'Doors & Portals',
    collision: 'passable',
    size: { w: 64, h: 64 },
    image: PORTAL_SVG,
    actions: `Attune to the planar rift (any)
- Arcana 14: pass You identify the planar coordinates | fail The vortex disrupts your senses
pass: The destination of the gateway becomes clear.
fail: The destination remains unknown.`,
    decisions: `The swirling rift hums with energy (you decide)
- Step bravely into the portal vortex
- Back away from the rift cautiously`,
    description: 'A vertical vortex of planar energy linking distant realms.'
  },
  {
    id: 'campfire_rest',
    name: 'Campfire & Rest Site',
    category: 'Environment',
    collision: 'passable',
    size: { w: 48, h: 48 },
    image: CAMPFIRE_SVG,
    actions: `Tend the fire and camp (any)
- Survival 10: pass The embers blaze warm and safe | fail The damp wood smothers in smoke
pass: A cozy camp is established against the chill.
fail: The fire struggles to stay lit.`,
    decisions: `Rest by the campfire (you decide)
- Take a Short Rest (Spend Hit Dice to recover HP)
- Take a Long Rest (Recover full HP, spell slots, and hit dice)
- Extinguish the fire and move on`,
    description: 'A warm haven to bind wounds, cook rations, and recover spell slots.'
  },
  {
    id: 'fallen_boulder',
    name: 'Fallen Boulder',
    category: 'Environment',
    collision: 'solid',
    size: { w: 64, h: 48 },
    image: BOULDER_SVG,
    actions: `Heave boulder aside (any)
- Athletics 16: pass You roll the stone away, clearing the path | fail The rock is too heavy
pass: The passage is cleared.
fail: The stone remains firmly lodged.`,
    decisions: `Navigate the fallen boulder (you decide)
- Climb over the top for a vantage point
- Use the boulder as defensive cover
- Turn back`,
    description: 'A massive chunk of fractured stone blocking the passage.'
  },
  {
    id: 'wooden_bridge',
    name: 'Wooden Plank Bridge',
    category: 'Environment',
    collision: 'passable',
    size: { w: 64, h: 32 },
    image: BRIDGE_SVG,
    actions: `Inspect the rope bridge (any)
- Investigation 10: pass The guide ropes and planks are sturdy | fail The footing looks precarious
- Acrobatics 12: pass You cross with nimble grace | fail A plank snaps underfoot
pass: Safe transit is assured.
fail: Crossing is hazardous.`,
    decisions: `Cross the wooden bridge (you decide)
- Cross carefully one by one
- Rush across with haste
- Search for an alternate crossing`,
    description: 'Rope and weathered planks providing passage over chasms.'
  }
]

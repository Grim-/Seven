import fs from 'node:fs'
import path from 'node:path'
import { fromSrd, type CompendiumEntry, type CompendiumKind } from '../src/shared/compendium'

const SOURCE = 'SRD 5.1'
const dir = process.argv[2]
const out = path.resolve('src/modules/dnd/srd')
if (!dir || !fs.existsSync(dir)) {
  console.error('Usage: tsx scripts/srd-import.ts <5e-database>/src/2014/en')
  process.exit(1)
}

const load = (name: string): Record<string, unknown>[] => JSON.parse(fs.readFileSync(path.join(dir, `5e-SRD-${name}.json`), 'utf8'))
const ref = (v: unknown): string => String((v as { index?: string } | undefined)?.index ?? '')

const features = load('Features')
const featuresByClass = new Map<string, { level: number; name: string }[]>()
for (const f of features) {
  if (f.subclass) continue
  const c = ref(f.class)
  featuresByClass.set(c, [...(featuresByClass.get(c) ?? []), { level: Number(f.level) || 0, name: String(f.name) }])
}
const subclassesByClass = new Map<string, { name: string; text: string }[]>()
for (const s of load('Subclasses')) {
  const c = ref(s.class)
  const text = (Array.isArray(s.desc) ? s.desc : [s.desc]).join('\n\n')
  subclassesByClass.set(c, [...(subclassesByClass.get(c) ?? []), { name: String(s.name), text }])
}

const sets: Record<CompendiumKind, Record<string, unknown>[]> = {
  spell: load('Spells'),
  class: load('Classes'),
  feature: [...features, ...load('Traits'), ...load('Feats')],
  race: [...load('Races'), ...load('Subraces')],
  equipment: [...load('Equipment'), ...load('Magic-Items')],
  condition: load('Conditions'),
  monster: load('Monsters')
}

fs.mkdirSync(out, { recursive: true })
for (const [kind, raw] of Object.entries(sets) as [CompendiumKind, Record<string, unknown>[]][]) {
  const seen = new Set<string>()
  const entries: CompendiumEntry[] = []
  for (const item of raw) {
    const e = fromSrd(kind, item, SOURCE, { featuresByClass, subclassesByClass })
    if (!e || seen.has(e.id)) continue
    seen.add(e.id)
    entries.push(e)
  }
  entries.sort((a, b) => a.name.localeCompare(b.name))
  fs.writeFileSync(path.join(out, `${kind}.json`), JSON.stringify(entries))
  console.log(`${kind}: ${entries.length}`)
}

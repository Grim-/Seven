import type { LibrarySection } from '@shared/types'
import { SETUP_GROUP, kindUi } from '../../registries/kinds'

export { SETUP_GROUP }

export function railKind(kind: string | null): string | null {
  return kind ? (kindUi(kind).railUnder?.kind ?? kind) : null
}

const ORDER = ['Yours', 'Agents', 'Worlds']

export function groupOf(section: LibrarySection): string {
  return kindUi(section.kind).railGroup ?? section.group
}

export function railGroups(sections: LibrarySection[]): { name: string; sections: LibrarySection[] }[] {
  const map = new Map<string, LibrarySection[]>()
  for (const sec of sections) {
    if (kindUi(sec.kind).railUnder) continue
    const name = groupOf(sec)
    const rail = kindUi(sec.kind).rail
    const added = sections.filter((x) => kindUi(x.kind).railUnder?.kind === sec.kind && kindUi(x.kind).railUnder?.count).reduce((n, x) => n + x.count, 0)
    const shown = { ...sec, plural: rail?.label ?? sec.plural, icon: rail?.icon ?? sec.icon, count: sec.count + added }
    map.set(name, [...(map.get(name) ?? []), shown])
  }
  const rank = (name: string) => (name === SETUP_GROUP ? 2000 : name === 'Tools' ? 1000 : ORDER.includes(name) ? ORDER.indexOf(name) : ORDER.length)
  return [...map.entries()].map(([name, list]) => ({ name, sections: list })).sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
}

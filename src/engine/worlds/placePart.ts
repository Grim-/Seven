import { PLACE_TYPE_KEY, REGION_TYPE_KEY, plainValue, type WorldValue } from '@shared/world'
import { localPlaceMermaid, placeBreadcrumbNames, regionPath } from '@shared/maps'
import { linkFor } from '@shared/text'
import { agentAccess } from '../agents/access'
import { whoIsHere } from './presence'
import { matchRecordKey, registerWorldPart } from './parts'
import { worlds } from './store'

function placesOf(world: string): Record<string, Record<string, unknown>> {
  return worlds.exists(world) ? worlds.entities(world, PLACE_TYPE_KEY, false) : {}
}

function regionsOf(world: string): Record<string, Record<string, unknown>> {
  return worlds.exists(world) ? worlds.entities(world, REGION_TYPE_KEY, false) : {}
}

function placeTitle(world: string, key: string): string {
  return String(placesOf(world)[key]?.Name || key)
}

function regionTitle(world: string, key: string): string {
  return String(regionsOf(world)[key]?.Name || key)
}

function placeMarkdown(world: string, key: string): string {
  const places = placesOf(world)
  const regions = regionsOf(world)
  const p = places[key]
  if (!p) return `No place "${key}" in ${world}.`
  const path = placeBreadcrumbNames(places, regions, key)
  const regionKey = typeof p.Region === 'string' && p.Region && regions[p.Region] ? p.Region : ''
  const looks = typeof p.Looks === 'string' ? p.Looks.trim() : ''
  const mermaid = localPlaceMermaid(places, key)
  const mapUse = worlds.mapUses(world).find((u) => Boolean(u.shapes[key])) ?? null
  const spawn = mapUse?.spawns?.[key] ?? null
  const here = (whoIsHere(world)[key] ?? []).map((v) => {
    const agent = v.agent ? agentAccess.get(v.agent) : null
    return `- ${linkFor('sheet', v.sheet)} (${v.name}) — ${v.line}${agent ? ` (played by ${linkFor('agent', agent.name)})` : ''}`
  })
  return [
    `# ${placeTitle(world, key)}`,
    `path: ${path.join(' › ')}`,
    `world: ${worlds.meta(world).name}`,
    ...(regionKey ? [`region: ${regionTitle(world, regionKey)} (@world:${world}/region/${regionKey})`] : []),
    ...(mapUse ? [`map: @map:${mapUse.map}${spawn ? ` (spawn ${spawn.x}, ${spawn.y})` : ''}`] : []),
    ...(looks ? [`looks: ${looks}`] : []),
    `now: ${String(p.Now || '').trim() || 'nothing happening'}`,
    here.length ? `here:\n${here.join('\n')}` : 'here: nobody',
    ...(mermaid ? [`local exits:\n\`\`\`mermaid\n${mermaid}\n\`\`\``] : [])
  ]
    .filter(Boolean)
    .join('\n')
}

function regionMarkdown(world: string, key: string): string {
  const regions = regionsOf(world)
  const places = placesOf(world)
  const r = regions[key]
  if (!r) return `No region "${key}" in ${world}.`
  const path = regionPath(regions, key).map((k) => String(regions[k]?.Name || k))
  const summary = typeof r.Summary === 'string' ? r.Summary.trim() : ''
  const subregions = Object.keys(regions).filter((k) => k !== key && regions[k]?.Parent === key)
  const regionPlaces = Object.keys(places).filter((k) => places[k]?.Region === key)
  const drawn = worlds.mapUses(world).filter((u) => Boolean(u.regionShapes?.[key]))
  return [
    `# ${regionTitle(world, key)}`,
    `path: ${path.join(' › ')}`,
    `world: ${worlds.meta(world).name}`,
    ...(summary ? [`summary: ${summary}`] : []),
    ...(subregions.length ? [`subregions: ${subregions.map((k) => `@world:${world}/region/${k}`).join(' ')}`] : []),
    regionPlaces.length ? `places in region: ${regionPlaces.map((k) => `@world:${world}/place/${k}`).join(' ')}` : 'places in region: none',
    ...(drawn.length ? [`on maps: ${drawn.map((u) => `@map:${u.map}`).join(' ')}`] : [])
  ].join('\n')
}

registerWorldPart('region', {
  has: (world, key) => Boolean(regionsOf(world)[key]),
  title: regionTitle,
  line: (world, key) => {
    const regions = regionsOf(world)
    return regionPath(regions, key).map((k) => String(regions[k]?.Name || k)).join(' › ')
  },
  card: regionMarkdown,
  fields: (world, key) => {
    const r = regionsOf(world)[key]
    return r ? Object.entries(r).map(([name, v]) => ({ name, text: plainValue(v as WorldValue) })) : []
  },
  data: (world, key) => worlds.get(world, REGION_TYPE_KEY, key, false),
  remove: (world, key) => worlds.removeRegion(world, key),
  resolve: (world, path) => {
    const regions = regionsOf(world)
    let region = matchRecordKey(regions, path[0])
    if (!region) return null
    for (const [i, seg] of path.slice(1).entries()) {
      const at: string = region
      const sub = matchRecordKey(regions, seg, Object.keys(regions).filter((k) => regions[k]?.Parent === at))
      if (sub) {
        region = sub
        continue
      }
      if (i !== path.length - 2) return null
      const places = placesOf(world)
      const inside = Object.keys(places).filter((k) => {
        const r = typeof places[k]?.Region === 'string' ? String(places[k].Region) : ''
        return Boolean(r) && regionPath(regions, r).includes(at)
      })
      const place = matchRecordKey(places, seg, inside)
      return place ? `${PLACE_TYPE_KEY}/${place}` : null
    }
    return `${REGION_TYPE_KEY}/${region}`
  },
  top: true,
  children: (world) =>
    Object.keys(regionsOf(world)).map((key) => ({
      kind: 'world',
      id: `${world}/region/${key}`,
      path: `${world}/region/${key}`,
      title: regionTitle(world, key)
    })),
  inside: (world, key) => {
    const regions = regionsOf(world)
    const places = placesOf(world)
    return [
      ...Object.keys(regions)
        .filter((k) => k !== key && regions[k]?.Parent === key)
        .map((k) => ({ kind: 'world', id: `${world}/region/${k}`, path: `${world}/region/${k}`, title: regionTitle(world, k) })),
      ...Object.keys(places)
        .filter((k) => places[k]?.Region === key)
        .map((k) => ({ kind: 'world', id: `${world}/place/${k}`, path: `${world}/region/${key}/${k}`, title: placeTitle(world, k) }))
    ]
  },
  search: (world, query) => {
    const q = query.trim().toLowerCase()
    const worldName = worlds.list().find((w) => w.id === world)?.name ?? world
    const regions = regionsOf(world)
    return Object.keys(regions)
      .filter((key) => {
        const name = String(regions[key]?.Name || key).toLowerCase()
        const summary = String(regions[key]?.Summary || '').toLowerCase()
        return !q || name.includes(q) || key.toLowerCase().includes(q) || summary.includes(q) || worldName.toLowerCase().includes(q)
      })
      .map((key) => ({
        kind: 'world',
        id: `${world}/region/${key}`,
        title: String(regions[key]?.Name || key),
        excerpt: `region in ${worldName}`
      }))
  }
})

registerWorldPart('place', {
  has: (world, key) => Boolean(placesOf(world)[key]),
  title: placeTitle,
  line: (world, key) => placeBreadcrumbNames(placesOf(world), regionsOf(world), key).join(' › '),
  card: placeMarkdown,
  fields: (world, key) => {
    const p = placesOf(world)[key]
    return p ? Object.entries(p).map(([name, v]) => ({ name, text: plainValue(v as WorldValue) })) : []
  },
  data: (world, key) => worlds.get(world, PLACE_TYPE_KEY, key, false),
  remove: (world, key) => worlds.removePlace(world, key),
  resolve: (world, path) => {
    const places = placesOf(world)
    let key = matchRecordKey(places, path[0])
    for (const seg of path.slice(1)) {
      const at = key
      key = at ? matchRecordKey(places, seg, Object.keys(places).filter((k) => places[k]?.Inside === at)) : null
    }
    return key ? `${PLACE_TYPE_KEY}/${key}` : null
  },
  top: true,
  children: (world) =>
    Object.keys(placesOf(world)).map((key) => ({
      kind: 'world',
      id: `${world}/place/${key}`,
      path: `${world}/place/${key}`,
      title: placeTitle(world, key)
    })),
  inside: (world, key) => {
    const places = placesOf(world)
    return Object.keys(places)
      .filter((k) => k !== key && places[k]?.Inside === key)
      .map((k) => ({ kind: 'world', id: `${world}/place/${k}`, path: `${world}/place/${k}`, title: placeTitle(world, k) }))
  },
  search: (world, query) => {
    const q = query.trim().toLowerCase()
    const worldName = worlds.list().find((w) => w.id === world)?.name ?? world
    const places = placesOf(world)
    const regions = regionsOf(world)
    return Object.keys(places)
      .filter((key) => {
        const name = String(places[key]?.Name || key).toLowerCase()
        const looks = String(places[key]?.Looks || '').toLowerCase()
        const rKey = typeof places[key]?.Region === 'string' ? String(places[key].Region) : ''
        const rName = rKey && regions[rKey] ? String(regions[rKey].Name || rKey).toLowerCase() : ''
        return !q || name.includes(q) || key.toLowerCase().includes(q) || looks.includes(q) || rName.includes(q) || worldName.toLowerCase().includes(q)
      })
      .map((key) => ({
        kind: 'world',
        id: `${world}/place/${key}`,
        title: String(places[key]?.Name || key),
        excerpt: `place in ${placeBreadcrumbNames(places, regions, key).slice(0, -1).join(' › ') || worldName}`
      }))
  }
})

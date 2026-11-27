import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'seven-world-export-'))
process.env.SEVEN_HOME = tmpHome

async function main() {
  try {
    await import('../src/engine/worlds/factionPart')
    await import('../src/engine/worlds/knowledgePart')
    await import('../src/engine/worlds/eventPart')
    await import('../src/engine/worlds/npcPart')
    await import('../src/engine/worlds/placePart')
    await import('../src/engine/library/defs/ops')
    const { syncModuleKinds } = await import('../src/engine/library/moduleKinds')
    syncModuleKinds(new Set(['world', 'game']), [])

    const { worlds } = await import('../src/engine/worlds/store')
    const { factions } = await import('../src/engine/factions/store')
    const { knowledge } = await import('../src/engine/worlds/knowledge')
    const { worldEvents } = await import('../src/engine/worlds/events')
    const { npcs } = await import('../src/engine/worlds/npcs')
    const { portabilityDescribeKind, portabilityEstimate, portabilityImport, portabilityMarkdown, portabilityExport } = await import('../src/engine/portability/index')
    const { encodeJsonExport } = await import('../src/engine/portability/codec')
    const { data } = await import('../src/engine/data/hub')
    const { collectPortableBundle } = await import('../src/engine/portability/pack')
    const { worldPacking } = await import('../src/engine/portability/kindPackers')
    const { copyWorldItems, listWorldTransferables } = await import('../src/engine/worlds/transfer')

    // 1. Create source world with factions, regions, places, lore, events, NPCs, and a custom schema type
    const w1 = worlds.create('Source Realm', {
      version: 1,
      types: {
        guild: {
          label: 'Name',
          noun: 'Guild',
          plural: 'Guilds',
          fields: { Name: { kind: 'text' }, Motto: { kind: 'text' } }
        }
      }
    })
    worlds.put(w1.id, 'region', 'north', { Name: 'The North' }, 'template')
    worlds.put(w1.id, 'region', 'frostpeak', { Name: 'Frostpeak', Parent: 'north' }, 'template')
    worlds.put(
      w1.id,
      'place',
      'keep',
      { Name: 'Iron Keep', Region: 'north', Exits: [{ text: 'Great doors', ref: 'throne_room', locked: false }] },
      'template'
    )
    worlds.put(
      w1.id,
      'place',
      'throne_room',
      { Name: 'Throne Room', Region: 'north', Inside: 'keep', Exits: [{ text: 'Hidden stair', ref: 'vault', locked: true }] },
      'template'
    )
    worlds.put(w1.id, 'place', 'vault', { Name: 'Deep Vault', Region: 'north', Inside: 'throne_room' }, 'template')
    worlds.put(w1.id, 'place', 'spire', { Name: 'Frost Spire', Region: 'frostpeak' }, 'template')
    worlds.put(w1.id, 'guild', 'masons', { Name: 'Stone Masons', Motto: 'Built to endure' }, 'template')
    const fac = factions.save({ name: 'Iron Legion', defaultStance: 'neutral', description: 'Steel guard' }, w1.id)
    const kn = knowledge.save(w1.id, { name: 'Old Law', text: 'Never break an oath.', scope: 'global' })
    const ev = worldEvents.save({ worldId: w1.id, title: 'Border Siege' })
    const npc = npcs.saveTemplate(w1.id, { title: 'Captain Voss', faction: fac.id })

    // 2. "All Worlds" must only list top-level worlds (no faction/place/etc. sub-parts)
    const desc = portabilityDescribeKind('world')
    assert.equal(desc.entries.length, 1, 'Expected only top-level worlds in All Worlds export')
    assert.equal(desc.entries[0].id, w1.id)

    // 3. Estimating & collecting "All Worlds" must succeed with zero errors
    const est = portabilityEstimate({
      items: desc.entries.map((e) => ({ kind: 'world', id: e.id })),
      includeDependencies: true,
      format: 'bundle'
    })
    assert.equal(est.rootCount, 1)

    // 4. Packing & unpacking standalone world parts (including faction, knowledge, event) into a chosen targetWorld
    const subIds = [
      `${w1.id}/faction/${fac.id}`,
      `${w1.id}/knowledge/${kn.id}`,
      `${w1.id}/event/${ev.id}`,
      `${w1.id}/place/keep`,
      `${w1.id}/region/north`,
      `${w1.id}/npc/${npc.id}`
    ]
    const subBundle = collectPortableBundle(subIds.map((id) => ({ kind: 'world', id })), true)
    assert.equal(subBundle.entries.length, 10, 'Expected 6 selected + 4 nested child subregions/places')

    const regionExport = collectPortableBundle([{ kind: 'world', id: `${w1.id}/region/north` }], true)
    assert.equal(regionExport.entries.length, 6, 'Exporting a region with dependencies must include its subregions and child places')

    const w2 = worlds.create('Import Target')
    const packer = worldPacking()
    const how = { replace: null, parent: null, targetWorld: w2.id, entry: (r: string) => r }
    const unpackedFac = packer.unpack(subBundle.entries.find((e) => e.id.includes('/faction/'))!.value, how)
    const unpackedKn = packer.unpack(subBundle.entries.find((e) => e.id.includes('/knowledge/'))!.value, how)
    const unpackedEv = packer.unpack(subBundle.entries.find((e) => e.id.includes('/event/'))!.value, how)
    assert.ok(unpackedFac.startsWith(`${w2.id}/faction/`))
    assert.ok(unpackedKn.startsWith(`${w2.id}/knowledge/`))
    assert.ok(unpackedEv.startsWith(`${w2.id}/event/`))
    assert.ok(factions.list(w2.id, 'template').some((f) => f.name === 'Iron Legion'))
    assert.equal(knowledge.list(w2.id).length, 1)
    assert.equal(worldEvents.listDefinitions(w2.id).length, 1)

    // 5. Direct cross-world transfer (listWorldTransferables + copyWorldItems)
    const transferables = listWorldTransferables(w1.id)
    assert.ok(transferables.some((t) => t.ref === `${w1.id}/faction/${fac.id}`))
    assert.ok(transferables.some((t) => t.ref === `${w1.id}/place/keep`))
    assert.ok(transferables.some((t) => t.ref === `${w1.id}/region/north`))
    assert.ok(transferables.some((t) => t.ref === `${w1.id}/knowledge/${kn.id}`))
    assert.ok(transferables.some((t) => t.ref === `${w1.id}/event/${ev.id}`))
    assert.ok(transferables.some((t) => t.ref === `${w1.id}/npc/${npc.id}`))
    assert.ok(transferables.some((t) => t.ref === `${w1.id}/guild/masons`))

    const w3 = worlds.create('Reuse Target')
    const pickedRefs = [
      `${w1.id}/faction/${fac.id}`,
      `${w1.id}/region/north`,
      `${w1.id}/knowledge/${kn.id}`,
      `${w1.id}/event/${ev.id}`,
      `${w1.id}/npc/${npc.id}`,
      `${w1.id}/guild/masons`
    ]
    const transferRes = copyWorldItems(pickedRefs, w3.id)
    assert.equal(transferRes.skipped.length, 0)
    assert.equal(transferRes.copied.length, 11, 'Expected 6 picked + frostpeak + keep + throne_room + vault + spire')
    assert.ok(factions.list(w3.id, 'template').some((f) => f.name === 'Iron Legion'))
    assert.equal(Object.keys(worlds.entities(w3.id, 'region', true, 'template')).length, 2)
    assert.equal(worlds.get(w3.id, 'region', 'frostpeak', true, 'template')?.Parent, 'north')
    const copiedPlace = worlds.get(w3.id, 'place', 'keep', true, 'template')
    assert.equal(copiedPlace?.Region, 'north', 'Copied place should preserve its copied Region link')
    assert.equal(worlds.get(w3.id, 'place', 'throne_room', true, 'template')?.Inside, 'keep')
    assert.equal(worlds.get(w3.id, 'place', 'vault', true, 'template')?.Inside, 'throne_room')
    assert.equal(worlds.get(w3.id, 'place', 'spire', true, 'template')?.Region, 'frostpeak')
    const copiedExits = copiedPlace?.Exits as { ref: string | null }[]
    assert.equal(copiedExits?.[0]?.ref, 'throne_room', 'Copied place should preserve Exit links to copied places')
    const copiedNpc = npcs.list(w3.id, 'template')[0]
    assert.equal(copiedNpc?.faction, fac.id, 'Copied NPC should preserve its copied Faction link')
    assert.equal(knowledge.list(w3.id).length, 1)
    assert.equal(worldEvents.listDefinitions(w3.id).length, 1)
    assert.ok(worlds.schema(w3.id).types.guild, 'Custom schema type should be copied to target world automatically')
    assert.equal(worlds.get(w3.id, 'guild', 'masons', true, 'template')?.Name, 'Stone Masons')

    // 6. Copying a region again with collision remaps all child Parent/Region/Inside/Exits to new keys
    const dupRegionRes = copyWorldItems([`${w1.id}/region/north`], w3.id)
    assert.equal(dupRegionRes.copied.length, 6)
    assert.equal(worlds.get(w3.id, 'region', 'frostpeak_2', true, 'template')?.Parent, 'north_2')
    assert.equal(worlds.get(w3.id, 'place', 'keep_2', true, 'template')?.Region, 'north_2')
    assert.equal(worlds.get(w3.id, 'place', 'throne_room_2', true, 'template')?.Inside, 'keep_2')
    assert.equal(worlds.get(w3.id, 'place', 'vault_2', true, 'template')?.Inside, 'throne_room_2')
    assert.equal((worlds.get(w3.id, 'place', 'keep_2', true, 'template')?.Exits as { ref: string | null }[])?.[0]?.ref, 'throne_room_2')

    // 7. Copying ONLY a parent place into a fresh world brings all nested child places
    const w4 = worlds.create('Place Only Target')
    const placeOnlyRes = copyWorldItems([`${w1.id}/place/keep`], w4.id)
    assert.equal(placeOnlyRes.copied.length, 3, 'Expected keep + throne_room + vault')
    assert.equal(worlds.get(w4.id, 'place', 'throne_room', true, 'template')?.Inside, 'keep')
    assert.equal(worlds.get(w4.id, 'place', 'vault', true, 'template')?.Inside, 'throne_room')
    assert.equal((worlds.get(w4.id, 'place', 'keep', true, 'template')?.Exits as { ref: string | null }[])?.[0]?.ref, 'throne_room')

    // 8. Importing a page or character sheet must NOT create Imports/ folders unless loose files arrive
    const pageBuf = encodeJsonExport({
      about: { kind: 'page', label: 'Page', title: 'Guild Charter', also: [] },
      entries: [
        {
          kind: 'page',
          id: 'guild_charter',
          title: 'Guild Charter',
          value: { title: 'Guild Charter', type: null, body: 'Rules of the guild.', fields: [], records: [], data: null, image: null, view: null, voice: null }
        }
      ],
      text: null,
      files: [],
      protection: 'none'
    })
    const pageRes = await portabilityImport({ source: { text: pageBuf.toString('utf8'), name: 'guild_charter.json' } })
    assert.equal(pageRes.imported.length, 1)
    assert.equal(pageRes.folder, null, 'Page import with no loose files should not create an Imports folder')
    const importedPage = data.pages.metaFor(pageRes.imported[0].id)
    assert.equal(importedPage?.parent ?? null, null, 'Imported page should land at root, not inside Imports/')
    assert.equal(data.pages.find('imports'), null, 'No Imports folder should be created for a plain page import')

    const sheetWithFileBuf = encodeJsonExport({
      about: { kind: 'sheet', label: 'Character sheet', title: 'Valerius', also: [] },
      entries: [
        {
          kind: 'sheet',
          id: 'valerius',
          title: 'Valerius',
          value: {
            title: 'Valerius',
            type: 'sheet',
            body: '',
            fields: [],
            records: [],
            data: { fields: ['Role'], values: { Role: 'Knight' } },
            image: 'a_0123456789ab',
            view: null,
            voice: null
          }
        }
      ],
      text: null,
      files: [{ meta: { id: 'a_0123456789ab', name: 'valerius.txt', size: 5 }, data: Buffer.from('hello') }],
      protection: 'none'
    })
    const sheetRes = await portabilityImport({ source: { text: sheetWithFileBuf.toString('utf8'), name: 'valerius.json' } })
    assert.equal(sheetRes.imported.length, 1)
    const sheetMeta = data.pages.metaFor(sheetRes.imported[0].id)
    assert.equal(data.pages.pathOf(sheetMeta!.id), 'characters/valerius', 'Character sheet should land in Characters, not Imports/')
    assert.ok(sheetRes.folder, 'Loose file should create a single Imports/<title> folder')
    assert.equal(data.pages.pathOf(sheetRes.folder.id), 'imports/valerius', 'Loose file folder should be Imports/<title> without extra nested subfolders')

    // 9. Portable Export as Markdown (live preview + .md file export)
    const mdRes = portabilityMarkdown({
      items: [{ kind: 'page', id: pageRes.imported[0].id }],
      includeDependencies: false
    })
    assert.equal(mdRes.count, 1)
    assert.ok(mdRes.markdown.includes('# guild_charter'))
    assert.ok(mdRes.markdown.includes('Rules of the guild.'))

    const mdOutPath = path.join(tmpHome, 'guild_charter.md')
    const mdExportRes = portabilityExport({
      items: [{ kind: 'page', id: pageRes.imported[0].id }],
      includeDependencies: false,
      format: 'markdown',
      splitMode: 'single',
      protection: 'none',
      outputPath: mdOutPath
    })
    assert.equal(mdExportRes.files.length, 1)
    assert.equal(fs.readFileSync(mdExportRes.files[0], 'utf8'), mdRes.markdown)

    process.stdout.write('PASS: world export, standalone faction/part packing, targetWorld import, cross-world copy, clean card import placement, and markdown export\n')
  } finally {
    fs.rmSync(tmpHome, { recursive: true, force: true })
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`)
    process.exit(1)
  })

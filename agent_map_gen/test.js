import {
  describeAllDungeonKinds,
  describeAllShaperKinds,
  describeDungeonKind,
  describeShaperKind,
  generateDungeon,
  generateMap,
  listDungeonKinds,
  listShaperKinds,
  SHAPER_KINDS,
} from './index.js';

async function run() {
  const shaperKinds = listShaperKinds();
  console.log(`Listed ${shaperKinds.length} shaper kinds: ${shaperKinds.map((k) => k.id).join(', ')}`);

  for (const id of Object.keys(SHAPER_KINDS)) {
    const desc = describeShaperKind(id);
    if (!desc || typeof desc !== 'string') throw new Error(`Missing description for shaper ${id}`);
  }

  const shaperCatalog = describeAllShaperKinds();
  if (!shaperCatalog.includes('# Map Generator Shaper Kinds')) throw new Error('Shaper catalog generation failed');

  for (const id of Object.keys(SHAPER_KINDS)) {
    const size = id === 'archipelago' ? 128 : 64;
    const startTime = Date.now();
    const map = await generateMap({
      shaper: id,
      seed: 'test-seed-xyz',
      width: size,
      height: size,
    });
    const elapsed = Date.now() - startTime;

    console.log(`Shaper [${id}]: ${map.width}x${map.height}, ${map.stats.landCells} land cells (${(map.stats.landRatio * 100).toFixed(1)}%), shaped in ${elapsed}ms`);

    if (map.mask.length !== size * size) {
      throw new Error(`Invalid mask size for ${id}: ${map.mask.length}`);
    }
  }

  console.log('\n--- Testing Dungeon Kinds ---');
  const dungeonKinds = listDungeonKinds();
  console.log(`Listed ${dungeonKinds.length} dungeon kinds: ${dungeonKinds.map((k) => k.id).join(', ')}`);

  for (const k of dungeonKinds) {
    const desc = describeDungeonKind(k.id);
    if (!desc || typeof desc !== 'string') throw new Error(`Missing description for dungeon ${k.id}`);
  }

  const dungeonCatalog = describeAllDungeonKinds();
  if (!dungeonCatalog.includes('# Dungeon Generator Kinds')) throw new Error('Dungeon catalog generation failed');

  for (const k of dungeonKinds) {
    const startTime = Date.now();
    const result = await generateDungeon({
      kind: k.id,
      seed: 'dungeon-seed-42',
      width: 64,
      height: 64,
    });
    const elapsed = Date.now() - startTime;

    console.log(`Dungeon [${k.id}]: ${result.stats.totalRooms} rooms (${result.stats.criticalPathRooms} critical, ${result.stats.sidePathRooms} side, ${result.stats.hiddenRooms} hidden), ${result.stats.totalConnections} connections, ${result.stats.floorCells} floor tiles (${(result.stats.floorRatio * 100).toFixed(1)}%), generated in ${elapsed}ms`);

    if (result.stats.totalRooms === 0) throw new Error(`Dungeon ${k.id} generated 0 rooms`);
    if (result.stats.floorCells === 0) throw new Error(`Dungeon ${k.id} generated 0 floor cells`);
    if (result.stats.criticalPathRooms === 0) throw new Error(`Dungeon ${k.id} has 0 critical path rooms`);
  }

  console.log('\nAll shaper and dungeon tests passed successfully.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

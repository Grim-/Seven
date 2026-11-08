import {
  exportToTmj,
  exportToTmjString,
  generateDungeon,
  generateMap,
} from './index.js';

async function run() {
  console.log('--- Testing Stage 4: Tiled TMJ Export ---');

  const overworld = await generateMap({
    shaper: 'stamped',
    seed: 'tmj-test-1',
    width: 64,
    height: 64,
  });

  const overworldTmj = exportToTmj(overworld, {
    tileWidth: 32,
    tileHeight: 32,
    tilesetSource: 'overworld.tsx',
  });

  if (overworldTmj.type !== 'map' || overworldTmj.width !== 64 || overworldTmj.height !== 64) {
    throw new Error('Overworld TMJ export failed basic structure checks');
  }
  if (overworldTmj.layers.length < 2) {
    throw new Error('Overworld TMJ missing layers');
  }
  if (overworldTmj.layers[0].data.length !== 64 * 64) {
    throw new Error('Overworld layer data size mismatch');
  }

  console.log(`Overworld TMJ exported successfully: ${overworldTmj.width}x${overworldTmj.height}, ${overworldTmj.layers.length} layers`);

  const dungeon = await generateDungeon({
    kind: 'cavern',
    seed: 'tmj-test-2',
    width: 64,
    height: 64,
  });

  const dungeonTmj = exportToTmj(dungeon, {
    tileWidth: 32,
    tileHeight: 32,
    tilesetSource: 'cave_tileset.tsx',
  });

  if (dungeonTmj.layers.length !== 3) {
    throw new Error(`Expected 3 layers in dungeon TMJ, got ${dungeonTmj.layers.length}`);
  }

  const structuresLayer = dungeonTmj.layers.find((l) => l.name === 'Structures');
  if (!structuresLayer || structuresLayer.type !== 'objectgroup') {
    throw new Error('Structures objectgroup missing from dungeon TMJ');
  }

  const roomObjects = structuresLayer.objects.filter((obj) => obj.type === 'area' || obj.type === 'entrance' || obj.type === 'exit');
  const entrance = structuresLayer.objects.find((obj) => obj.name === 'Dungeon_Entrance');
  const exit = structuresLayer.objects.find((obj) => obj.name === 'Dungeon_Exit');

  console.log(`Dungeon TMJ exported successfully: ${dungeonTmj.width}x${dungeonTmj.height}, ${structuresLayer.objects.length} objects (${roomObjects.length} room areas, entrance: ${entrance ? 'yes' : 'no'}, exit: ${exit ? 'yes' : 'no'})`);

  if (!entrance || !exit) {
    throw new Error('Dungeon TMJ missing entrance or exit interactor points');
  }

  const chunkedDungeon = exportToTmj(dungeon, {
    infinite: true,
    chunkSize: 16,
  });

  if (!chunkedDungeon.infinite) {
    throw new Error('Chunked TMJ export infinite flag not set');
  }
  const chunkedGround = chunkedDungeon.layers[0];
  if (!chunkedGround.chunks || chunkedGround.chunks.length === 0) {
    throw new Error('Chunked TMJ layer missing chunks array');
  }

  console.log(`Chunked TMJ exported successfully: ${chunkedGround.chunks.length} chunks (chunkSize: 16)`);

  const tmjString = exportToTmjString(dungeon);
  const parsed = JSON.parse(tmjString);
  if (parsed.layers.length !== 3) {
    throw new Error('Parsed TMJ JSON string validation failed');
  }

  console.log('All Stage 4 TMJ export checks passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

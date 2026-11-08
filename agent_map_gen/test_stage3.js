import {
  discoverAnchors,
  generateDungeon,
  generateMap,
  toAgentMarkdown,
} from './index.js';

async function run() {
  console.log('--- Testing Stage 3: Semantic Anchor Discovery ---');

  const dungeon = await generateDungeon({
    kind: 'crypt',
    seed: 'stage3-dungeon-seed',
    width: 60,
    height: 60,
  });

  const dungeonAnchors = discoverAnchors(dungeon, { name: 'The Sunken Crypt' });

  if (dungeonAnchors.kind !== 'dungeon:crypt') {
    throw new Error(`Unexpected anchor kind: ${dungeonAnchors.kind}`);
  }

  const areaKeys = Object.keys(dungeonAnchors.areas);
  const placeKeys = Object.keys(dungeonAnchors.places);
  const transKeys = Object.keys(dungeonAnchors.transitions);

  console.log(`Dungeon anchors discovered: ${areaKeys.length} areas, ${placeKeys.length} places, ${transKeys.length} transitions`);

  if (areaKeys.length < 2) {
    throw new Error('Expected at least 2 areas in dungeon');
  }
  if (placeKeys.length < 2) {
    throw new Error('Expected at least 2 places in dungeon');
  }

  const entranceArea = dungeonAnchors.areas['entrance_antechamber'];
  const innerSanctum = dungeonAnchors.areas['inner_sanctum'];

  if (!entranceArea) {
    throw new Error('Missing entrance_antechamber area');
  }
  if (!innerSanctum) {
    throw new Error('Missing inner_sanctum area');
  }

  const centerPlaceId = entranceArea.placeIds[0];
  const centerPlace = dungeonAnchors.places[centerPlaceId];
  if (!centerPlace || !Number.isInteger(centerPlace.x) || !Number.isInteger(centerPlace.y)) {
    throw new Error('Invalid center place coordinates in entrance');
  }

  const resolvedCoords = dungeonAnchors.resolveCoordinates(centerPlaceId);
  if (!resolvedCoords || resolvedCoords.x !== centerPlace.x || resolvedCoords.y !== centerPlace.y) {
    throw new Error('Failed to resolve place coordinates');
  }

  const boundResult = dungeonAnchors.bindSheet(centerPlaceId, '@sheet:paladin_hero', { role: 'player' });
  if (boundResult.placeId !== centerPlaceId) {
    throw new Error('Failed to bind sheet to place');
  }

  const occupantsAtPlace = dungeonAnchors.getOccupants(centerPlaceId);
  if (!occupantsAtPlace.includes('@sheet:paladin_hero')) {
    throw new Error('Occupants lookup failed for place');
  }

  const occupantsInArea = dungeonAnchors.getOccupants(entranceArea.id);
  if (!occupantsInArea.includes('@sheet:paladin_hero')) {
    throw new Error('Occupants lookup failed for area');
  }

  const entranceMarkdown = toAgentMarkdown(dungeonAnchors, { areaId: entranceArea.id });
  if (!entranceMarkdown.includes('@sheet:paladin_hero') || !entranceMarkdown.includes(entranceArea.name.toUpperCase())) {
    throw new Error('Agent area markdown formatting failed');
  }

  const fullDungeonMarkdown = toAgentMarkdown(dungeonAnchors);
  if (!fullDungeonMarkdown.includes('# World Map: The Sunken Crypt') || !fullDungeonMarkdown.includes('## Areas')) {
    throw new Error('Agent full dungeon markdown formatting failed');
  }

  console.log('Dungeon Semantic Anchors verified successfully.');

  const overworld = await generateMap({
    shaper: 'stamped',
    seed: 'stage3-overworld-seed',
    width: 64,
    height: 64,
  });

  const overworldAnchors = discoverAnchors(overworld, { name: 'Emos Domain' });

  if (!overworldAnchors.areas['central_plains']) {
    throw new Error('Overworld missing central_plains area');
  }
  if (!overworldAnchors.places['the_village']) {
    throw new Error('Overworld missing the_village place');
  }

  overworldAnchors.bindSheet('the_village', '@sheet:testmw2cemg3');
  const villagePlaceMarkdown = toAgentMarkdown(overworldAnchors, { placeId: 'the_village' });
  const plainsAreaMarkdown = toAgentMarkdown(overworldAnchors, { areaId: 'central_plains' });

  if (!villagePlaceMarkdown.includes('@sheet:testmw2cemg3') || !villagePlaceMarkdown.includes('THE VILLAGE')) {
    throw new Error('Overworld village place markdown projection failed');
  }

  if (!plainsAreaMarkdown.includes('@sheet:testmw2cemg3') || !plainsAreaMarkdown.includes('CENTRAL LOWLANDS')) {
    throw new Error('Overworld plains area markdown projection failed');
  }

  console.log('Overworld Semantic Anchors verified successfully.');
  console.log('Sample Single Place Markdown for Agent DM:');
  console.log('----------------------------------------');
  console.log(villagePlaceMarkdown);
  console.log('----------------------------------------');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

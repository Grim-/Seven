export interface Whereabouts {
  world: string
  worldName: string
  save: string
  saveName: string
  map: string | null
  mapName: string | null
  place: string | null
  placeName: string | null
  when: string | null
}

export interface Destination {
  world: string
  worldName: string
  map: string
  mapName: string
  place: string
  placeName: string
}

export const destinationKey = (d: Pick<Destination, 'world' | 'map' | 'place'>): string => JSON.stringify([d.world, d.map, d.place])

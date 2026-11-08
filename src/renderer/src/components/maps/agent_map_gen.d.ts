declare module 'agent_map_gen' {
  export interface DungeonRoomResult {
    id: number;
    type: string;
    tags: string[];
    isOnCriticalPath: boolean;
    criticalPathIndex: number;
    center: { x: number; y: number };
    bounds: { x: number; y: number; width: number; height: number };
    connectedRooms: number[];
  }

  export interface DungeonConnectionResult {
    roomA: number;
    roomB: number;
    pathLength: number;
  }

  export interface DungeonGenResult {
    width: number;
    height: number;
    seed: number;
    kind: string;
    floorMask: Uint8Array;
    rooms: DungeonRoomResult[];
    connections: DungeonConnectionResult[];
    stats: {
      totalCells: number;
      floorCells: number;
      floorRatio: number;
      totalRooms: number;
      criticalPathRooms: number;
      sidePathRooms: number;
      hiddenRooms: number;
      totalConnections: number;
    };
    dungeon?: any;
  }

  export interface OverworldGenResult {
    width: number;
    height: number;
    seed: number;
    shaperId: string;
    mask: Uint8Array;
    fields: Record<string, unknown>;
    stats: {
      totalCells: number;
      landCells: number;
      barrierCells: number;
      rimCells: number;
      landRatio: number;
    };
  }

  export function generateDungeon(options?: {
    kind?: string;
    seed?: string | number;
    width?: number;
    height?: number;
    config?: Record<string, unknown>;
    customDefs?: Record<string, unknown>;
    loading?: any;
  }): Promise<DungeonGenResult>;

  export function generateMap(options?: {
    shaper?: string;
    seed?: string | number;
    width?: number;
    height?: number;
    config?: Record<string, unknown>;
    origin?: { x: number; y: number };
    context?: Record<string, unknown>;
    loading?: any;
  }): Promise<OverworldGenResult>;

  export function resolveDungeonTiles(
    dungeonResult: DungeonGenResult,
    options?: { firstGid?: number; wallGid?: number; floorGid?: number }
  ): {
    groundTiles: number[];
    collisionTiles: number[];
    width: number;
    height: number;
  };

  export function resolveOverworldTiles(
    mapResult: OverworldGenResult,
    options?: { firstGid?: number }
  ): {
    groundTiles: number[];
    collisionTiles: number[];
    width: number;
    height: number;
  };

  export function renderMapToCanvas(
    canvas: HTMLCanvasElement,
    mapResult: any,
    options?: Record<string, unknown>
  ): void;

  export const DEFAULT_PALETTE: Record<string, unknown>;
}

export interface GameExecutionContext {
  world: string
  map: string
  sheet: string                        // Active player sheet ID
  party: string[]                      // Party member sheet IDs
  flags: Record<string, unknown>       // Active world/save flags

  // Engine & IPC access
  engine: <T = unknown>(method: string, payload?: unknown) => Promise<T>

  // Direct 2D game state primitives
  warp: (mapId: string, at?: { x: number; y: number } | string) => Promise<void>
  giveItem: (itemId: string, count?: number, gold?: number) => Promise<void>
  removeItem: (itemId: string, count?: number) => Promise<void>
  setFlag: (flag: string, value: unknown) => Promise<void>
  modifyHealth: (target: 'player' | 'party' | 'target', amount: number) => Promise<void>
  spawnCreature: (creatureId: string, factionId?: string, at?: { x: number; y: number }) => Promise<void>
  startCombat: (encounterId: string) => Promise<void>
  playCue: (cueId: string, sound?: string) => Promise<void>
  notify: (text: string, tone?: 'accent' | 'cyan' | 'warn' | 'danger') => void
}

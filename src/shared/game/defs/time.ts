import { registerDefType } from './defs'

registerDefType({
  type: 'clock',
  label: 'Clock',
  plural: 'Clocks',
  icon: 'clock',
  description: 'how game time runs: how fast it passes, the length of a tick, an hour and a day, speed limits and the length of a battle round',
  params: {
    gameSecondsPerRealSecond: { label: 'Game seconds per real second', kind: 'number', default: 60, min: 0, description: 'Game seconds that pass each real second at 1× speed. 60 makes a game hour a real minute.' },
    tickSeconds: { label: 'Tick length (s)', kind: 'number', default: 3600, min: 1, description: 'Game seconds in one world tick. Each tick runs regeneration, buffs and drains.' },
    hourSeconds: { label: 'Hour length (s)', kind: 'number', default: 3600, min: 1, description: 'Game seconds in an hour.' },
    hoursPerDay: { label: 'Hours per day', kind: 'number', default: 24, min: 1, description: 'Hours in a day, for the day and night cycle.' },
    minSpeed: { label: 'Slowest speed', kind: 'number', default: 0.25, min: 0.01, description: 'The slowest speed allowed.' },
    maxSpeed: { label: 'Fastest speed', kind: 'number', default: 8, min: 0.01, description: 'The fastest speed allowed.' },
    maxCatchUpTicks: { label: 'Most ticks at once', kind: 'number', default: 24, min: 1, description: 'The most ticks run at once after a long gap, so a slow frame never runs days.' },
    roundSeconds: { label: 'Battle round (s)', kind: 'number', default: 6, min: 1, description: 'Game seconds in a battle round. An actor that ends its turn moves on by this much.' }
  },
  starter: [{ id: 'standard', name: 'Standard', notes: 'A game hour is a real minute at 1×; one tick is an hour.', values: {} }],
  line: (def) => `${String(def.values.gameSecondsPerRealSecond)} game s per real s, tick ${String(def.values.tickSeconds)} s, round ${String(def.values.roundSeconds)} s`,
  addTo: (data, def) => {
    const v = def.values
    data.times.push({
      id: def.id,
      label: def.name,
      roundSeconds: Number(v.roundSeconds),
      clock: {
        tickSeconds: Number(v.tickSeconds),
        gameSecondsPerRealSecond: Number(v.gameSecondsPerRealSecond),
        hourSeconds: Number(v.hourSeconds),
        hoursPerDay: Number(v.hoursPerDay),
        minSpeed: Number(v.minSpeed),
        maxSpeed: Number(v.maxSpeed),
        maxCatchUpTicks: Number(v.maxCatchUpTicks)
      }
    })
  }
})

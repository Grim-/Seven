import { registerDefType } from './defs'

registerDefType({
  type: 'clock',
  label: 'Clock',
  plural: 'Clocks',
  icon: 'clock',
  description: 'game time: the length of an hour, a day and a battle round, rest lengths, dawn and default exit travel time',
  params: {
    hourSeconds: { label: 'Hour length (s)', kind: 'number', default: 3600, min: 1, description: 'Game seconds in an hour.' },
    hoursPerDay: { label: 'Hours per day', kind: 'number', default: 24, min: 1, description: 'Hours in a day, for the day and night cycle.' },
    roundSeconds: { label: 'Battle round (s)', kind: 'number', default: 6, min: 1, description: 'Game seconds in a round.' },
    shortRestSeconds: { label: 'Short rest', kind: 'duration', default: 3600, min: 1, description: 'Game seconds a short rest takes.' },
    longRestSeconds: { label: 'Long rest', kind: 'duration', default: 28800, min: 1, description: 'Game seconds a long rest takes.' },
    longRestGapSeconds: { label: 'Between long rests', kind: 'duration', default: 86400, min: 0, description: 'Game seconds from the end of one long rest before another can start.' },
    dawnHour: { label: 'Dawn hour', kind: 'number', default: 6, min: 0, description: 'Hour of the day dawn falls on.' },
    defaultExitSeconds: { label: 'Exit travel', kind: 'duration', default: 60, min: 0, description: 'Game seconds travelling through an exit takes when the exit sets none.' },
    initiativeCheck: { label: 'Initiative check', kind: 'template', templateKind: 'check', default: 'dex', description: 'Check rolled to determine turn order when battle begins.' },
    parleyCheck: { label: 'Parley check', kind: 'template', templateKind: 'check', default: 'persuasion', description: 'Check rolled by a speaker attempting to negotiate or recruit in combat.' },
    parleyDefenseCheck: { label: 'Parley contest check', kind: 'template', templateKind: 'check', default: 'insight', description: 'Check rolled by the target resisting a parley attempt.' },
    speedStat: { label: 'Speed stat', kind: 'template', templateKind: 'stat', default: 'speed', description: 'Stat read for tactical movement feet per turn.' },
    encounterJoinRadius: { label: 'Encounter join radius (ft)', kind: 'number', default: 60, min: 0, description: 'Distance in feet around a fight within which nearby creatures join initiative.' },
    tileFeet: { label: 'Tile size (ft)', kind: 'number', default: 5, min: 1, description: 'Feet per map grid tile used for movement and spell range.' }
  },
  starter: [{ id: 'standard', name: 'Standard', notes: 'D&D time: 6 s rounds, 1 h short rest, 8 h long rest.', values: {} }],
  line: (def) => `round ${String(def.values.roundSeconds)} s, short rest ${String(def.values.shortRestSeconds)} s, long rest ${String(def.values.longRestSeconds)} s`,
  addTo: (data, def) => {
    const v = def.values
    data.times.push({
      id: def.id,
      label: def.name,
      roundSeconds: Number(v.roundSeconds),
      shortRestSeconds: Number(v.shortRestSeconds),
      longRestSeconds: Number(v.longRestSeconds),
      longRestGapSeconds: Number(v.longRestGapSeconds),
      dawnHour: Number(v.dawnHour),
      defaultExitSeconds: Number(v.defaultExitSeconds),
      initiativeCheck: String(v.initiativeCheck || 'dex'),
      parleyCheck: String(v.parleyCheck || 'persuasion'),
      parleyDefenseCheck: String(v.parleyDefenseCheck || 'insight'),
      speedStat: String(v.speedStat || 'speed'),
      encounterJoinRadius: Number(v.encounterJoinRadius),
      tileFeet: Math.max(1, Number(v.tileFeet) || 5),
      clock: {
        hourSeconds: Number(v.hourSeconds),
        hoursPerDay: Number(v.hoursPerDay)
      }
    })
  }
})

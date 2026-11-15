# Part 2.6: world clock and battle time

Built in `shared/game/core/clock.ts` (typechecked; tested speed, pause, ticks, calendar, daylight and per-hour rates).

- **`GameClock(config, step)`:** the engine's loop calls `advance(realSeconds)`. That runs `step(tickSeconds)` once per due tick, which is where the world calls `tickSim` on its entities.
  - Speed is between `minSpeed` and `maxSpeed`, and pause stops it.
  - Catch-up is capped by `maxCatchUpTicks`.
  - Config: `tickSeconds`, `gameSecondsPerRealSecond`, `hourSeconds`, `hoursPerDay`, the speed limits and the catch-up cap. All of it is data.
- **`calendar()`:** day, hour, minute and `daylight` (0 at midnight, 1 at noon) for the day-night cycle.
- **`perTick(amount, unit)`:** turns a rate per second, minute, hour or day into the amount per tick. Hourly Stamina drain and HP recovery are rates like this.
- **Battle:** the clock is paused. When an actor ends its turn it runs `turnTicks(roundSeconds, tickSeconds)` of its own `tickSim`, so buffs and regen behave the same in both.
- `toJSON` / `fromJSON` keep the clock in the world's save.

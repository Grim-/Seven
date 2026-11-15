# 7. Click to move

Explore moves the player's character by clicking the map. Everything here works the same for any map.

## Walkable grid (`shared/game/nav/grid.ts`)

- `NavGrid` covers the map in cells the size of the map's tile (1 tile = 5 ft).
- A cell is open or blocked. `block(c, r)` marks one.
- `clear(a, b)` walks the cells a straight line crosses. It is blocked by any blocked cell, and by squeezing between two blocked cells that only touch at a corner.
- `nearestOpen(c, r)` finds the closest open cell, ring by ring.
- Nothing marks cells blocked yet: maps have no wall or blocked-tile data. Painting walls and walkable areas is part 11. Until then every cell is open and the party walks in straight lines.

## Paths (`shared/game/nav/path.ts`)

- `findPath(grid, from, to)` returns the points to walk through, not including `from`. `null` means there is no way there.
- If the straight line is clear, it is one point: the click.
- Otherwise A* over the cells, 8 directions, no corner cutting, real distances (cells can be wider than tall). The cell route is then pulled tight: each point goes as far ahead as a clear line allows, so the walk is free movement, not tile steps.
- Clicking a blocked cell walks to the nearest open one. Starting inside a blocked cell walks out first.
- Tested in isolation (open map, a wall with a gap, a blocked click, a walled-off target, a corner gap, a 125 × 125 map).

## In the Explore scene

- A left click on the map (not on a token or object) walks the player's token there when it is on this map. With no token there, the click picks the place as before.
- A marker shows where it is going: accent ring, or a red ring that fades when there is no way there.
- `Walk` moves the token along the points at 4 tiles a second, with a small step bob.
- The camera follows only when the walker gets within a quarter of the screen edge, so panning while walking isn't fought.
- Dragging the token stops the walk.
- On arrival the scene emits `arrive` with the sheet, the point and the place under it. Play saves the standing point and the character's place (the same as dropping the token there) and opens that place's card.

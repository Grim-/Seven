# 9. Saves, the world clock and the HUD

## Saves (`shared/game/save.ts`, `engine/worlds/saves.ts`, `playLayer.ts`, `party.ts`)

A world is a template; a save is one playthrough of it. Everything that happens in play is in the save, laid over the world when it is read.

- Saves are kept outside the worlds, in `saves/<id>.json`, each naming its world. `saves/current.json` says which save each world is showing.
- A save holds: the clock, flags, used once-only triggers, creatures, its **characters** (each one's game state and where they are), **standing points** per map, **records** written in play (an entity, or `null` for one removed), the **journey** and the **board**.
- **The world store reads through the current save** (`PlayLayer`): records, standing points, journeys and the board come from the template with the save over them. Writes choose a layer: the Records and Maps tabs and the world-building tools write the template; the agent's memory tools (world_remember) write the save; standing points, journeys and board posts always go to the save. `worlds.records` / `worlds.changes` take `layer` (`template` for the builder screens, `play` otherwise).
- **Characters:** a character is in one save at a time; their sheet records which (`save`). While in a save, `getSheet` shows their game state, rule set and where from the save, and changes to those go to the save (`setSheetLayer` in `engine/library/sheets.ts`). Their sheet's own where line is kept for when they leave.
- `party.ts`: `bring(save, sheet)` puts a character in a save, taking them out of another first; `takeOut(sheet)` writes their state back onto the sheet and removes them and their standing points from the save; `removeSave` takes everyone out first; `removeWorldSaves` does that for every save of a deleted world; `adoptOldPlay(world)` is the one-off move of a world's old play state (characters whose where is in it or who stood on its maps, their standing points, journeys and the board) into its current save.
- A standing point for a character who isn't in the save is refused. Putting a character on the map, Start here and Put a character here bring them in first (`bringHere` in the renderer); one playing in another save is moved after you confirm.
- Presence (who is where) lists only the characters in the world's current save.
- **Chats keep their save:** the first time a chat touches a world, it is tied to the save that world is showing (`saves/chats.json`); its reads and writes stay with that save even after the world switches to another (`saveInPlay` in `playLayer.ts`).
- `travel(sheet, save, map, place)`: into another world's save at a place on one of its maps (the middle of the map with no place), out of the save they were in; that save becomes the one its world shows.
- **Rules that don't fit:** joining a save, Seven lists what the character carries that the world's rule set lacks (`game.misfits`); it is kept as it is.
- The card hand stays with the character's deck; since a character is in one save at a time, it goes where they go.
- Engine requests: `saves.travel`, `saves.list` (a world's saves), `saves.all`, `saves.get`, `saves.current`, `saves.create` (new; or a copy of the current save's world state without its characters), `saves.select`, `saves.rename`, `saves.remove`, `saves.bring`, `saves.takeOut`, `saves.adopt`, `saves.markUsed`, `saves.setFlag`, `saves.writeClock`; event `saves.changed`.
- In the app: the save picker in Play (switch, new, copy, rename, Bring in the old play state, delete); **Saves** in the library's Game group (each save's world, flags and characters, Take out, Play, Delete); a character's Game tab says which save they are playing in, with Take out of this save.
- Tested: cleaning a save; Valerius brought into 001, his where and game state stored in it; a record written in play stays in 001 and 002 has its own; moving him to 002 takes him out of 001 with his state; taking him out puts his state on his sheet and gives back his own where line; deleting a save frees its characters; old standing points and journeys move in with adopt; a standing point for someone not in the save is refused; shapes go to the world and standing points to the save; travelling into another world's save at a dock places him in its middle and takes him out of the first; a chat keeps writing to the save it started in after its world switches saves.

## The clock in Play

- `WorldClock` (`renderer/src/game/explore/`) runs a `GameClock` from the save's Clock definition (the first one if the save names none, or one that's gone) inside the Explore scene's update, so it runs only while Play is open.
- Each world tick the scene sends `tick`; Play asks the engine to run that many seconds on every character on the map who is in the game (`game.tickCharacters`: regeneration, Stamina drain, buffs, damage over time), and their state is written to their save.
- The clock state is written to the save on every tick, on pause and speed changes, and when Play closes. The part of an hour already passed is kept, so the time shown never jumps back.
- The map darkens at night from the calendar's daylight (up to 55%).
- `GameClock.now` is the time including the part tick; the calendar uses it. Pausing no longer throws the part tick away.
- Tested: 30 real seconds at 1× is 30 game minutes with no tick; a pause keeps it; the next 30 seconds ticks the hour; a saved and loaded clock carries on from the same minute; saves clean bad values.

## HUD (`renderer/src/components/play/hud/`)

- `ClockHud`: the sun or moon on an arc for the time of day, the day, hh:mm, pause, and the speeds the Clock allows out of 1×, 2×, 4×, 8×.
- `PartyHud`: every character on this map who is in the game, yours first, with portrait, name and resource bars; clicking one opens their panel.

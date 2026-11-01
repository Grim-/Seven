# World maps: first revisions and rethinks

Plan only. Nothing here is built yet. Each step that changes what you see starts with a mockup.

## Why

The map screen today is an editor that you also have to play in. A world gets set up once and played many times, so playing needs its own view. Maps are also stuck inside the world that made them, even though a map is a picture of a place and several worlds or stories could use it. Layers can hold only one thing each, which doesn't match how maps are built in Tiled. And several basics are missing: you can't delete a place, you can't move a character, and a roll is just a line of text.

## 1. Fixes (small, do first)

- **Delete places.** Add Delete to a place's card and to its right-click menu in the place tree. Ask first. Say what happens to the places inside it (they move up a level), and remove its shape from every map.
  - Why: right now the only way to get rid of a place is to edit the files by hand.
- **Remove someone from "Who is here".** Add a remove action on each row that clears the character's place in this world. Their sheet is not touched.
- **Clipped popups.** "Who is here", place tooltips and the decision builder are cut off by the map's edges. Draw them through the same portal that `TooltipHost` uses, kept inside the window, like the other windows were fixed.
- **The right panel floats over the map.** It stops taking width from the map. Clicking empty map, or pressing Escape, closes it.
- **Loading screen.** Show one while a world and its map load, with what is loading. Worlds will get big.
- **Imports stay where you are, everywhere in Seven.** Adding or dropping any file (a picture for a character sheet, a map, anything else) never switches views. The toast says what was added and has an Open button, which is the only thing that takes you there. This uses the existing toast; there's no new kind of notification.
  - Why: adding a picture to use as a character's portrait currently sends you to Files, and you have to find your way back to the sheet to use it.
- **One picture viewer.** Left-clicking a picture opens the same viewer as right-click → Open. The old viewer is removed.
  - Why: two viewers for the same thing, and the one you get by default is the old one.

## 1b. Clicks and menus equal to buttons

This applies to everything below and to every mockup.

- **Shapes:**
  - Left-click a shape to select it. Once selected, it can be moved, resized or have its points dragged.
  - Right-click a shape for its menu: Edit outline, Rename, Open place, Delete.
  - The panel's buttons do the same things. Neither is the only way.
- **Adding things:**
  - Right-click empty map for: New place here, Place an object here, Put a character here. A new place starts as an outline drawn from that spot.
  - Right-click a place, object or character for its own menu. For example, a place offers New place inside, Start here, Continue here, Delete. A character offers Move to, Remove from here, Open sheet.
- **Actions at the bottom of the panel.** A place's panel puts what you can do in a row or grid of clear buttons at the bottom, so they read as things to do rather than fields to fill in. That covers Continue here, Start here and New decision.
  - **Continue here** opens the prompt composer, to start a chat at this place or carry on the one there.
- **Menus act on what was clicked.** With the panel open on one object, right-click → Edit on another switches the panel to that one.
- Why: clicking is contextual, because you click a specific thing or spot. Acting on it right there saves clicks, and the panel's actions read as actions rather than data.

## 2. Actions and decisions

These are two separate mechanics, and the agent must never mix them up.

- **An action** is something attempted, with outcomes that depend on checks: "cast a fireball at the gate", "convince the guard". It is rolled (d20 + the sheet bonus against a target, any or all checks), and the result picks the outcome. Nobody chooses the outcome.
- **A decision** is a choice someone makes between options: "Where do you go next?" with a few options to get you thinking. Nothing is rolled.
- Why: if an action with outcomes is presented as a choice, the agent gets confused about whether it should decide, ask, or play out a result. The words it receives must say which one it is.

What is built today as a "decision" (checks, outcomes, `decision_check`, the place's Decisions field) is really an **action**. It gets renamed to action throughout: the type, the tool, the place field, the builder and the docs. The roll maths stays as it is.

### Actions

- **Rolling is an event.** Rolling opens a modal showing:
  - the character's portrait
  - each check's d20 rolling, then landing with bonus, total and target
  - pass or fail
  - the outcome text
  - **Play this out**, when you aren't already in a chat. It starts a chat at the place (like Continue here) with the result as the first message.

  When an agent rolls, the same card shows up in its chat, as it does now.
- **What the agent is told:** what was attempted, how it turned out, and to play out that outcome. For example: "The user attempted to convince the guard. It failed (Charisma 8 − 1 = 7 against 12): he calls for help. Play this out."
- **Who rolls:** you (your character in this world by default) or an agent (their character).

### Decisions

- **A question with options** (and room for an answer of your own), plus **who decides**: you or an agent.
- **You decide:** the agent is told to ask you the question with those options (ask_user) and to carry on from your answer.
- **An agent decides:** the question and options go to that agent, and its choice is what happens.
- **What the agent is told:** that this is a choice to be made, who makes it, and the options. It never comes with a roll or a pass/fail.
- Places keep decisions next to their actions.

- Mockup first: `mockups/decisions.html` becomes actions and decisions, with the roll modal, the decision prompt and the who-rolls / who-decides control.

## 3. Maps and worlds split

- **Maps** is its own screen, where maps are made: tiles, layers, objects, imports. A map belongs to no world.
- **Worlds** use maps. Places, their shapes on a map, characters, where they stand, decisions and journeys are all saved in the world.
- A world picks one or more maps. The same map can appear in two worlds, each with its own places drawn on it.
- **Moving what exists:** maps saved under `worlds/<id>/maps/` move to the maps store, and their place shapes move into the world. This is a one-time move in the engine, checked by the storage check.
- **Shared by link.** A world links to the maps it uses, so editing a map changes it in every world that uses it. Two worlds share a map only when you choose that map for both.
- Mockup first: a Maps screen and the world's map picker.

## 4. Play view and edit view

- A world opens in **Play** by default. You see:
  - the map, big
  - your character and who is here
  - the place you're at, with its Now text and decisions
  - the chat
  - the journey so far

  Building tools are hidden.
- **Edit** (a toggle) shows the building tools: places, shapes, layers, objects, setting up characters and decisions.
- **Start here** (on a place, in Edit) sets where play begins and switches to Play. Continue here stays as it is (the composer sets up anything extra), but the playing happens in Play.
- Why: setting up and playing are different jobs, and playing shouldn't be crowded with editing controls. It's the same screen, with what's in front changed.
- Mockup first: the same world shown in Play and in Edit.

## 5. Layers rethink

- A layer is a **group of visuals**, not one thing. It holds any mix of tile maps, pictures and objects (section 6), each with its own position.
- Every layer gets a **zoom range**: show only between a minimum and maximum zoom. For example, a tavern's roof shows when zoomed out over the overworld and hides when zoomed in, and the interior layer underneath shows instead.
- Layers nest, as groups do now. Visibility, opacity and offset stay.
- **Tiled import:** group layers become layers holding their children. A layer's own offset from Tiled is kept, so an interior placed in Tiled lands in the right spot.
  - Zoom ranges are set in Seven, in the map editor's layer settings. They are not read from Tiled.
- Why: the current one-layer-one-thing model can't describe an overworld with a building that opens up, which is the main reason to have layers.

## 6. Map objects

- An object is a **picture placed freely on the map** (a rock, a bridge, a door, a scroll), not tied to the tile grid. You can move it, resize it, and draw an outline around it like any shape. Objects live in layers.
- An object is **a generic jumping-off point**, not a link to a specific place. A door is just a door: using it starts a chat there (with the object linked, like Continue here), or rolls one of its actions, or puts one of its decisions. It holds Actions and Decisions like a place does ("Force the door", "Which way down?").
- An object can also **open an entry** (a page shown as the scroll). Following the kind rules, what opening does comes from the entry's kind; the object only holds the link.
- Right-click or its panel: Continue here, its actions and decisions, Open (if it links an entry), Edit, Outline, Move to layer, Delete.
- Objects belong to the map, so the same door, with its actions and decisions, is in every world that uses that map. Being generic, nothing in it is tied to one world's story.
- Mockup: `mockups/maps-play-edit.html`.

## 7. Characters on the map

- Characters stand at a **free position** on the map, saved per world. You move them by dragging. The grid is only for reference.
- Dropping a character inside a place's shape puts them in that place, so "Who is here" updates.
- **Journey (last):** a log per character, per world. It records the path they took, places entered and left, and decisions made with their outcomes, in order. You read it as a journal on the character in Play, and it can be drawn as a trail on the map. It builds on the change records worlds already keep.

## Order

1 → 2 → mockups for 3, 4, 5 and 6 together (they change the same screen and data) → 3 → 4 → 5 → 6 → 7.

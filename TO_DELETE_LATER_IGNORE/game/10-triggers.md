# 10. Triggers

A trigger is an area on a map that starts something when a character walks in or when you click it.

## Data (`shared/game/triggers/`)

- `TriggerDef`: id, name, type, shape (an area, like a place's), `fires` (`enter` or `interact`), `once`, `needsItem` (an item the character must carry), `needsFlag` (a flag set earlier in this save), `setsFlag`, and the type's own values.
- Triggers are kept on the world's map use (`WorldMapUse.triggers`), next to places and standing points. A trigger whose type Seven doesn't know is dropped when the map use is read.
- Each trigger type registers itself from its own file (`registerTriggerType`): label, icon, description, when it fires by default, and its params (the same `ParamSchema` as everything else).
  - **Note** (`note`, click): shows text.
  - **Actions and decisions** (`play`, click): the same actions and decisions as places and objects, rolled and decided the same way.
  - **Give an item** (`give_item`, click): an item from the Items, how many, gold, and text; Take puts them in the character's inventory (`game.giveItem`).
  - **Go to another map** (`change_map`, walk in): a map of this world and a place on it to arrive at (or its middle). The character's standing point moves to that map, their place is set, and Play switches to that map, which fades in.
  - **Go to another world** (`change_world`, walk in): a world, a map of it and a place to arrive at. The panel lists that world's saves (and A new save); picking one takes the character out of this save with their state, puts them in that one at the place, makes it the save that world shows, and opens that world (`saves.travel`). What their rule set lacks is listed.
  - **Check** (`check`, click): the character rolls a Check (from the rules data) against a difficulty, or against a creature rolling its own check (an opposed check; a tie goes to the creature). The difficulty can be hidden until the roll. A pass and a fail each have their own text and can set a flag in the save; a pass can find an item and gold to take.
  - **Rolled decision** (`rolled`, click): a die with one option per face, shown and rolled the same way as rolled decisions in chat.
- Tested: the four types register; a new trigger takes its type's defaults; values are cleaned by the type's params; an unknown type or a missing shape is dropped; a way out fires on enter.

## In Play

- Trigger areas are drawn in purple (places stay cyan); the pointer over one shows its name.
- Walking into an `enter` trigger starts it. Clicking inside an `interact` trigger walks there and starts it on arrival, or starts it at once if the character is already inside.
- Before it starts: a missing item says which item is needed, a missing flag says "Not yet." When it starts: if it is once only or sets a flag, the save records it (`saves.markUsed`); a once-only trigger then disappears from that save.
- **Checks in play:** the panel shows what is tried and the check, then **Who rolls?** with every character on the map who is in the game and their bonus (the one who started it is picked). Roll shows the dice tumbling, then the roll, the bonus, the total and what it needed, a second tally for the creature in an opposed check, Success or Failure, the pass or fail text, the item to take, and Play this out. The result goes in the roller's journey, and the pass or fail flag is set in the save (`saves.setFlag`). Rolls are not seeded; they use the same dice as the other rolls.
- **Rolled decisions in play:** the options with Roll d*N*; the face rolled is marked, the journey notes it, and Play this out offers it to a chat. Fewer or more options than faces says so instead of rolling.
- Each type's game UI registers itself in `renderer/src/components/play/triggers/` (`registerTriggerUi(type, { Panel, run, Editor })`): a panel shown in the play window, or `run` for one that just happens (going to another map). `TriggerContext` gives the panel the world, character, the party (characters on the map in the game), save, catalog, close, go to a map, and a way to save the trigger's values.
- Right-click the map: **Add a trigger here** (by type; a 2 × 2 tile area), and **Edit** / **Delete** for any trigger under the pointer. The editor autosaves: name, starts on, once only, needs an item, needs a flag, sets a flag, width and height, then the type's own fields (its own editor when it has one, such as the map and place pickers for Go to another map).

## Not yet

- Placing and shaping triggers in the Maps builder (part 11); for now they are added and sized from Play.
- Rest, shop, conversation and combat triggers come with their parts.

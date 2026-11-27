# change-log

## Bug fixes

### Worlds, Maps & Places

- Changing a character's world from the sheet did nothing; the character stayed in their old world.
- Moving a character to another map left them standing on the old map as well.
- Place links were not being read back, so characters never showed up at their place.
- World events set at a place never reached that place's rumours.

### Links & Autocomplete

- Prompt hydration was not hydrating links when sent as the intial message to the agent.
   Links are now hydrated based on depth and count. Top-level links pull in the full entry once per message, and links nested inside it pull in only a brief with a link to the full entry, never expanded further.
- Link chips in inline fields (e.g. "Where they are now") were dead; they can be clicked and right-clicked again.
- Link autocomplete no longer pushes content down; the suggestion list floats over the field.

### Character Sheet & UI

- Relations tab clipped and overlapped its content.
- The story sidebar listed a character in their own cast, showed cast links as plain text, and its link chips opened the default Data view instead of the entry.
- Udpated most text fields to use the autocomplete field

### Factions, Data & Modules

- An agent updating a faction could accidently remove faction variables that were not specifically relist, now everything that isn't changed is kept as is (upserted).
- Data view indexing was duplicating calls when an empty search field ran a global search.
- Kinds from disabled modules now correctly unregister themselves when disabled.

## Changes

### Worlds, World Events & Almanac

- World Events, Factions, Knowledge, Places now belong to a world and are no longer a global kind due to being inherently tied to the context information of a world, to re use them in other worlds export them from that world and import them into the other, then you can change what you need to make it fit this world.
- world events can be triggered manually, by an agent or when certain conditions are met, these are checked whenever the worlds save state changes, when all conditions are met the world event starts, and you can opt to resolve it. A converter will run the first time you update backing up any data before converting them.
- World events have a "Takes place at" place picker (empty means everywhere), and each place lists the events active there.
- Updated the alamanac broadsheet to generate a sheet from the story beats within a given time frame. Almanac story overview, contains the entire overview, broadsheets are snap shots of events you can read back.
- Added a tool for the agent to advance time while in a chat session.
- An agent can no longer be assigned to a world instead just assign that agent a character that belongs to a world.

### Knowledge & WorldKnowledge

- A characters own personal knowledge superceeds the global knowledge, you can have a world where everyone understands the basics mechanics of the universe, then exclude that knowledge from a character specifically.
- Moved backstory & lore and memories & events from the general tab into a new Knowledge tab, Knowledge are memories, secrets (locally scoped knowledge that can be shared ad-hoc) and events and a characters back story. Knowledge can be tagged and set to autorecall when the tag is triggered, or not at all.
- Added WorldKnowledge - Lore Entries for a specific world, from 'Global' knowledge - commonly known things to local knowledge, known only by select characters. Knowledge can be gained or granted
- Added WorldKnowledge to the world codex for each world.
- Added CharacterKnowledge

### Character Sheet & Relations

- One location control on the character sheet and world roster shows the world, map, place and world time; move a character to any place in any world, or take them out.
- Added a dropdown so you can see which world a character is currently assigned to and unnassign or reassign them.
- Relations tab is now a list with the selected relation alongside, covering innate and campaign relations, edited in place.
- Added a button to quickly switch to a character sheets relation if that relation is also a character sheet.
- Updated Character Hostility matrix and added same matrix for faction Hostility relations.
- Mind tab now uses three full-height columns: reasoning, how they think, and voice filter.

### Factions

- Factions can be assigned stats, and a relative power value - used to decide outcomes, stats can be used in checks eg : you or the agent can check the Diplomacy stat (if defined - or any other) of a faction to determine any changes (opposed rolls, dc checks) to those stats from a meta-narrative scene outcome option.
- Factions can be assigned characteristics on how the agent should play them at a world level,
  - **Doctrine** - are they polite in public but plot in private? Do they have any cohesion or leader? A band of bandits can vary greatly between 'a loose collection of thiefs' to 'subtle mafiosos'
  - **Temprement** - Orderly? Scheming? Coridal? you can add custom temprements.
  - **Relative Power** - a simple value between 0-100, used for the simplest checks, a faction with a relative power score at 0 is effectively powerless, any factions at 100 are as strong as they can be and two of 100 would be equal.
- Added the ability to set overrides per faction relation, like characters.

### Links, UI, Skinning & Performance

- Broken links in a character's story can be fixed from the sheet sidebar; relink once and it updates everywhere in the story.
- Link text fields show their links as link chips when not being typed in.
- The sheet sidebar now uses the real link chips (inspect on click, right-click menu).
- The modular effects UI (called 'pieces') have been streamlined, all ability effects, items, spells, and world triggers now run through the same 'click and pick' interface.
- Tons of UX improvements, replacing remaining standard chat ui elements with their richer counterparts (fancier dropdowns, text fields etc).
- Added full skinning, css, nine sliced borders and corners, per surface skinning.
- Added caching for pages and kinds.

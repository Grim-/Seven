# RP-RPG World Generation Guide (For Outside Agents)

Use this guide to instruct an **outside AI agent** (Claude, GPT, Gemini, Cursor, etc.) to generate a complete, cohesive **RP-RPG vertical slice** as an **importable Seven JSON bundle** (`PortableJsonEnvelope` v3) that you can import directly into Seven (`Data → Import` or `resources/packs/`) and tweak in the UI.

> **Why this format**: Outside agents don't have access to Seven's runtime tools, and map generation is deferred for later. Everything below compiles into a single valid `.json` file that Seven's importer unpacks into **Character Sheets**, **Trigger Actions**, **Game Pieces**, **Places (`Looks` + `Exits`)**, **Custom Lore**, and **World Opening (`launch`)**.

---

## 0. User Concept Brief *(Fill in before handing to the outside agent)*

- **Working World Name**: `<World Name>`
- **General Idea / Pitch**: `<2–4 sentences describing the core vibe, mystery, or conflict>`
- **Setting & Era**: `<e.g., Low-magic frontier · Late Autumn>`
- **Tone & Stakes**: `<e.g., Tense, investigative, grounded consequences>`
- **Player Starting Role**: `<Who the player is and where they begin>`
- **Target Scope (Depth over Breadth)**:
  - **1–2 parent locations** containing **4–8 nested rooms/sub-places**
  - **1 Player sheet** + **3–6 grounded NPC sheets** placed in their actual rooms
  - **1–3 Opening / Scene Trigger Actions** + optional custom items/abilities/buffs
  - **Maps**: Deferred (`mapUses: []`, `launch.startingMap: null`)

---

## Agent Generation Order (Build Section by Section)

Instruct the outside agent to design and emit the sections **in this exact order** so every ID reference (`sheet`, `place`, `trigger_action`) resolves cleanly.

### Section 1 — Cast & Character Sheets (`kind: "sheet"`)
In Seven, `sheet` entries are stored as `PagePack` objects (`type: "sheet"`, `title`, `data`). **Important**: Seven derives a sheet's saved ID from its `title` (lowercase, underscores), so `id` **must** equal the slug of `title` (e.g. `title: "Marta"` → `id: "marta"`, `@sheet:marta`). Every sheet **must** include all core sections inside `value.data`:
- **`fields` & `values`**: All 6 standard fields (`Identity`, `Appearance`, `Relations`, `Motivations & goals`, `Speech`, `Core beliefs`).
- **`dnd`** (`DndStats` or `null`): `race`, `cls`, `level`, `background`, `alignment`, `xp`, `inspiration`, `hp` (`cur`/`max`/`temp`), `hitDice`, `deathSaves`, `ac`, `speed`, `stats` (`str`/`dex`/`con`/`int`/`wis`/`cha`), `saves`, `skills` (`0 | 1 | 2`), `conditions`, `exhaustion`, `attacks`, `proficiencies`, `equipment`, `coins` (`cp`/`sp`/`ep`/`gp`/`pp`), `features`, `spellAbility`, `slots`, `spells`, `extra`.
- **`game` & `gameRules`**: `EntityRecord | null` (optional engine components) and `gameRules` string.
- **`faction`**: Faction ID string or `null`.
- **`story`**: `{ where, doing, goal, mood, backstorySummary, threads, sessions }`.
- **`mind`** (`CharacterMind | null`): `{ reasoningStyle, howItThinks, voiceConstraints, forceReason, memories: StoryMemory[] }`.
- **`relationships`**: `RelationshipEntry[]` linking to other sheets (`@sheet:<id>`).

> **Anti-Clairvoyancy Placement**: Do **not** place all NPCs in the player's starting room. Set each NPC's `story.where` to `"@place:<room_slug>"` for the actual room where they begin (e.g. `"@place:common_room"`, `"@place:cellar"`), so they appear under **Who is here** in that room when a save starts. Reserve `place.Files` for notes/pages/items belonging in that room.

### Section 2 — Mechanical Hooks (`kind: "trigger_action"`, optional `kind: "game_def"`)
Design 1–3 reusable **`StoredTriggerAction`** entries that fire on Session 1 start or room interactions:
- Example `effects`:
  - `{ "type": "world.setFlag", "flag": "session_1_started", "value": "true" }`
  - `{ "type": "action.giveItem", "item": "", "count": "1", "gold": "25" }`
  - `{ "type": "world.cue", "text": "..." }`

### Section 3 — World Geography: Built-in `place` Hierarchy (`Looks` + 1-Hop `Exits`)
Build **top-down** (`Parent Place` → `Child Rooms` via `Inside`):
- **`place` is built into Seven.** Do **NOT** put `place` inside `world.schema.types`. Put place records under `world.entities.place`.
- Every `place` record key should be a lowercase slug (e.g. `example_inn`, `room_1`, `upstairs_hall`, `common_room`).
- **Required fields per place**:
  - **`Name`**: Display name.
  - **`Inside`**: Parent place slug (or `null` if top-level).
  - **`Looks`**: Rough visual description (lighting, layout, materials, focal objects, atmosphere) so an RP agent never invents contradicting geometry.
  - **`Exits`**: Array of **direct 1-hop exits ONLY** (`[{ "text": "oak door", "ref": "upstairs_hall", "locked": false }]`).
    - **Anti-Clairvoyancy Rule**: Never describe what lies *beyond* a closed door or in sibling rooms inside `Looks` or `Exits`. Seven builds a 1-hop Mermaid graph from `Exits` so the in-game agent only knows where it is and where it can immediately go.
  - **`Now`**: What is happening in *this room only* at Session 1 start.
  - **`Files`**: Space-separated links to pages/notes belonging in *this room only* (e.g. `@page:ledger`). NPCs belong in `story.where` (`"@place:<room_slug>"`), not `Files`.
  - **`Actions` / `Decisions`**: Room-specific checks or choices.

### Section 4 — Custom Lore Schema (`world.schema`, Optional)
- Keep `world.schema.types` strictly for **custom campaign/lore types** (e.g. `faction`, `rumor`, `clue`), or `{}` if none are needed.
- Never define `place` here.

### Section 5 — World Opening & Launch Setup (`world.launch`)
Tie Sections 1–4 together in `world.launch`:
- `setting`, `timePeriod`, `tone`
- `startingPlace`: Exact slug of the starting room (e.g. `room_1`)
- `startingMap`: `null` *(deferred until maps are generated/drawn later)*
- `startingTime`: `28800` *(Day 1 · 08:00 in seconds)*
- `premise`: Overarching storyline premise
- `incitingIncident`: Immediate Session 1 opening situation in `startingPlace`
- `openingActionIds`: Array of `trigger_action` IDs from Section 2

---

## Exact Output Format (Importable Seven JSON v3)

The outside agent must output **valid JSON** matching Seven's `PortableJsonEnvelope` v3 (`seven: "export"`, `version: 3`, `protection: "none"`). Save the output as `<world_slug>.json` and import it in Seven.

```json
{
  "seven": "export",
  "version": 3,
  "protection": "none",
  "savedAt": 1760000000000,
  "about": {
    "title": "Example World (Starter Pack)",
    "kind": "world",
    "summary": "RP-RPG vertical slice"
  },
  "entries": [
    {
      "kind": "sheet",
      "id": "hero_1",
      "title": "Hero Name",
      "isDependency": true,
      "value": {
        "title": "Hero Name",
        "type": "sheet",
        "body": "",
        "fields": [],
        "records": [],
        "image": null,
        "voice": null,
        "data": {
          "fields": ["Identity", "Appearance", "Relations", "Motivations & goals", "Speech", "Core beliefs"],
          "values": {
            "Identity": "Role, background, and reputation.",
            "Appearance": "Build, clothing, notable marks.",
            "Relations": "Key ties to NPCs in the world.",
            "Motivations & goals": "Immediate objective and long-term drive.",
            "Speech": "Cadence, vocabulary, verbal habits.",
            "Core beliefs": "Principles or lines they will not cross."
          },
          "dnd": {
            "race": "Human",
            "cls": "Rogue",
            "level": 1,
            "background": "Investigator",
            "alignment": "Neutral",
            "xp": 0,
            "inspiration": false,
            "hp": { "cur": 10, "max": 10, "temp": 0 },
            "hitDice": { "total": "1d8", "used": 0 },
            "deathSaves": { "ok": 0, "fail": 0 },
            "ac": 13,
            "speed": 30,
            "stats": { "str": 10, "dex": 14, "con": 12, "int": 13, "wis": 12, "cha": 11 },
            "saves": { "str": false, "dex": true, "con": false, "int": true, "wis": false, "cha": false },
            "skills": { "investigation": 1, "perception": 1, "stealth": 2 },
            "conditions": [],
            "exhaustion": 0,
            "attacks": [{ "name": "Dagger", "bonus": "+4", "damage": "1d4+2 piercing" }],
            "proficiencies": { "armor": "Light", "weapons": "Simple", "tools": "Thieves' tools", "languages": "Common" },
            "equipment": [{ "name": "Dagger", "qty": 1, "equipped": true, "notes": "" }],
            "coins": { "cp": 0, "sp": 0, "ep": 0, "gp": 25, "pp": 0 },
            "features": [],
            "spellAbility": null,
            "slots": [],
            "spells": [],
            "extra": {}
          },
          "game": null,
          "gameRules": "",
          "faction": null,
          "story": {
            "where": "",
            "doing": "Waking up in Room 1.",
            "goal": "Find out why the contact never arrived.",
            "mood": "Alert",
            "backstorySummary": "Concise backstory summary.",
            "threads": [],
            "sessions": []
          },
          "mind": {
            "reasoningStyle": null,
            "howItThinks": "Methodical, skeptical, notices physical details first.",
            "voiceConstraints": "Short, grounded sentences.",
            "forceReason": false,
            "memories": [
              {
                "id": "mem_1",
                "category": "backstory",
                "summary": "Key formative memory",
                "detail": "Details of what happened.",
                "where": "",
                "who": [],
                "tags": [],
                "pinned": true
              }
            ]
          },
          "relationships": [
            { "target": "@sheet:innkeeper", "label": "Wary acquaintance", "trust": 0, "notes": "Owes a small favor." }
          ]
        }
      }
    },
    {
      "kind": "sheet",
      "id": "innkeeper",
      "title": "Innkeeper",
      "isDependency": true,
      "value": {
        "title": "Innkeeper",
        "type": "sheet",
        "body": "",
        "fields": [],
        "records": [],
        "image": null,
        "voice": null,
        "data": {
          "fields": ["Identity", "Appearance", "Relations", "Motivations & goals", "Speech", "Core beliefs"],
          "values": {
            "Identity": "Proprietor of the inn.",
            "Appearance": "Weathered face, apron stained with soot.",
            "Relations": "Knows the local regulars.",
            "Motivations & goals": "Keep trouble away from the inn.",
            "Speech": "Blunt, practical, guarded with strangers.",
            "Core beliefs": "Pay your tab and keep your voice down."
          },
          "dnd": null,
          "game": null,
          "gameRules": "",
          "faction": null,
          "story": { "where": "", "doing": "Tending the bar.", "goal": "Protect the cellar secret.", "mood": "Guarded", "backstorySummary": "", "threads": [], "sessions": [] },
          "mind": {
            "reasoningStyle": null,
            "howItThinks": "Transactional and protective of regulars.",
            "voiceConstraints": "Never volunteers names unprompted.",
            "forceReason": false,
            "memories": []
          },
          "relationships": []
        }
      }
    },
    {
      "kind": "trigger_action",
      "id": "opening_hook",
      "title": "Opening Hook",
      "isDependency": true,
      "value": {
        "id": "opening_hook",
        "name": "Opening Hook",
        "description": "Marks Session 1 started and grants starting coin.",
        "effects": [
          { "type": "world.setFlag", "flag": "session_1_started", "value": "true" },
          { "type": "action.giveItem", "item": "", "count": "1", "gold": "25" }
        ],
        "tags": ["opening"],
        "updatedAt": 1760000000000
      }
    },
    {
      "kind": "world",
      "id": "example_world",
      "title": "Example World",
      "isDependency": false,
      "value": {
        "name": "Example World",
        "player": "hero_1",
        "rules": "Grounded consequences, room-scoped knowledge.",
        "tags": ["rp-rpg"],
        "flags": {},
        "launch": {
          "setting": "Low-magic frontier",
          "timePeriod": "Late Autumn",
          "startingMap": null,
          "startingPlace": "room_1",
          "startingTime": 28800,
          "premise": "Overarching premise of the vertical slice.",
          "incitingIncident": "Immediate Session 1 situation in Room 1.",
          "tone": "Tense, investigative",
          "openingActionIds": ["opening_hook"]
        },
        "schema": {
          "version": 1,
          "types": {}
        },
        "entities": {
          "place": {
            "example_inn": {
              "Name": "Example Inn",
              "Inside": null,
              "Looks": "Timber-and-stone roadside inn.",
              "Exits": [],
              "Files": "",
              "Now": "Quiet morning.",
              "Actions": "",
              "Decisions": ""
            },
            "room_1": {
              "Name": "Room 1",
              "Inside": "example_inn",
              "Looks": "Small rented room with a shuttered window, bed, washbasin, and small table.",
              "Exits": [
                { "text": "wooden door", "ref": "upstairs_hall", "locked": false }
              ],
              "Files": "",
              "Now": "Empty except for you.",
              "Actions": "",
              "Decisions": ""
            },
            "upstairs_hall": {
              "Name": "Upstairs Hall",
              "Inside": "example_inn",
              "Looks": "Narrow timber corridor lit by a wall sconce.",
              "Exits": [
                { "text": "Room 1 door", "ref": "room_1", "locked": false },
                { "text": "stairs down", "ref": "common_room", "locked": false }
              ],
              "Files": "",
              "Now": "Empty.",
              "Actions": "",
              "Decisions": ""
            },
            "common_room": {
              "Name": "Common Room",
              "Inside": "example_inn",
              "Looks": "Low-beamed hearth room with trestle tables and a bar counter.",
              "Exits": [
                { "text": "stairs up", "ref": "upstairs_hall", "locked": false }
              ],
              "Files": "@sheet:innkeeper",
              "Now": "The innkeeper is behind the counter.",
              "Actions": "",
              "Decisions": ""
            }
          }
        },
        "board": [],
        "mapUses": []
      }
    }
  ]
}
```

---

## Importing & Tweaking in Seven

1. Import `<world_slug>.json` via Seven's importer (or drop it into `resources/packs/` to auto-install on startup).
2. Open **World Editor → Places** to inspect the `Inside` hierarchy, `Looks`, `Exits`, and live 1-hop Mermaid diagram.
3. Open **World Editor → Opening** to adjust `startingPlace`, `startingTime`, or `openingActionIds`.
4. When you're ready to add maps later, attach a map in **World Editor → Maps** and set `Starting Map` in **Opening**—no Places or Sheets need to be rebuilt.
5. Export the finished world as a **`.sevenpack`** or **Seven Card (`.png`)**.

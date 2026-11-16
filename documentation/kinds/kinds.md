# Kinds

A kind is one type of thing in Seven's library: pages, folders, files, characters, repos, chats, agents, skills, reminders, boards, messages, workouts, exercises, spells and so on. Every entry in the Data window, every `@kind:name` link and every library tool works through a kind.

## The rule

A kind owns everything about how it behaves. Code outside a kind's own definitions never checks a kind's name (`kind === 'page'`, a set of kind names, a lookup table keyed by kind) to change what it does. When something has to behave differently for a kind, add an optional field to the kind's definition in the right layer below, set it on that kind, and have the generic code read the field. The generic code must work for a kind that sets nothing.

A kind's own code (its screens, its store, its export file) can use its own name freely.

## The three layers

A kind is defined in up to two places, both keyed by the kind's name:

| Layer | Where | Registered by |
|---|---|---|
| Engine definition (`Kind`) | `src/engine/library/kinds.ts` (built-in), `engine/library/moduleKinds.ts` (from modules) | the `kinds()` list, `registerModuleKind(module, kind)` |
| Screen and Data window UI (`KindUi`) | `src/renderer/src/registries/kinds.tsx` (type), `components/data/kindUis.tsx` (built-in), `components/dnd/compendiumUis.tsx` (D&D) | `registerKindUi(kind, ui)` (replaces any earlier entry for that kind) |

Part views (how one part of an entry is drawn, e.g. a page's items) are registered with `registerPartView(kind, part, component)` in `registries/kinds.tsx`.

## Engine definition: `Kind`

Required:
- `kind` the name used in links and tools (`@page:…`), `label` and `plural` for people, `icon`, `description` (one line; agents read it), `group` (the Data rail group, e.g. Yours, Agents).
- `parts` the parts an entry has (e.g. text, items, picture), `actions` the exact names of the tools that act on it; hiding the kind from an agent hides these tools, so a wrong name leaves a tool visible.
- `exportable` whether it can be handed to an agent or exported as text.
- `available(ctx)` whether it is on for this user or agent.
- `search(query, limit, ctx)` the matching entries (kind, id, title, `at`, and `excerpt` when body text matched; the line is added by the library), `resolve(ref, ctx)` (name or id to id), `title(id)`.
- How it describes itself as text, at three lengths: `line(id, ctx)` one line saying what it is (every list and find result shows it; a hit's `excerpt` is where a search matched, shown instead when there is one, `hitDetail` in `@shared/types`), `card(id, ctx)` a short markdown description (link faces, Hand to an agent, export to a folder, through `exportOne`), `full(id, options, ctx)` all of it (the read tool and links the user puts in a message).

Optional:
- `export(id, ctx)` its own `{ title, markdown, json }`; without it the export is `full` as markdown.
- `handTo` how the Hand to an agent modal shows it (below).
- `fields(id, ctx)` its named pieces of text (`{ name, text }`: a character's fields and where now, a record's fields, a file's description) that a link can pull in with `#field` (`@sheet:tulka#description`). `resolveIncludes(text)` (`engine/library/includes.ts`) swaps those links for the text wherever agents read text: the read tool, links in your messages, Hand to an agent and exports, world_recall, What the agent reads.
- `readView`, `textParts`, `defaultPart`, `linkParts` (parts a link can point at).
- `place(id, part, onBoard)` how it shows as a board widget.
- `remove`, `rename` (their presence turns on Delete and Rename everywhere), `roll` (random pick, e.g. `#random`).
- `source` (the module it came from), `family` (UI falls back to the family's `KindUi`, e.g. world kinds), `worldType` the world record type it stands for, so no separate kind is made for that type (the place kind stands for the built-in `place` type).
- `isGenerated(id)` the entry is made each time it is read, not stored (the wiki index, All … lists, Seven guides, agent instructions on page); left out of counts, Hand all and folder exports.
- `root` the id meaning the top level (folder: `/`); reading the kind with no name reads it.
- `resolveOnly` only `resolve` finds its entries, with no fallback to matching titles (page, folder: they resolve by path).
- `missing(ref)` the error text when a link to it points at nothing (page-stored kinds use `data.pages.missing`).
- `readFull(id)` async full text, used before `readView` when it gives text (file: a text file's content).
- `asset(id)` the stored file behind an entry (file); folder exports copy the bytes and links point at the copy.
- `exportAtRoot` its entries go at the top of a folder export instead of a folder named after the kind (page).
- `lasting` the kind is what an agent keeps across chats (memory, thought); incognito agents don't get its actions.
- `pack(id)` the entry as data to carry in a picture (undefined: every Seven has it, e.g. built-in themes), `uses(id)` the entries it needs carried with it, `unpack(value, how)` makes it again from that data (`how.replace` the entry to overwrite or null for a copy with a free name, `how.entry(oldId, kind?)` the new id of a carried entry it uses) and returns its id. File ids anywhere in the data are carried and swapped for the new ones before `unpack`. Helpers in `engine/library/packing.ts`: `pagePacking(refs?)` for page-stored kinds, `folderPacking` (the whole folder with its pages and files), `filePacking`, `storePacking({ find, names, save, drop, everywhere, refs, next })` for kinds kept in a store with `save`. Setting `pack` and `unpack` turns on Save into a picture (`KindFlags.carriable`).
- `pageTypes` the page `type` values it is stored as in `data.pages` (page `''`, folder, sheet, repo and its old type, workout and exercise, add-on page types). `kindOfPageType(type)` and `isPageBacked(kind)` in `engine/library/kinds.ts` read it; the timeline and folder export use them for times, pictures and forgetting deleted pages.

`kindNamed(name)` gets a kind by its exact name. `kindFlags(k)` gives the flags both `kindInfo()` and the library sections carry (exportable, removable, renamable, carriable, family).

Where kinds come from: the built-in list in `kinds()`; page types added by add-ons (`addonKinds()`, their name has a dot, their UI falls back to `page:addon`; a page type in `module.json` `kinds` lists its tools in `actions`, and a module whose `actions` name a tool it doesn't define fails to start with that error in Tools); kinds owned by built-in modules (`registerModuleKind`, shown only while the module is on, e.g. the seven D&D compendium kinds). An agent's access can hide kinds (`hidden`), which also hides their actions.

## Screen and Data window UI: `KindUi`

What it shows (`present: KindPresent`):
- `Screen` its screen for an entry; `Chat` its inline chat view; `Stage` its full-screen stage view; `Slate` (`EntrySlateProps`, `mode: 'token' | 'slate'`) its tabletop & inspection glass hand-slate surface (defaults to `EntrySlate`, which also serves as the universal fallback for `Chat`, `Stage` and `Widget` so every kind can be placed on a board or inspected in chat); `Widget` its dashboard grid widget; `Face` its card face; `Thumb` a picture for tiles.
- `whole` the screen handles the whole kind itself (no list in front); `home` what shows when no entry is open.
- `open(id)` how to open an entry from anywhere (links, search).
- `add` and `addLabel` the New button; `importer` the Add from JSON dialog.
- `menu(ctx)` its own items in the right-click menu.
- `timed` its rows in the side panel browser show when they happened.
- `emptyText` what an entry picker says when the kind has nothing yet (repo).

How the Data window lays it out (the Data window code in `views/data/` holds no kind names; it only reads these):
- `browser` the kind takes over the whole Data window with its own side column where the kinds list is, and `onBack` to return to the kinds; in the side panel browser it is shown inside the kind pane. Pages use `PagesBrowser`.
- `showsAs` its entries open in another kind's view (folder opens in page).
- `railUnder` `{ kind, count }` it is not listed on its own in the kinds list but under another kind, which stays highlighted while it is open; `count` adds its entries to that kind's count (folder and file are under page; only file counts).
- `rail` `{ label, icon }` how it is shown in the kinds list (page shows as Files with a folder icon).
- `railGroup` the kinds list group, overriding the engine `group` (theme, style and command use `SETUP_GROUP`).
- `trail` shown in the kind header next to an open entry (file shows its folder path).
- `back(selected)` what the kind header's title does instead of going to the kind's list (file goes back to its folder in Pages).

## Facets and variations

Two different things. Don't mix them up.

- **Facet:** something a kind offers to other kinds. D&D offers its stats: a character sheet shows them on a tab, checks roll against them, cards will roll against them. The kind offering it decides what the facet is; the kinds using it only read it. The D&D, Story, Game and Cards tabs on a character sheet are facets those modules offer to sheets (`sheetFacets` in `components/data/sheet/facets.ts`).
- **Variation:** one entry of a kind in more than one form, each form supplied by a module. There is one Fireball card; `world` gives it a Roleplay variation and `game` a Gameplay variation. It is still one entry. Cards are the first kind with variations (`docs/plans/kind-variations/`).

Both are lists a kind owns that modules add to from their own files, so both are built on one plain mechanism: `moduleList<T>()` (`@shared/moduleList`), where `T` extends `ModuleEntry { id, module, name, order }` with the kind's own fields. Screens read `useModuleList(list)` (`registries/useModuleList.ts`): only entries whose module is on, `null` until the module list has loaded. A kind sets `moduleLists: [{ label, list }]` on its `KindUi` so the Tools view's Adds row can list what each module adds (`kindModuleLists()`). Data an entry holds for a switched-off module stays on the entry untouched.

A kind with variations sets `variations` on its `KindUi` to a `moduleList<KindVariation>` (`registries/kinds.tsx`): each variation has `label`, `has(entry)`, `attach(entry)`, `remove(entry)` and its `Editor({ entry, change })`, and keeps its data on the entry under its own keys. `VariationTabs({ entry, change, variations, ownLabel, own })` (`components/ui`) shows the entry's own tab first, a tab per variation it has, **Add** for the rest; right-click a tab to remove it or add another. Cards: `cardVariations` (`components/cards/variations.ts`) adds `playable(card)` and `play(card, where)`; `world` adds **Roleplay** (`components/play/roleplayCard.tsx`: action or decision, read from the card's existing `use`, `action` and `decision`).

## Hand to an agent: `handTo`

The Hand to an agent modal shows an entry through the `entry` export source and a whole kind through the `kind` source (`docs/HANDOFF.md`, Export). A kind's `handTo` (`KindHandTo`) can give:
- `sections()` the sections of one entry (reuse `entrySection`, `linksSection`, `answerSection` from `exporting/entry.ts` where they fit).
- `presets(ctx)` the starting briefs and the sections each ticks.
- `answer(ctx)` the How to answer note.

What it links to: the `@links` in the entry's card, each linked entry as its card or, with the What it links to option set to In full, its full text.

Hand all leaves out entries the engine `Kind` marks with `isGenerated`, and says how many.

Page-stored kinds use `PAGE_HAND_TO` (`exporting/pages.ts`), characters `SHEET_HAND_TO` (`exporting/sheets.ts`). A kind without one gets the entry, what it links to and How to answer, with the writing presets.

## Adding a kind

1. Engine: write its `Kind` and add it to `kinds()` (or `registerModuleKind` from a module). Set `exportable`, `remove` and `rename` as wanted.
2. UI: `registerKindUi` with its screen, menu and New button, and any Data window layout fields it needs.
3. Hand to an agent: set `handTo` only if the default sections are not enough.
4. Tools: CRUD names (`verb_kind`), one tool per action, listed in `actions`.
5. Never add its name to generic code. If generic code cannot do what the kind needs, add a field to the layer above and document it here.

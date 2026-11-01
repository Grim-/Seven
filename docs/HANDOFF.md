# Seven: handoff notes

Seven is an Electron + React + TypeScript assistant for local LLMs (node-llama-cpp). Repo: `O:\GitHub\seven`. This file is for the next agent working on it.

## How to work on it
- Edit the repo directly. Typecheck with `npx tsc --noEmit -p tsconfig.node.json` and `npx tsc --noEmit -p tsconfig.web.json`. Build with `npx electron-vite build`.
- Never overwrite a whole file from a stale copy. Other agents edit the same repo; overwriting has already wiped their changes once (see Known problems).
- All changes to data files go through `src/engine/util/fs.ts` (`writeJson`, `writeText`, `writeBytes`, `appendLine`, `writeLines`, `removePath`, `renamePath`, `copyPath`, and `writeUserFile` for the user's own folders). Never call `fs` write, rename, copy or delete directly in the engine or modules; `npm run typecheck` runs `scripts/storage-check.ts`, which fails on it. Its short allow-list is temp files for outside programs, the vault's own sealing, and the user's Tools and skills folders.
- Before any UI work, read `docs/ux.md` (how screens behave) and `docs/ui-components.md` and use the shared components and hooks listed there. Never inline or duplicate a pattern; extract on second use and add it to that file.

## The user's standing rules
- Never read or write `C:\Users\Bry\.seven` (the user's data) or the user's Tools folder. Code only. Migration code that runs on the user's machine is fine.
- No code comments unless asked. No suggestions unless asked. Do only what is asked; don't decide things on the user's behalf.
- Usage is the user's money. Read only the files a change touches, edit precisely, no rework passes, no broad sweeps. Say the rough cost before large changes.
- Don't edit module `.md` files unless needed for correctness, and say so when you do.
- No browser tests or model downloads; the user tests.
- Tools are written for small LLMs: CRUD names (`verb_kind`), one tool per action, no mode params, one-line plain descriptions.
- Small files, one job each, a folder per feature. No monoliths.

## Layout
- `src/engine`: the engine (agents, chat runner, library of kinds, stores). `src/engine/library/kinds.ts` defines every kind (pages, files, workouts, exercises, sheets, repos, messages, ...), their tools ("actions") and access.
- `src/modules/*`: built-in tool modules, each with `module.json`, `index.ts`, `prompt.md`, optional `help.md`. Discovered automatically.
- `src/shared`: types (`types.ts`), IPC protocol (`protocol.ts`), helpers (`ids.ts`, `text.ts`, `workout.ts`).
- `src/main`: Electron main process (`ipc.ts` has main-side calls such as `clipboard.write`, `asset.open`).
- `src/renderer/src`: the UI. `components/ui` (shared components), `lib` (shared hooks and helpers), `views` (top-level views), `views/data` (the Data window), `components/<feature>` per feature.
- What a kind is, does and can do, and the rule that only a kind decides its own behaviour: `docs/kinds.md`. Read it before touching anything kind-related.

## Data window
- Left rail of kinds (collapsible with `ListPane`, opens on hover when collapsed), header, and a pane per kind (`views/data/KindPane.tsx`).
- Right-click menus everywhere via `views/data/entryMenu.tsx` (`entryMenuAt`, `rowMenu`, `kindMenuAt`).
- A kind decides how the Data window shows it through its `KindUi` (`browser`, `showsAs`, `railUnder`, `rail`, `railGroup`, `trail`, `back`; see `docs/kinds.md`). Pages use `PagesBrowser`, whose tree header is a `PaneHeader` with New folder, New page and Export; right-click Pages for the kind menu.
- Copy link uses `entryLink(kind, id)` from `store/data.ts`, which gives `@page:folder/name` paths for pages.
- The Data rail has one Files entry for pages, folders and files: folder and file set `railUnder` page, page sets `rail` Files (`views/data/groups.ts` reads them; `railKind` keeps Files highlighted while a file or folder is open). The kinds stay separate in the engine, so `@page` and `@file` links and agent tools are unchanged.
- Files live in the same folders as pages: `AssetMeta.parent` is a page folder id, moved with `data.assets.move`. `PageExplorer` shows a folder's pages and files together and drag-moves both. Deleting a folder moves its files up a level, like its pages (`pages.setOnRemove`). A folder listing for agents lists files as `file <name>`.
- Files can be dropped anywhere on the window (`useFileDrop` on `<main>` in `App.tsx`); chat and dashboards handle their own drops first.

## Storage index
- `src/engine/util/dirIndex.ts`: `DirIndex` keeps each file's parsed contents in memory, checked against size and modified time, and reuses a folder listing for up to 2 seconds unless the folder changes. Every change made through `util/fs.ts` updates it at once; locking or unlocking the vault clears it.
- Used by the page store (`data/pages.ts`: `load`, `list`, `metaFor`) and the file store (`data/assets.ts`). `load` returns a copy; never change what the index holds.
- "Rebuild index" in the Data rail's right-click menu (`library.reindex`). In dev (`SEVEN_DEV=1`, set by the main process when unpackaged) the index compares itself with the disk every 25 lists and warns only on a difference.

## Saving
- Editors save as you type: `useAutosavedState`, `useDraft`, `SaveState`, `MakeOrSaved` (Make button until created), `DoneEditing`. No Save buttons on editors of existing things. Exceptions on purpose: logging a workout session, chat message edits, the page fields editor, small name and "add" dialogs.

## Export (hand to an agent)
- One modal for every export meant for an agent: `components/export/ExportModal.tsx`, opened with `openExport(source, args)` (`exportStore.ts`), mounted once in `App.tsx`. It shows a brief editor, the source's presets and options, a toggle per section with its size, a live preview as markdown, plain text or JSON, and Save, Copy, Put in the chat box, Start a chat with.
- A source registers in the engine with `registerExport(id, { options, presets, sections, context, title, subtitle })` (`engine/exporting/registry.ts`). Each section gives its size and builds an `ExportPart` (heading, blocks of `h`, `p`, `li`, `pre`, and its JSON); `renderExport` in `shared/exporting.ts` turns the parts into each format. Calls: `export.describe`, `export.build`. Sources: `workout` (`engine/workout/export.ts`); `entry` and `kind` (`engine/exporting/entry.ts`), which hold no kind names: a kind gives its own sections, presets and answer note in its `handTo`; What it links to follows the `@links` in the entry's card and gives each as its card or full text (the What it links to option); kinds without one get the entry, what it links to and How to answer. `PAGE_HAND_TO` (`exporting/pages.ts`, page-stored kinds including workout, exercise and add-on pages) and `SHEET_HAND_TO` (`exporting/sheets.ts`). Every Export menu (`exportMenu`, `exportKindMenu` in `lib/exporting.tsx`) opens the modal; `exportMenuAt(e, section, open)` (`views/data/entryMenu.tsx`) is the one Export menu for a kind header or the page tree: the open entry first when its kind is exportable, then the whole kind. Export to a folder stays separate.

## Slideshows and pictures
- Kind `slideshow`, stored as pages of type `slideshow` (`shared/slideshow.ts`, `engine/library/slideshows.ts`): pictures (file ids in order), seconds each, shuffle, fit (whole or fill), captions. Engine call `slideshows.save` (id null makes one). Tools `add_slideshow`, `update_slideshow` (`modules/core/slideshowTools.ts`); `show` shows one in the panel or on a board through its part `show`; `ambience` takes `slideshow` for the chat background (`Backdrop.slideshow`).
- Renderer: `components/slideshow/` (`SlideshowScreen` editor with drag to reorder, add from Files or by dropping, typed seconds; `SlideshowPlayer` used by the part view, boards and backdrops; `useSlideshow`, `useCycle`, `addToSlideshowMenu`).
- Pictures open in their file view (the same as right-click › Open); there is no separate picture viewer. Slideshows play on the stage (`playSlideshow(id)` in `components/slideshow/useSlideshow.ts`). Never name a file the same as another apart from case, Windows treats them as one.
- Pictures in chat use `Picture` (`components/pictures/Picture.tsx`): they fill the message width up to Settings → Pictures in chat (`chatPictureHeight`, typed pixels), and Open or a click opens the picture's file view. Attached pictures show as pictures, other attachments as chips.
- Tools find a stored file by id, link or name with `resolveFile(ref, kinds, what)` (`engine/library/files.ts`).
- Folders (`PageExplorer` on `KindShell`) have Tiles, Gallery, Cards and List, a Size control, and remember them per folder. A click on a picture or video in a folder opens the viewer stepping through that folder's.
- Picking a library picture anywhere: `pickPicture(current, { mimes, what })` / `pickPictures()` (`components/data/PicturePicker.tsx`, host mounted once in `App.tsx`).

## Carrying an entry inside a picture
- "Save into a picture…" is in every entry's export menu for kinds whose engine `Kind` sets `pack` and `unpack` (`KindFlags.carriable`). The modal (`components/carry/CarryModals.tsx`, `openCarry`) picks a PNG, can lock it with the vault key, or carries pasted text instead ("Data instead of an entry…"), and saves a new PNG where the user chooses (`dialog.savePath`).
- Engine `engine/carry/`: `png.ts` reads and writes a private ancillary PNG chunk `seVn` so the picture opens anywhere. The chunk is a plain head (kind, label, title, date, locked, what else it carries) and a deflated body (entries, the files they use, their bytes), sealed with the vault when locked. Calls `carry.save`, `carry.peek`, `carry.open` (copy or replace).
- What travels: the entry, every entry it `uses` (an agent's theme, reasoning style and sheet; a routine's agent; a workout's exercises), and every library file any of them names (asset ids found anywhere in their data, `assetsIn` / `swapAssets` in `engine/library/packing.ts`). Built-in themes and commands are not carried. Imported routines come in switched off. An agent's memories and world are not carried.
- Every added file goes through `importPaths` (`lib/importFiles.ts`), which asks the engine whether PNGs carry something and queues the "This picture carries something" modal: Keep the picture only, Import as a copy, Replace (when one with that name exists), or for text, show and copy it.

## Storyteller Nexus
- Module `src/modules/storyteller/`. Kinds (page types): story template, POI, branching story (`tale`), all shown with `nexus.html`. Story runs are files in its data folder (kind `story`).
- Tools to run stories: `list_stories`, `start_story`, `load_story_context`, `checkpoint_story`, `record_facts`, `close_story`, `resume_story` (the `story` kind's `actions`). The template tools are the template kind's `actions` and the branching story tools the tale kind's, set in `module.json`.
- Tools to write them: `add_story_template` and `update_story_template` (story notes, calls to action, acts with beat, threshold and branches; the result names `{repo}` tokens with no repo yet), `add_branching_story` and `update_branching_story` (passages `{id, text, choices[{label, to}]}`, `start`; written in parts, the result lists passages not written yet and passages nothing leads to). A branching story reads in `nexus.html`: one passage at a time, choices as buttons, Back, Start over, Edit as JSON.

## Workout
- Exercises and workouts are page kinds. There are no plans: a workout holds its exercises and its own before and after notes (warm-up, cool-down). Nothing is "due next"; Workout opens on the last workout done. Old plans are migrated once (state `version: 4`): each plan's about text and notes are added to the notes of the workouts it had, `rotations.json` is backed up to `_backup/workout-plans-removed-*` and removed.
- Log: `moduledata/workout/history.json`, rows `{date, exercise, workout, values[]}`. It is the only place results are kept; rows only point at exercise and workout ids, and exercise and workout pages hold setup only (unit, muscles, how-to, targets). Deleting an exercise or workout never touches the log: rows for a missing exercise stay, show as "removed exercise" in History, are skipped by stats, and come back if the exercise is made again with the same id. Only deleting a day, clearing a row in the day editor, removing a session or `remove_log` take rows out.
- Reading the log is strict: a bad row stops it loading with the file, row number and problem (shown on the Workout page), so nothing is saved over it. Imports of old formats skip bad rows and keep them in `_backup/workout-*-skipped-*.json`.
- Logging adds: the Log tab's Save session and `log_exercise` (`workout.logExercise`) add their sets to any row already there for that day, exercise and workout. Editors that show the whole row replace it: the History day editor and the workout page's session view and step-through (`workout.setLog`).
- Exercises have a free-text unit ("Counted in", e.g. reps, seconds, reps per arm). Numbers are stored and shown exactly as typed; nothing converts or multiplies them. Old `measure: seconds` data becomes unit "seconds".
- Workout page (`components/workout/WorkoutHome.tsx`, pieces in `components/workout/home/`): a strip with last trained, days this week and month, weeks in a row; then Log (any date, start from a workout, the last session's exercises or nothing; one box per set, last time's numbers as hints), History (month calendar of trained days; a day's sets edited in place, delete a day), Exercises (every exercise with last done, total for the chosen period and all time; detail with records, chart and per-day sets, unit and muscles edited in place), Stats (days per week, longest break, since last, bests; weekly consistency chart; sets per muscle, fewest first; growth per exercise, first third of sessions against the last third, worst first; overdue exercises against their usual gap; targets hit; all over 4 weeks, 3 months, a year or all time; maths in `shared/workoutInsights.ts` and `shared/workoutStats.ts`, pieces in `home/stats/`), Workouts (every workout). Engine calls `workout.setLog`, `workout.deleteDay`, `workout.patchExercise` (unit, muscles).
- Hand to an agent on the Workout page opens the shared export modal for source `workout` (`engine/workout/export.ts`): sections Summary, Log, Exercises, Exercise guides, Workouts, How to answer (the import formats from `IMPORT_FORMATS`); option Period; presets that fill the brief and tick sections. The stats maths is shared by the Stats tab and the export: `shared/workoutStats.ts`, `shared/workoutInsights.ts`.
- Exercises have `muscles` (free text list, "Works" on the exercise page and Exercises tab, settable by agents). No built-in list; suggestions come from muscles already used. Exercise pages still show their own Progress section.
- "Copy the format for an LLM" copies through Electron's clipboard (`copyText` in `lib/notify.ts`).

## Message board
- Module `board`: tools `add_message`, `read_messages`. Store `src/engine/board/store.ts`, file `moduledata/board/messages.json`. The latest three messages are added to an agent's turn only when the board changed since that chat last saw it (`board.unseen` in `engine/chat/runner.ts`). Data kind `message` with `components/board/BoardView.tsx` and `BoardMessageCard.tsx`.
- Another agent later added `components/ui/MessageComposer.tsx` and used it in `BoardView.tsx`; check the repo for its current state.

## Window context
- What a view shows belongs to its window, not a global store (`docs/windows-plan.md`). The main views stay full screen; `App.tsx` renders the current one (listed in `views/registry.ts`) inside a `WindowProvider` with the view's name as its id.
- `store/windows.ts` holds each window's location, the focused window, the last focused chat window (`chat`) and the home chat window (`home`: `chat` in the app, `overlay` in the overlay). `lib/window.tsx`: `WindowProvider`, `useWindowId`, `useLocation`.
- Chat: a window's location is its session id. `lib/conversation.ts`: `useConversation()` (the window's conversation: `key`, `sessionId`, `go`), `useFocusedConversation()` / `focusedConversation()` (for things that follow the chat you're in: theme, look, voices, stage, side panel), `openChat(sessionId, agentId?)`, `useLoadConversation()`, `recheckOpen()`. The sessions store has no `activeId`; drafts (agent, style, files, usage) are per window in `drafts`, read with `draftOf(state, key)`. Store calls that act on a chat take the `Conversation`.
- Chat view is `views/chat/ChatList.tsx` (browser) plus `views/chat/Conversation.tsx` (the conversation), composed in `ChatView.tsx`.
- Data: the Data window's selection is its location (`useLocation` in `DataWindow`); `useData` only holds lists. Open things in it with `showInData(selection, show?)` or `openEntry(kind, id)` from `lib/library.tsx`.

## Character sheets
- A sheet is named text fields, optional D&D stats and a story. `shared/dnd.ts` is the full 5e sheet (scores, saves, skills, combat, attacks, proficiencies, gear with notes, coins, features, spells); its editor `components/data/sheet/dnd/` is one page, values edited in place, race, class, attacks, gear, spells and features suggested from the D&D compendium, rows that match the compendium open its wording. Adding D&D stats also adds the fields Personality traits, Ideals, Bonds, Flaws, Backstory.
- Story (`shared/story.ts`, every character, tab Story, `components/data/sheet/story/`): where they are now, open threads, and sessions (number, date, title, markdown notes written in `MarkdownEditor` with @ links). The latest session is the one being written; older ones read like a journal, searchable, with their @ links collected beside them. Old D&D `where` and `log` move into the story when a sheet is read (one session per date).
- Two readers: an agent wearing a sheet gets only who the character is (`sheetMarkdown(id, true)`: race, class, level, background, alignment, the text fields, then where they are, open threads and the latest session). Reading a sheet with tools gives everything plus the last three sessions in full and the titles of earlier ones. Mechanics never go in a worn character's prompt. Agent tools: `update_stats`, `update_proficiencies` (skill and save proficiencies, expertise, armour, weapons, tools, languages), `add_story_log` (adds to the latest session), `set_story_where`.
- `update_stats` changes only the fields given.

## Model settings
- Every model setting is a `ParamDef` in `engine/model/params.ts` with a `section` (Memory and GPU, Context, Thinking, Sampling, Repetition, Advanced) and, where llama.cpp has one, its command-line `flag`s. The models page shows them as collapsible sections of `SettingRow`s, plus a llama.cpp options box that reads and writes the same settings as flags (`shared/modelArgs.ts`); flags with no equivalent are listed as not supported.
- Thinking is a level: off, low, medium, high, max. Low, medium and high cap thinking at the model's `thinkingLow` / `thinkingMedium` / `thinkingHigh` token fields (0 = no cap) and set gpt-oss's reasoning effort; remote OpenAI gets `reasoning_effort`, remote Anthropic a thinking budget from the same fields. Chosen per model, per agent (`agent.thinking`) and per chat (`session.thinking`, chat settings popover); the chat wins, then the agent, then the model (`runner.configFor`).
- Model fixes are off until turned on. A model's type (chat, embedding, vision adapter) can be set by hand in its details when detection gets it wrong.

## D&D compendium
- Built-in module `src/modules/dnd/` (no tools, `"tools": false`) owns seven kinds: spell, class, feature, race, equipment, condition, monster. Kinds are registered with `registerModuleKind` (`engine/library/moduleKinds.ts`) and only show when the module is on, globally and for the agent (agent `modules` includes `dnd`). Any built-in module can own kinds this way.
- Shapes, fact lists per kind, markdown and the SRD/5e-database mapping: `shared/compendium.ts`. Store: `modules/dnd/compendium.ts` (bundled SRD 5.1 in `modules/dnd/srd/*.json`, read-only; your entries in `moduledata/dnd/<kind>.json`; yours override SRD by id).
- Regenerate the SRD files: clone 5e-bits/5e-database and run `npm run srd:import -- <clone>/src/2014/en`. Attribution in `modules/dnd/srd/README.md` and the module's help.
- UI: `components/dnd/` (entry view with facts and markdown, one editor for all kinds, JSON import with a preview), registered in `compendiumUis.tsx`. Engine calls `dnd.get`, `dnd.save`, `dnd.remove`, `dnd.import`; event `dnd.changed`.

## Chat
- Reasoning style can be picked before a chat starts (`draftStyle` in `store/sessions.ts`, applied when the session is created).
- The reasoning card always opens showing question, reasoning and conclusion.

## Agent folders
- Every agent has a folder `agents/<name>` in Files (`AgentProfile.folder`, a page id), made when the agent is made; agents without the field get one once (`AgentRegistry.useFolders`, `engine/agents/folders.ts`), waiting for the vault to be unlocked. Renaming the agent renames the folder. Deleting an agent asks whether to keep the folder or delete it with everything in it (`removeFolderTree`).
- Pages and files made while an agent's tool runs, with no folder given (`parent` undefined), go in that agent's folder: `data.pages.setDefaultParent` / `data.assets.setDefaultParent` read the running agent from `currentActor()`. A folder deleted by hand is not made again; things then go to the top level.

## Incognito agents
- `AgentProfile.incognito`. A chat is incognito if its agent was when the chat was made (`SessionMeta.incognito`, set by `SessionStore.create` through `useIncognito`); switching an existing chat between an incognito and a normal agent is refused.
- Every per-chat file goes through `SessionStore.files(id)` (`engine/sessions/files.ts`: `diskFiles` or `MemoryFiles`), including checkpoints, the panel, the backdrop and the ambience (`chatFiles(id)` in `sessions/access.ts`). Incognito chats use `MemoryFiles`: nothing is written to disk and they are gone when Seven closes or the chat is deleted. Their tool output files are the one exception: they go in the system temp folder (`seven-incognito`), removed when the chat is deleted and when Seven starts. No model state file is saved for them.
- They are left out of `sessionAccess.list()` (so agents, links and the chat kind never see them), chat search, the web log (`logWeb`), and the timeline (an event about the chat is dropped; others keep no chat link). `minds.remember` and `minds.think` refuse them. An incognito agent gets no recall and no pinned memories (`mindAuto`), and the actions of kinds marked `lasting` (memory, thought) are hidden from it. Pages and files it makes are kept.
- Marked with `IncognitoMark` in the chat header and chat list.

## Window
- `main/windowState.ts` keeps the app window's place, size, maximized and minimized in `window-state.json` (plain, kept by Clear all with settings). `fitOnScreen(rect)` puts any rectangle on a screen that exists (the overlay button uses it too); the window is refitted when a screen is removed or changes.

## Known problems
- On 15 Oct two whole-file overwrites from a stale copy may have wiped another agent's edits in: `App.tsx`, `components/chat/Thread.tsx`, `components/dashboards/DashboardGrid.tsx`, `views/data/DataWindow.tsx`, `components/workout/plans/PlansView.tsx`, `components/workout/plans/PlanImporter.tsx`, `lib/notify.ts`, `main/ipc.ts`, `shared/protocol.ts`, `components/ui/index.ts` (its `MessageComposer` export has been restored). Check these against what that agent intended.
- Nothing since mid-October has been run in the app; it has only been typechecked and built.
- Eleven places still load data and reload on an engine event by hand instead of `useLive`.

## Still to do (the user's list)
- Kind pages: Files page (drag/paste import, gallery by type, preview, rename, where each file is used), Memory (minds and thoughts), Storyteller (start or resume runs), Reminders, Cards (deck builder, card gallery, games played against agents).
- Later: SQLite storage (needs the user's decision on encryption).
- User housekeeping: delete `src/renderer/src/components/ui/editors.tsx`, `src/engine/model/tags.ts`, `src/renderer/src/components/side/resize.tsx`, old plan docs, and the D&D add-on in the Tools folder.

## Open after the world maps work (28 Oct)

- Built through v348 but not yet run in the app: Play / Edit, layer zoom ranges, objects (move, scale, turn), tokens and journeys, actions with "one check, picked", decisions.
- Objects: no drawn outline yet (you click the picture); right-clicking an object in the layer list gives the layer menu, not the object's.
- Journeys aren't in any text the agent reads yet.
- Composer: `docs/composer-plan.md`. Built in v359, not yet run in the app. Block sizes (large or card) aren't kept when saved as a page.
- Cards: `docs/action-cards-plan.md`. Built in v353, not yet run in the app. A chat's hand shows once the chat has started (a set's deck is per chat). Playing a card's action has no Roll again. The mockup `mockups/cards.html` still shows the old Chat card / Map card split.

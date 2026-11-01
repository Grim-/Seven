# Seven UX rules

Every screen follows these. Before adding UI, check `docs/ui-components.md`; most of these rules are already built into a shared piece, so use it instead of rebuilding the behaviour.

## Right-click works everywhere
- Every item that can be acted on has a context menu: rows, tiles, cards, rail entries, tabs, chat messages.
- Right-clicking empty space in a list or grid offers what a button there would: New …, Add files, and so on (`KindShell` does this from its `adds`).
- A menu holds everything the item's buttons do, plus Copy link, Tags, Show in chat panel and Delete where they apply. Buttons are shortcuts to menu items, never the only way.
- Menus come from `openMenu` / `rowMenu` / `entryMenuAt`. Submenus use `children`, not a second menu opened after the first.
- Anything that is an entry (page, file, folder, character, chat, world, compendium entry, ...) gets its menu from `entryMenuAt` / `rowMenu` / `openEntryMenu`, so it always has Reference in chat, Start chat with, Show in chat panel, Copy link, Tags, Rename, Export and Delete. Screens pass only their own extras; danger items go last on their own. Never hand-build an entry's menu with `openMenu`.
- Every kind that can be read can be exported (markdown, plain text, JSON); its markdown is what an agent reads. Only files and folders are not, since they are files already.

## Lists of entries
- Tiles (big icon or picture first) are for things recognised by look: files, folders, pictures, portraits. Everything else shows as cards (name, what it is, a few lines of it) with a list as the other choice. Set with `KindShell` `layouts`. Folders offer Tiles, Gallery (for folders of pictures), Cards and List.

## Tooltips
- One tooltip everywhere, drawn by `TooltipHost` above everything (never clipped by a panel or scroll area). A plain hint is just `title="..."` on the element; a titled explanation is `Tooltip` / `InfoTip`. Never build another tooltip.

## Text editing
- Anything that is read back as markdown (notes, sheet fields, story sessions, memories, about you, messages, descriptions, long record values) is written in `MarkdownEditor`; small fields use `compact`. @ links and #random rolls work the same in all of them.
- A list of short items (steps, dos, values) is a `ListEditor`, not one item per line in a text box.
- Short single values are edited in place with `InlineEdit` / `InlineNumber`.
- Plain text boxes are only for code, JSON, rules, file patterns and agent prompts (`LinkTextarea` when @ links are wanted).
- When a shared editor gains a feature or a new one is added, every place doing the same job switches to it in the same change.

## Saving
- Editors save as you type (`useAutosavedState`, `useDraft`) and show `SaveState`. No Save buttons on existing things.
- New things show a Make button until created (`MakeOrSaved`), then save as you type.
- Deleting asks first (`confirmDelete`). Nothing else asks "are you sure".

## Moving and adding
- Anything that lives in a folder can be dragged onto a folder, or onto `...` to go up a level.
- Files can be dropped anywhere on the window; a view that knows a better place for them (a chat, a dashboard) takes the drop first.
- New things go where you are: a new page or added file in a folder goes into that folder.

## Layout
- Side lists collapse (`ListPane`, `ListToggle`) and open on hover at the edge while collapsed.
- Top bars never push buttons off the window. Long names (models, agents, titles) are truncated with the full text in a tooltip.
- Groups of settings that would crowd a bar go behind one button in a `Popover`, each with a label and a one-line hint.

## Main views
- The taskbar and Settings switch the main view (Chat, Dashboards, Data, Agents, Tools, Models, Settings), which fills the screen.

## Lists and grids
- Grids show folders, pages and files as a large bare `TileIcon` (square corners, thin lines) with the name under it; only pictures get a framed thumbnail.
- Large icons are sharp to match the rest of the UI. Lucide's rounded icons are only used small (rows, buttons, bars, glyphs inside a tile).
- Lists and grids remember their layout and sort, and have a Filter box.
- Empty lists say what would be there and offer the way to add one.

## Text
- Plain words. Labels say what a thing is; hints say what it does, in one line.
- Errors say what went wrong and what to do next; they go in a toast (`failed`), not in the console.
- Copy actions confirm with a toast (`copyText`).

## Links
- Every entry has a Copy link (`entryLink`, `CopyLinkButton`) that gives the `@kind:path` an agent understands.
- Every entry's menu has **Reference in chat** (adds its link to the chat box) and **Start chat with** (an agent; a new chat with the link ready). Agents are never told what you have open unless you hand it over like this.
- Links and names open the thing they name, in the Data window unless the kind has its own view.

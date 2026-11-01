# Page tree

## Goal

Pages grow big and structured, and right now the only way to look through them is one short list on the Data tab. Pages need a proper place to browse, with structure like folders, without adding a new concept next to kinds.

## Rules

- **Pages under pages.** Any page can sit under another page. There's no folder type: a "folder" is just a page with pages under it, so it can be linked (`@page:NPCs`), written in, and shown like any other page.
- **Every page-backed kind takes part.** Sheets, repos, collections and add-on page types can sit under a page, and can have pages under them.
- **Links never change.** Names stay unique across the app and `@kind:Name` works the same wherever a page sits. Moving a page only changes its parent.
- **Deleting never cascades.** Deleting a page moves the pages under it up one level. Nothing is deleted that you didn't pick.
- **No loops.** A page can't go under itself or anything beneath it.
- **Same for user and agents.** Agents place and move pages with the tools they already have; you drag them in the tree.

## A page

Gets one new field: `parent` (a page id, or none for the top level). The order under a parent is alphabetical.

## Agents

- `page_write` takes an optional `parent` (a link or name) when making or moving a page.
- Reading a page says what it's under and lists the pages under it, as links.

## The Pages tab

A main nav tab of its own:

- **Left:** the tree. Expand and collapse, filter by name, drag to move, right-click for new page here, rename, move to top level, delete. Each entry shows its kind's icon.
- **Right:** the page itself, as it opens today, with a path above it (`D&D › NPCs › Bob`) whose parts are clickable.

The Data tab stays as it is.

## Phases

1. **Parent:** the field, the loop check, moving pages up when a parent is deleted, and agents' `page_write` and read.
2. **Pages tab:** the tree, the path, drag to move.

Later options: manual ordering under a parent; folder exports that mirror the tree.

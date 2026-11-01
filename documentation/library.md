# The library

Everything Seven keeps is in one library, built on one idea.

## Entries and kinds
Everything is an **entry** of a **kind**: a page, a file, a chat, an agent, a theme, a character sheet, a repo, a day, a routine. A kind knows its own entries: how to find, read, show and export them. Nothing else in Seven decides on a kind's behalf.

New things arrive as new kinds (add-ons add their own) and work everywhere straight away: search, links, boards, export and agents.

## Links
One way to link, the same for you and agents, in chats, pages and everywhere else:
- `@kind:Name` links an entry. Quote names with spaces: `@page:"Shopping list"`.
- `@kind:Name#part` links one part, where the kind offers it: `@chat:"Planning"#user`.
- `@kind:Name#random` rolls a value from entries that can roll, like repos.

Linking an entry in a message gives the agent the entry itself. Autocomplete writes links for you.

## Parts
An entry can be shown in different ways (its text, its items, a statblock, a sheet card), inline in a chat, in the side panel, on stage or on a board.

## Generated entries
Some entries are built from others every time they're read, and can't be edited: the "All …" pages for each kind, and days (`@day:today`).

## Time
Seven records what happens (who made, changed or talked about what) as pointers to entries, never copies. Delete an entry and its history goes with it. Days and routines are built on this.

## Who sees what
You see everything. Each agent sees what its library access allows; an agent's mind is private to it; vault entries are hidden while it's locked. Agents can read routines but never set them up, and they never set permissions.

## A shared space
Anything written in Seven, by you, an agent or an add-on, is there for the others without copy-pasting.

# Kinds

Everything Seven keeps is an **entry** of a **kind**: a page, a file, a workout plan, a world record, a chat, an agent, a theme… A kind is the one place that knows its data. Everything else (agents, the Data tab, boards, links, export, ingest) asks the kind and never decides on its behalf.

## What makes something a kind
It has its own shape of data that plain text, items and media can't express, plus rules or actions over it. A reading list is a page with items. A workout plan, with sessions and "ready to progress", is a kind.

## What every kind must do
Engine side (`src/engine/library/kinds.ts`, the `Kind` interface):

- **Name itself:** `kind` (id), `label`, `plural`, `icon`.
- **Describe itself to agents:** a one-line `description` of what it is and what it's for. It goes into every agent's prompt, so keep it short and plain.
- **Say when it exists:** `available(ctx)`, e.g. only while its module is on, or only for an agent.
- **Find its entries:** `search(query, limit, ctx)` returns id, title, a short summary, and a time for sorting.
- **Know its entries by name:** `resolve(ref, ctx)` turns an id or a title into an id, so links and agents can use plain names.
- **Reduce itself for an agent:** `read(id, options, ctx)` returns text a small local model can take in. It should be short and to the point, clipped when long (pointing to the section or search that gets the rest), and markdown where structure helps. The agent works only from this, so it must be enough to act on.
- **Title its entries:** `title(id)`.
- **Export itself:** `exportable`, and `export(id, ctx)` returning a title, markdown (readable, good for pasting into another LLM) and JSON (the real data, ideally in a form Seven can take back in).
- **Respect who's asking:** `ctx` says whether it's the user or an agent. An agent only gets what its library access allows. Private data (an agent's memory, vault agents' chats) stays private.

Optional:

- `parts` and `defaultPart`: the named pieces an entry can be shown as (statblock, today, code…). `textParts` are parts that are just its `read` text.
- `readView`: `read` plus a view for the chat (pages do this).
- `place`: how a whole entry sits on a board, when it has a native widget.
- `actions`: its own tools (`workout_log`, `run_python`…), listed under it in the agent's prompt.

## What the app side gives a kind
Renderer side (`src/renderer/src/registries/kinds.tsx`; built-ins registered in `components/data/kindUis.tsx`):

- `screen`: where an entry opens in Data. Every kind needs one, because anything an agent can do the user must be able to do too.
- `whole`: it also has a screen for the kind as a whole.
- `open`: opens somewhere else instead (agents, boards).
- `add`: how the user makes a new one.
- `thumb`, `menu`, `timed`, `quiet`: list picture, extra right-click items, show times, keep out of Recent.
- Part views: `registerPartView(kind, part, Component)`.

## Rules
- **Never switch on a kind anywhere else.** If something needs to behave differently per kind, it's a property or method of the kind.
- **Every entry can be found, read, linked and exported**, and shown when it has parts. Links are `@kind:Name`, with `#part` where the kind offers link parts.
- **Keep what agents read small.** Seven runs on small local models with tight context, so a kind's description and read text cost context on every use.

## Add-on kinds
An add-on declares kinds in its `module.json` (`kinds: [{ type, label, plural, icon, description, parts, widget }]`). They're stored as typed pages, so they get search, read, export and the page screen for free, and draw their own parts. Their id is `<module>.<type>`.

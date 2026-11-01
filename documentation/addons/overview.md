# Add-ons

An add-on is a folder that teaches Seven something new: new tools for agents, new kinds of entry, its own screens and widgets. It's plain JavaScript and HTML; you don't need to build or compile anything.

## Where they live
Your Tools folder, set in Settings (yours is `C:\Users\YOUR_USER\.seven\tools`). Each add-on is one folder in it, e.g. `tools\quotes\`.

Seven finds the folder when it starts. It shows up in **Tools** waiting for you to approve it. If any file in the folder changes, Seven pauses it and asks you to approve it again, so nothing changes behind your back.

## What an add-on can add
- **Tools** for agents, e.g. `quotes_add`. Each tool has a name, a description the agent reads, the parameters it takes, and the code that runs.
- **Kinds**: new kinds of entry in the library (see `../kinds/overview.md`). Add-on kinds are stored as pages, so they get search, links, export, the Data tab and access control for free.
- **Parts**: HTML views of an entry (a character sheet, a statblock, a card). They show in Data, in chats, on boards and on stage.
- **A screen of its own** in Data or the side panel.
- **Presentations**: fill-in HTML layouts an agent can show with `present_<type>`.
- **Settings** you fill in under Tools (a path, a number, a key).
- A short **prompt** added to agents that use it, and **help** they can read when stuck.

## What every add-on must do
- **Describe itself well.** Agents run on a small local model, so tool descriptions, results, `prompt.md` and kind descriptions are short and plain.
- **Reduce its entries for agents.** For each kind, `pageText` returns the few lines an agent needs, not a dump.
- **Be usable without an agent.** If an agent can do it with a tool, you can do it on the add-on's screen or part view.
- **Prefix tool names** with the add-on's id (`quotes_add`, not `add`).
- **Keep data in Seven.** Use `this.pages`, `this.files` and `this.storage`. They're encrypted with the vault; your own files elsewhere aren't.
- **No network in views.** HTML views can't load anything from outside, so put everything in the file.

## The files
```
quotes/
  module.json   what it is: id, name, kinds, settings, permissions
  index.js      the code: tools, how entries read to agents, view data, actions
  prompt.md     1–3 sentences agents always see when the add-on is on
  help.md       details agents read with tool_help("quotes")
  card.html     a part view (any number of .html files)
```

## Where to go next
- `first-addon.md` builds a small, complete add-on step by step.
- The D&D add-on in your Tools folder (`tools\dnd\`) is a working example with a kind, two parts and tools.
- The `seven-addon` skill has the full reference. Ask Claude to use it when writing one.

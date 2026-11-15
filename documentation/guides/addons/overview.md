# Add-ons

An add-on (tool module) is a folder that teaches Seven something new: tools for agents, new kinds of entry, screens, part views, presentations and settings. It's plain JavaScript and HTML; nothing to build or compile.

- `first-addon.md`: a small, complete add-on, step by step.
- `sdk.md`: what the SDK gives your code, and when to use an MCP server instead.
- `agent-prompt.md`: a prompt to give an agent so it writes an add-on for you.
- `../kinds/overview.md`: kinds. Most of what an add-on can do comes from declaring a kind, so read this before designing one.

## Where they live
Your Tools folder (Tools → folders; by default `C:\Users\YOUR_USER\.seven\tools`). One folder per add-on, named by its id, e.g. `tools\quotes\`.

Seven finds new folders by itself. A new add-on shows in **Tools** as **Not enabled** until you switch it on. If any of its files change, it pauses as **Changed** until you switch it on again, so nothing changes behind your back.

## Installing one
- **From a zip:** Tools → **Install from zip**. The zip holds the add-on's files with `module.json` at its top (or inside one folder at its top). Seven checks it, puts it in your Tools folder under its id and leaves it **Not enabled**. Installing a newer version of one you have asks first.
- **By hand:** copy the folder into your Tools folder.

## The files
```
quotes/
  module.json   what it is: id, name, kinds, settings, permissions, dependencies
  index.js      the code: tools, how entries read to agents, view data, actions
  prompt.md     1–3 sentences agents always see while the add-on is on
  help.md       details agents read with tool_help("quotes")
  card.html     a part view (any number of .html files)
```

## module.json
| Field | What it does |
| :--- | :--- |
| `id` | Lower-case letters, numbers and `-`. Prefix of every tool name. |
| `name`, `description`, `version` | Shown in Tools. |
| `apiVersion` | `1`. |
| `entry` | The code file, default `index.js`. |
| `permission` | `none`, `ask`, `always` or `custom`: whether its tools ask before running. |
| `toolPermissions` | Per-tool override, e.g. `{ "quotes_delete": "ask" }`. |
| `kinds` | New kinds of entry (see `../kinds/overview.md`). |
| `settings` | Fields filled in under Tools (a path, a number, a key). Secrets are kept in the vault. |
| `actions` | Buttons under Tools that call `onAction`. |
| `panel` | A screen of its own in the side panel. |
| `presentations` | Fill-in HTML layouts agents show with `present_<type>`. |
| `dependencies` | Ids of add-ons it needs, e.g. `["world"]`. While any is off or missing it stays inactive (**Needs another module**) and its tools don't run. |
| `needsWorkspace` | Its tools need the agent's workspace folder. |
| `tools: false` | It adds kinds or screens but no tools. |
| `type: "mcp"` | It is an MCP server, not code (see `sdk.md`). |

In **Tools**, each add-on shows **Requires** (its dependencies) and **Adds** (what it actually registered: kinds, map tokens, bestiaries, sheet tabs).

## What every add-on must do
- **Describe itself well.** Agents run on small local models, so tool descriptions, results, `prompt.md` and kind descriptions are short and plain.
- **Reduce its entries for agents.** `pageText` returns the few lines an agent needs, not a dump.
- **Be usable without an agent.** Anything an agent can do with a tool, you can do on its screen or part view.
- **Prefix tool names** with its id (`quotes_add`, not `add`).
- **Keep data in Seven.** Use `this.pages`, `this.files` and `this.storage`, which are encrypted with the vault.
- **No network in views.** HTML views can't load anything from outside.
- **Declare dependencies** instead of describing them in prose.

---
title: Add-ons Overview
section: Add-ons & Extending Seven
order: 60
summary: How Seven add-ons (tool modules) work — folder layout, installation, module.json manifest fields, and design rules.
tags: [addons, modules, tools, plugins, extending, manifest]
---

An **add-on** (tool module) is a folder that teaches Seven something new: tools for agents, new kinds of library entry, screens, part views, presentations, and settings. It's plain JavaScript and HTML — nothing to build or compile.

- [Your First Add-on: Quotes](guide:10-first-addon) — a small, complete add-on, step by step.
- [Add-on SDK & MCP Reference](guide:11-addons-sdk) — what the SDK gives your code, and when to use an MCP server instead.
- [Prompt: Have an Agent Write an Add-on](guide:12-addons-agent-prompt) — a ready-to-copy prompt so a coding agent builds an add-on for you.

## Where They Live

Open [Tools](seven-view:tools) → **folders** (by default `C:\Users\YOUR_USER\.seven\tools`). Use one folder per add-on, named by its id (for example `tools\quotes\`).

Seven finds new folders automatically. A new add-on shows in **Tools** as **Not enabled** until you switch it on. If any of its files change, it pauses as **Changed** until you approve it again, so nothing changes behind your back.

## Installing an Add-on

- **From a zip:** Open [Tools](seven-view:tools) → **Install from zip**. The zip holds the add-on's files with `module.json` at its top (or inside one folder at its top). Seven checks it, puts it in your Tools folder under its id, and leaves it **Not enabled**. Installing a newer version asks first.
- **By hand:** Copy the folder directly into your Tools folder.

## Folder Layout

```text
quotes/
  module.json   what it is: id, name, kinds, settings, permissions, dependencies
  index.js      the code: tools, how entries read to agents, view data, actions
  prompt.md     1–3 sentences agents always see while the add-on is on
  help.md       details agents read with tool_help("quotes")
  card.html     a part view (any number of .html files)
```

## `module.json` Reference

| Field | What it does |
| --- | --- |
| `id` | Lower-case letters, numbers, and `-`. Prefix of every tool name. |
| `name`, `description`, `version` | Shown in Tools. |
| `apiVersion` | `1`. |
| `entry` | The code file, default `index.js`. |
| `permission` | `none`, `ask`, `always`, or `custom` — whether its tools ask before running. |
| `toolPermissions` | Per-tool override, e.g. `{ "quotes_delete": "ask" }`. |
| `kinds` | New kinds of library entry. |
| `settings` | Fields filled in under Tools (a path, number, or key). Secrets are kept in the vault. |
| `actions` | Buttons under Tools that call `onAction`. |
| `panel` | A screen of its own in the side panel. |
| `presentations` | Fill-in HTML layouts agents show with `present_<type>`. |
| `dependencies` | Ids of add-ons it needs, e.g. `["world"]`. While any is off or missing it stays inactive (**Needs another module**) and its tools don't run. |
| `needsWorkspace` | Its tools need the agent's workspace folder. |
| `tools: false` | Adds kinds or screens without registering tools. |
| `type: "mcp"` | An MCP server instead of JS code (see [Add-on SDK & MCP Reference](guide:11-addons-sdk)). |

In [Tools](seven-view:tools), each add-on shows **Requires** (its dependencies) and **Adds** (what it actually registered: kinds, map tokens, bestiaries, sheet tabs).

## Rules Every Add-on Must Follow

- **Describe itself well.** Agents often run on small local models, so tool descriptions, results, `prompt.md`, and kind descriptions must be short and plain.
- **Reduce entries for agents.** `pageText` returns the few lines an agent needs, not a raw dump.
- **Usable without an agent.** Anything an agent can do with a tool, you can also do on its screen or part view.
- **Prefix tool names** with its id (`quotes_add`, not `add`).
- **Keep data in Seven.** Use `this.pages`, `this.files`, and `this.storage`, which are encrypted with the vault.
- **No network in views.** HTML views cannot load external assets from the internet.
- **Declare dependencies** in `module.json` instead of describing them in prose.

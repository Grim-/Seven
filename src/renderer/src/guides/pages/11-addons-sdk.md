---
title: Add-on SDK & MCP Reference
section: Add-ons & Extending Seven
order: 64
summary: Complete reference for sdk helpers, module methods, view styling CSS tokens, and choosing between an SDK module or MCP server.
tags: [sdk, mcp, api, styling, css, views, addons]
---

`index.js` exports a function that receives `sdk` and returns your module class:

```js
module.exports = (sdk) => class extends sdk.ToolModule {
  define(tools) { tools.add({ name, description, params, execute }) }
}
```

## On `sdk`

| Member | Purpose |
| --- | --- |
| `sdk.ToolModule` | The base class for add-on modules. |
| `sdk.ToolError(message)` | Throw for bad input; the agent sees the message and can fix its call. |
| `sdk.ToolBlocked(message)` | Throw when the action is not allowed at all. |
| `sdk.params.str / optStr / optInt / optBool` | Read tool arguments safely. |
| `sdk.data` | Seven's data hub (pages, files, and the rest of the library). |
| `sdk.paths.dataRoot`, `sdk.paths.skillsFolder()` | Seven's folders. |
| `sdk.fetch` | `fetch`, for tools that call the web. |
| `sdk.version` | The API version (`1`). |

## On `this` (Your Module Instance)

| Member | Purpose |
| --- | --- |
| `this.pages` | Entries of your kinds: `create(type, title, data)`, `save(id, data)`, `get(id)`, `find(type, ref)`, `list(type)`. |
| `this.storage` | Small key/value store: `get(key, fallback)`, `set`, `delete`, `all`. |
| `this.files` | Files in your own data folder: `readText`, `writeText`, `readBytes`, `writeBytes`, `exists`, `delete`, `list`. Paths outside it are refused. |
| `this.settings` | Values configured under [Tools](seven-view:tools). |
| `this.log` | `info`, `warn`, `error` — written to Seven's logs. |
| `this.id`, `this.manifest`, `this.dir`, `this.dataDir` | Identity and folder paths. |
| `this.refreshView()` | Tell your screen and part views to fetch fresh values. |
| `this.nudgeChat(sessionId, text)` | Post a line into a chat. |
| `this.openBrowser(url)` | Open Seven's built-in browser. |

## Methods You Can Override

| Method | Purpose |
| --- | --- |
| `define(tools)` | Add your tools. Required unless `"tools": false`. |
| `init()` | Runs once when switched on. |
| `dispose()` | Runs when switched off. |
| `pageText(type, page)` | Short text summary an agent reads for one of your entries. |
| `pageView(type, page)` | Values passed to that entry's HTML part views. |
| `onPageAction(type, page, name, payload)` | Handles `window.sevenTemplate.action(name, payload)` from a part view. |
| `view()` / `onAction(name, payload)` | Values and button handlers for your side panel screen and `module.json` actions. |
| `pageRoll(type, page)` / `pageDraw(type, page, count)` | Lets dice and draw tools pick from your entries (tables, decks). |

## Registering a Tool

```js
tools.add({
  name: 'quotes_add',
  description: 'Save a quote. who is optional.',
  params: { type: 'object', properties: { text: { type: 'string' }, who: { type: ['string', 'null'] } } },
  permission: 'none',
  execute: async (args, ctx) => 'Saved.'
})
```

Optional tool properties: `permission`, `needsWorkspace`, `maxRepeats`, `fitsItself`, `command`. Give any parameter with a fixed set of choices an `enum` so the model can only pick valid values.

## SDK Module vs. MCP Server

| | SDK module | MCP server (`"type": "mcp"`) |
| --- | --- | --- |
| What it is | JavaScript running inside Seven. | A separate program Seven talks to over stdio or HTTP. |
| Adds | Tools, kinds, part views, screens, presentations, settings, actions. | Tools only. |
| Data | Library entries, storage, and files encrypted with the vault. | Whatever the server keeps outside Seven. |
| Shows in Seven | Entries in Data, cards in chats and boards, links, export. | Tool results only. |
| Language | JavaScript. | Any. |
| Best for | Anything that stores data, has UI, or feels native to Seven. | Reusing an existing MCP server or tools in another language. |

To add an MCP server, open [Tools](seven-view:tools) → **Import mcp.json**, or create a folder with a `module.json`:

```json
{
  "id": "my-server",
  "name": "My server",
  "type": "mcp",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "some-mcp-server"],
  "env": {}
}
```

## Styling Views with Seven Tokens

Part views and HTML widgets automatically receive CSS variables from the active skin and theme:

- **Colours:** `--bg`, `--card`, `--panel`, `--surface`, `--well`, `--ink`, `--dim`, `--faint`, `--line`, `--line-strong`, `--accent`, `--accent-soft`, `--on-accent`, `--secondary`, `--secondary-ink`, `--alert`, `--ok`, `--warn`, `--tint-cyan`, `--tint-teal`, `--tint-purple`.
- **Fonts:** `--font-body`, `--font-heading`, `--font-ui`, `--font-label`, `--font-data`, `--font-mono`, `--font-sans`.
- **Labels:** `--label-case`, `--label-tracking`, `--label-variant`.
- **Legacy aliases:** `--text`, `--cyan`, `--mono`, `--sans`.

Built-in utility classes: `s-panel`, `s-title`, `s-label`, `s-dim`, `s-faint`, `s-mono`, `s-row`, `s-grid` (`--min` sets column width), `s-btn` (`primary`, `danger`), `s-tabs` / `s-tab` (`on`), `s-input`, `s-textarea`, `s-select`, `s-chip`, `s-stat` (`<b>` value, `<span>` label), `s-note`.

A view built on these follows every skin change automatically without touching its code.

Next: [Prompt: Have an Agent Write an Add-on](guide:12-addons-agent-prompt).

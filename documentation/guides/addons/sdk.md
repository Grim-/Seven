# The SDK

`index.js` exports a function that receives the SDK and returns your module class:

```js
module.exports = (sdk) => class extends sdk.ToolModule {
  define(tools) { tools.add({ name, description, params, execute }) }
}
```

## On `sdk`
| | |
| :--- | :--- |
| `sdk.ToolModule` | The base class. |
| `sdk.ToolError(message)` | Throw for bad input; the agent sees the message and can fix its call. |
| `sdk.ToolBlocked(message)` | Throw when the action is not allowed at all. |
| `sdk.params.str / optStr / optInt / optBool` | Read tool arguments safely. |
| `sdk.data` | Seven's data hub (pages, files and the rest of the library). |
| `sdk.paths.dataRoot`, `sdk.paths.skillsFolder()` | Seven's folders. |
| `sdk.fetch` | `fetch`, for tools that call the web. |
| `sdk.version` | The API version (`1`). |

## On `this` (your module)
| | |
| :--- | :--- |
| `this.pages` | Entries of your kinds: `create(type, title, data)`, `save(id, data)`, `get(id)`, `find(type, ref)`, `list(type)`. |
| `this.storage` | Small key/value store: `get(key, fallback)`, `set`, `delete`, `all`. |
| `this.files` | Files in your own data folder: `readText`, `writeText`, `readBytes`, `writeBytes`, `exists`, `delete`, `list`. Paths outside it are refused. |
| `this.settings` | The values filled in under Tools. |
| `this.log` | `info`, `warn`, `error`, shown in Seven's logs. |
| `this.id`, `this.manifest`, `this.dir`, `this.dataDir` | Who and where you are. |
| `this.refreshView()` | Tell your screen and part views to fetch fresh values. |
| `this.nudgeChat(sessionId, text)` | Post a line into a chat. |
| `this.openBrowser(url)` | Open Seven's browser. |

## Methods you override
| | |
| :--- | :--- |
| `define(tools)` | Add your tools. Required unless `"tools": false`. |
| `init()` | Runs once when switched on. |
| `dispose()` | Runs when switched off. |
| `pageText(type, page)` | What an agent reads for one of your entries. Keep it short. |
| `pageView(type, page)` | Values for that entry's HTML part views. |
| `onPageAction(type, page, name, payload)` | A button in a part view called `window.sevenTemplate.action(name, payload)`. |
| `view()` / `onAction(name, payload)` | Your own screen's values, and its buttons (and the `actions` in `module.json`). |
| `pageRoll(type, page)` / `pageDraw(type, page, count)` | Lets the dice and draw tools pick from your entries (tables, decks). |

## A tool
```js
tools.add({
  name: 'quotes_add',
  description: 'Save a quote. who is optional.',
  params: { type: 'object', properties: { text: { type: 'string' }, who: { type: ['string', 'null'] } } },
  permission: 'none',
  execute: async (args, ctx) => 'Saved.'
})
```
Optional: `permission`, `needsWorkspace`, `maxRepeats`, `fitsItself`, `command`. Give any field with a fixed set of values an `enum`, so the model can only pick a valid one.

## SDK module or MCP server?
| | SDK module | MCP server (`"type": "mcp"`) |
| :--- | :--- | :--- |
| What it is | JavaScript running inside Seven. | A separate program Seven talks to over stdio or HTTP. |
| Adds | Tools, kinds, part views, screens, presentations, settings, actions. | Tools only. |
| Data | Library entries, storage and files, encrypted with the vault. | Whatever the server keeps, outside Seven. |
| Shows in Seven | Entries in Data, cards in chats and on boards, links, export. | Tool results only. |
| Language | JavaScript. | Any. |
| Best for | Anything that keeps data, has a UI, or should feel part of Seven. | Reusing an existing MCP server, or tools written in another language. |

To add an MCP server: Tools → **Import mcp.json**, or a folder whose `module.json` is:
```json
{ "id": "my-server", "name": "My server", "type": "mcp", "transport": "stdio", "command": "npx", "args": ["-y", "some-mcp-server"], "env": {} }
```

## Styling views
Part views and HTML widgets get Seven's look as CSS variables, filled from the user's skin and theme:
- Colours: `--bg`, `--card`, `--panel`, `--surface`, `--well`, `--ink`, `--dim`, `--faint`, `--line`, `--line-strong`, `--accent`, `--accent-soft`, `--on-accent`, `--secondary`, `--secondary-ink`, `--alert`, `--ok`, `--warn`, `--tint-cyan`, `--tint-teal`, `--tint-purple`.
- Fonts: `--font-body`, `--font-heading`, `--font-ui`, `--font-label`, `--font-data`, `--font-mono`, `--font-sans`.
- Labels: `--label-case`, `--label-tracking`, `--label-variant`.
- Older names still work: `--text`, `--cyan`, `--mono`, `--sans`.

Classes: `s-panel`, `s-title`, `s-label`, `s-dim`, `s-faint`, `s-mono`, `s-row`, `s-grid` (`--min` sets the column width), `s-btn` (`primary`, `danger`), `s-tabs` / `s-tab` (`on`), `s-input`, `s-textarea`, `s-select`, `s-chip`, `s-stat` (`<b>` value, `<span>` label), `s-note`.

A view built on these follows the user's skin with no change on its side. A view with its own colours and fonts keeps its own look. An open view picks up a skin change the next time it loads. Skin font files are not passed into views; the font's family stack is used.

## Kinds
Most of an add-on's reach comes from its kinds: entries that can be searched, read, linked, exported, shown as parts and placed on boards. See `../kinds/overview.md` for everything a kind can implement.

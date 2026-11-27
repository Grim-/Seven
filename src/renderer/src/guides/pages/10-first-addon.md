---
title: Your First Add-on: Quotes
section: Add-ons & Extending Seven
order: 62
summary: Build a complete working Seven add-on in five minutes with a custom Quote kind, tool, and interactive HTML card.
tags: [addons, tutorial, quotes, module, html, kinds]
---

A complete add-on that keeps quotes. Agents can save them, each quote becomes an entry in the library, and it shows as a card in [Data](seven-view:data), chats, and boards. It takes about five minutes: make the files, reload or restart Seven, and approve it.

## 1. Make the Folder

In your Tools folder (open [Tools](seven-view:tools) → folders), create `quotes\`.

## 2. `module.json` — What It Is

```json
{
  "id": "quotes",
  "name": "Quotes",
  "description": "Keep quotes you like. Agents can save them and find them.",
  "version": "1.0.0",
  "apiVersion": 1,
  "entry": "index.js",
  "permission": "none",
  "kinds": [
    {
      "type": "quote",
      "label": "Quote",
      "plural": "Quotes",
      "icon": "quote",
      "description": "a saved quote: the words and who said them",
      "parts": { "card": "card.html" },
      "widget": "card"
    }
  ]
}
```

- `id`: lower-case, and the prefix for every tool name.
- `permission: "none"` lets tools run without asking. Use `"ask"` for anything that changes data you care about.
- `kinds` adds the **Quote** kind. Its entries are pages of type `quotes:quote`, and its kind id is `quotes.quote`.
- `parts` maps a part name to an HTML file. `widget` is the part shown on boards.

## 3. `index.js` — The Code

```js
module.exports = (sdk) =>
  class Quotes extends sdk.ToolModule {
    define(tools) {
      tools.add({
        name: 'quotes_add',
        description: 'Save a quote. who is optional.',
        params: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            who: { type: ['string', 'null'] }
          }
        },
        execute: async (args) => {
          const text = sdk.params.str(args, 'text').trim()
          if (!text) throw new sdk.ToolError('text is empty')
          const who = sdk.params.optStr(args, 'who') || 'Unknown'
          const saved = new Date().toISOString().slice(0, 10)
          const page = this.pages.create('quote', `${who}: ${text.slice(0, 40)}`, { text, who, saved })
          return `Saved [${page.title}](seven:quotes.quote/${page.id}).`
        }
      })
    }

    pageText(type, page) {
      return `"${page.data.text}" by ${page.data.who}, saved ${page.data.saved}`
    }

    async pageView(type, page) {
      return { values: page.data }
    }
  }
```

- `define(tools)` adds the tools. Every add-on needs at least one unless `"tools": false`.
- `params` is the schema the model fills in. Make optional fields nullable (`['string', 'null']`).
- `execute` returns a short line for the agent. Throw `sdk.ToolError('…')` when input is wrong so the agent can fix its call.
- `this.pages.create(type, title, data)` creates an entry; `this.pages.save(id, data)` updates one.
- `pageText` is what an agent reads for a quote: one concise line.
- `pageView` passes values to the HTML part view.

## 4. `card.html` — The Part View

```html
<div class="s-panel">
  <blockquote id="text" style="font-size:18px;margin:0 0 8px"></blockquote>
  <div id="who" class="s-note"></div>
</div>
<script>
  window.sevenTemplate.onFields(function (v) {
    document.getElementById('text').textContent = '"' + v.text + '"'
    document.getElementById('who').textContent = v.who + ' · ' + v.saved
  })
</script>
```

- `onFields` receives whatever `pageView` returned, and fires again whenever the entry changes.
- `s-panel`, `s-note`, `s-btn`, `s-input`, `s-chip`, and the other `s-` classes automatically inherit Seven's active theme and skin.
- Any button can call back into `index.js` via `window.sevenTemplate.action('name', payload)`, which invokes `onPageAction(type, page, name, payload)`.

## 5. `prompt.md` and `help.md`

`prompt.md`:

```markdown
## Quotes
When the user shares a line they like, save it with quotes_add. find with kind quote searches saved quotes.
```

`help.md`: a few bullet points with an example call. Agents only read it when they call `tool_help("quotes")`.

## 6. Turn It On

1. Restart Seven, or click **Reload** in [Tools](seven-view:tools).
2. Approve **Quotes** in **Tools**.
3. Open [Agents](seven-view:agents) and enable the **Quotes** tool group on an agent.
4. Ask it to save a quote. It appears in **Data → Quotes**, opens as a card, can go on a board, and agents can find, read, link, and show it.

## Troubleshooting

- **Shows an error in Tools:** Usually a typo in `module.json` or a tool name missing the `quotes_` prefix.
- **Shows as Changed:** You edited a file — approve it again in Tools.
- **Agent misuses a tool:** Tighten the tool description or add a short example call in `help.md`.

Next: [Add-on SDK & MCP Reference](guide:11-addons-sdk).

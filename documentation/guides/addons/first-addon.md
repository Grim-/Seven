# Your first add-on: Quotes

A complete add-on that keeps quotes. Agents can save them, each quote is an entry in the library, and it shows as a card in Data, chats and boards. It takes about five minutes: make the files, restart Seven, approve it.

## 1. Make the folder
In your Tools folder, make `quotes\`.

## 2. module.json: what it is
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
- `permission: "none"` lets the tools run without asking. Use `"ask"` for anything that changes things you care about.
- `kinds` adds the **Quote** kind. Its entries are pages of type `quotes:quote`, and its kind id is `quotes.quote`.
- `parts` maps a part name to an HTML file. `widget` is the part shown on boards.

## 3. index.js: the code
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
- `define(tools)` adds the tools. Every add-on needs at least one.
- `params` is the shape the model must fill in. Make optional things nullable, like `who`.
- `execute` returns a short line for the agent. Throw `sdk.ToolError('…')` when the input is wrong; the agent sees the message.
- `this.pages.create(type, title, data)` makes an entry of your kind. `this.pages.save(id, data)` changes one.
- `pageText` is what an agent gets when it reads a quote: one short line.
- `pageView` gives the HTML part its values.

## 4. card.html: the part view
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
- `onFields` gets whatever `pageView` returned, and gets it again whenever the entry changes.
- `s-panel`, `s-note`, `s-btn`, `s-input`, `s-chip` and the other `s-` classes give you Seven's look.
- A button can call back into the add-on with `window.sevenTemplate.action('name', payload)`, which runs `onPageAction(type, page, name, payload)` in index.js.

## 5. prompt.md and help.md
`prompt.md`:
```
## Quotes
When the user shares a line they like, save it with quotes_add. find with kind quote searches saved quotes.
```
`help.md`: a few bullet points with an example call. Agents only read it when they ask.

## 6. Turn it on
1. Restart Seven, or use Reload in Tools.
2. In **Tools**, approve **Quotes**.
3. In **Agents**, give an agent the Quotes tools.
4. Ask it to save a quote. It appears in **Data → Quotes**, opens as a card, can go on a board, and the agent can find, read, link and show it.

## When something's wrong
- The add-on shows an error in **Tools**: usually a typo in `module.json` or a tool name without the `quotes_` prefix.
- It shows as **changed**: you edited a file; approve it again.
- An agent misuses a tool: make the description clearer, or put an example in `help.md`.

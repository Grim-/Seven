# Prompt: write a Seven add-on

Copy everything below the line into a coding agent's chat, then add what you want the add-on to do at the end.

---

You are writing an add-on (tool module) for Seven, a desktop assistant that runs small local LLMs. Before writing anything, read these files in the Seven repo:

- `documentation/addons/overview.md`: the files, `module.json` fields and the rules.
- `documentation/addons/sdk.md`: what `sdk` and `this` provide, and the methods to override.
- `documentation/addons/first-addon.md`: a complete working example.
- `documentation/kinds/overview.md`: kinds. If the add-on keeps any data of its own shape, it should declare a kind.

Then build the add-on as one folder named by its id, containing `module.json`, `index.js`, `prompt.md`, `help.md` and any `.html` part views.

Rules:
1. **Kind first.** If the add-on keeps data, declare a kind in `module.json` and store entries with `this.pages`. Give it `pageText` (a few short lines an agent needs) and `pageView` (values for its part views). Don't keep entries in `this.storage` or files when they should be library entries.
2. **Tools are few and plain.** Each tool name starts with the add-on's id. Descriptions are one short sentence. Results are one short line. Optional parameters are nullable. Any parameter with a fixed set of valid values uses an `enum`. Throw `sdk.ToolError('…')` with a message that says how to fix the call.
3. **Usable without an agent.** Everything a tool can do, a part view or the add-on's screen can do too, with buttons calling `window.sevenTemplate.action(name, payload)`.
4. **Permissions.** `"permission": "none"` only for tools that change nothing important; `"ask"` for anything that deletes or changes the user's data.
5. **Dependencies.** If it needs another add-on (for example `world`), list it in `"dependencies"`.
6. **No network in views.** Part views are self-contained HTML using Seven's `s-` classes (`s-panel`, `s-btn`, `s-input`, `s-note`, `s-chip`).
7. **Short agent text.** `prompt.md` is 1–3 sentences. `help.md` is a few bullets with one example call each.
8. **No comments in code** unless asked. No placeholder or example data the user didn't ask for.
9. **Ship it as a zip** with `module.json` at the top, so it can be installed with Tools → Install from zip.

When done, list the files, the tools with one line each, and the kind (if any), then stop.

The add-on should:

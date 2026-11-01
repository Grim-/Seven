# Portable Seven

Take your agents and everything they have with you: a folder on a memory stick that runs on any Windows PC, no install.

## Rules

- A path is the path. Seven never rewrites, relativises or goes looking for a file somewhere else.
- If something isn't where its path says, Seven tells the user what is missing and lets them point at it. Nothing is dropped silently.
- Models live wherever the user keeps them: on the stick, on the PC, shared with other apps. Seven doesn't care.

## 1. Data next to the app

Today the data root is `SEVEN_HOME` or `~/.seven` (`src/main/paths.ts`). Main passes it to the engine as `SEVEN_HOME`, so only main decides.

- If a `data` folder sits next to `seven.exe`, that is the data root. Otherwise it's `SEVEN_HOME` or `~/.seven` as now.
- In portable mode, also point Electron's own storage there (`app.setPath('userData', <data>/electron)` before `ready`) so nothing lands in `%APPDATA%`.
- Settings shows which mode Seven is in and where the data is (`app.info` already returns `dataDir`).
- Moving an existing install: copy `~/.seven` into `data`.

## 2. Packaging

- Add a portable build next to the NSIS installer: the unpacked app folder (`electron-builder --dir`) zipped, with an empty `data` folder in it.
- Not electron-builder's single-file `portable` target: it unpacks itself to a temp folder on every launch, which is slow from a stick.

## 3. Missing models

Today:
- A model's id is its name plus a hash of its full path; agents, configs and templates point at that id.
- `scan()` drops a hand-added model whose file is gone, and a rescan drops folder models that aren't found.
- Loading a model that isn't there fails with whatever node-llama-cpp throws.

Change:
- Keep the entry when its file is missing; mark it missing in the model list.
- Before loading, check the file exists. If not: "Model not found: `<path>`", with Locate and Pick another.
- Locate updates that entry's path and keeps its id, so agents, configs and templates stay attached.
- An agent whose model is missing still opens with all its data; the chat says which model it wants.

## 4. Other saved paths

Same rule for workspaces, the Python folder, model folders and attachments: kept as saved, and when one is missing Seven says which and offers to point it elsewhere.

## 5. Things that already work

- The vault is locked by the user's password, not by Windows, so it opens on any PC.
- CUDA is found through the toolkit installed on the PC (`addCudaToPath`); on a PC without it Seven falls back to Vulkan or CPU.

## Order

1. Missing models (worth having anyway).
2. Data next to the app.
3. Other saved paths.
4. Portable build.

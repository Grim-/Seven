# Optimization packs

Built, not yet run. Seven ships three packs in `packs/` at the repo root (copied next to `seven.exe` when packaged): MoE experts in RAM when the model is bigger than VRAM, an 8-bit context cache on GPUs under 8 GB, and the vision adapter in RAM on GPUs under 6 GB. Your own packs go in `packs` in Seven's app data folder; the Packs page imports into it, deletes from it and opens it.

## Why

llama.cpp keeps gaining options that help in narrow situations: a small GPU with a big MoE model, a model whose context only just fits, a CPU with few cores, a card on an older CUDA. Each one is worth turning on for the machines and models it suits and wrong everywhere else. Adding them to Seven one by one, as special cases in code, doesn't scale and hides why a setting is what it is. A pack is one small file that says what it changes, when it applies and where it came from. Seven offers it only where every condition holds, and you choose whether it applies.

An example of where packs fit: llama.cpp discussion #31876 (RFC, November 2026, not merged) proposes placing MoE expert weights across VRAM, RAM and flash by how often they are used, extending `--fit` and the in-progress `llama_moe_cache`. If parts of it land as options, a pack for "MoE model larger than VRAM" is how they would reach a machine like this one.

## What a pack is

One JSON file:

```json
{
  "id": "moe-experts-in-ram-small-gpu",
  "title": "Keep MoE experts in RAM on small GPUs",
  "for": "Low-end GPU with lots of PC RAM, MoE experts on CPU",
  "why": "Frees VRAM for context and attention on cards under 8 GB.",
  "source": "https://github.com/ggml-org/llama.cpp/pull/…",
  "when": { "model": ["moe"], "vramBelowGb": 8, "buildHas": ["--cpu-moe"] },
  "set": { "cpuMoeAll": true, "fit": "on" }
}
```

- `for` is a short line on the situation the pack is for, shown under its title. Why: you can tell at a glance whether a pack is about your kind of setup.
- `why` and `source` are required. Why: a setting you didn't choose yourself must say why it is there and where the idea came from.
- `set` uses only existing model settings, by their keys in `engine/model/params.ts`. Why: everything a pack changes is then visible on the settings pages, checked against its range and choices, greyed by the same rules, and turned into flags by the same code. A llama.cpp flag Seven has no setting for gets a setting definition first (one line), which every pack can then use; a pack never carries raw flags.
- A pack whose file names an unknown key, a value outside a setting's range or choices, or an unknown condition is listed as invalid with the exact problem, and never applies. Why: a typo must not silently do nothing or something else.
- Packs fail gracefully: a file that can't be read, isn't JSON, isn't a JSON object, reuses another file's id or has a condition that throws while being read or checked becomes an invalid or not-matching pack with the reason. Nothing in a pack file can stop Seven, the Packs page or a model from loading.

## When a pack applies

`when` holds conditions; a pack matches when all of them hold. Each condition type registers itself with `registerCondition` (the starting ones in `engine/packs/conditions.ts`, like `sources/builtin.ts`) with its name, how to read its value from the facts below, and how to say why it failed. Why: a new kind of condition is one new file, with no list of condition names in shared code.

The facts conditions read, all from real data Seven already has or can read:
- **Model**: the classifiers in `modelTraitSet` (MoE, dense, MTP, sliding window, vision), architecture, parameter count and file size from the GGUF header.
- **Machine**: VRAM total and free and compute capability (`nvidia-smi --query-gpu`), RAM (`os.totalmem`), CPU cores, the backends the active build sees (`--list-devices`, stored with each version).
- **Build**: the flags in the active llama-server version's stored `--help`. Why: a pack for a new llama.cpp feature shows up by itself once you are on a build that has it, and disappears if you switch back to one that doesn't.

Starting set of conditions: `model` (traits), `architecture`, `paramsAboveB`/`paramsBelowB`, `fileAboveGb`, `vramBelowGb`/`vramAboveGb`, `ramBelowGb`, `fileExceedsVram` (model file bigger than free VRAM), `backend`, `buildHas`.

## How a pack applies

- Packs are a layer: the value used is the default, then the packs you turned on for that model in order, then your own changes. Why: turning a pack off removes only its layer and never touches values you set yourself, and your own change always wins over a pack.
- Turned on per model, stored with the model's config as an ordered list of pack ids. Why: the same pack can be right for one model and wrong for another on the same machine.
- When two packs you turned on set the same setting, the Packs page shows the conflict and the later one in your order wins; you reorder to change it.
- A pack that stops matching (new build, other GPU) stays on in your list but is marked not matching and applies nothing until it matches again. Why: switching builds back and forth must not lose your choices.
- `serverArgs` and `needsRestart` read the effective config, so the reload notice and the command line include pack values.

## Where packs live

- A packs folder in Seven's machine folder (next to `installs.json`), read on start and each time the Packs page opens. Why: packs are about the machine and its llama-server, not a vault, and adding one is dropping a file in.
- Packs Seven ships, if any, sit in the app's own `packs` folder and are listed the same way, marked as shipped.
- **Import pack** on the Packs page picks a `.json` file, checks it and copies it into your packs folder. It refuses, with the reason, a file with problems, a pack id you already have, or a file name already in the folder. An imported pack with the id of a shipped pack replaces the shipped one.
- **Delete** removes one of your own packs from the folder and from every model's on-list, unless a shipped pack with that id takes its place. Shipped packs can't be deleted, only turned off.

## In the model screen

- A **Packs** section in the model's rail, with the number turned on as its count.
- Packs that match this model, machine and build: title, the `for` line, why, source link, what each one sets, an on/off switch and its place in the order.
- Packs that don't match, folded: each with the condition that failed and the value it saw ("VRAM is 4 GB; needs 8 GB or more").
- Invalid pack files, folded: the file and the problem.
- On every settings page, a value set by a pack is marked with the accent edge and "From pack: <title>"; resetting it there sets your own value back to the pack's.
- Search finds packs by title, `for`, why and the settings they set.

## Engine and files

- `engine/packs/`: `load.ts` (read and validate files; values are checked with the settings' own `coerce`), `registry.ts` (`registerCondition`), `conditions.ts` (the starting conditions), `facts.ts` (model, machine and build facts), `index.ts` (`Packs`: the layering, conflicts and listing).
- Model registry: per-model ordered pack ids; `ownConfig(id)` is your own values (what the settings pages edit) and `getConfig(id)` is defaults, packs and yours, through an overlay the packs service sets, so everything that runs a model gets pack values without changes. A value counts as yours when it differs from the default; setting it back to the default lets a pack's value through.
- IPC: `packs.list` (for a model: matching, not matching, invalid, with reasons), `packs.set` (that model's ordered on-list), `packs.import` (a file into your folder) and `packs.remove` (one of your packs). Agents see nothing of packs.
- Renderer: `components/models/settings/PacksPage.tsx`, the "From pack" marker in `ParamRow` through `TunableRow`.

## Build order

1. Pack file format, validation and the packs folder; facts; the condition registry with the starting conditions.
2. Effective config and its use in `serverArgs`, `needsRestart` and the settings pages.
3. Packs page, the "From pack" marker, search.

## To decide

- Whether packs may also set reply settings (sampling, thinking) or only load settings. Built: any model setting.

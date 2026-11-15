# Writing Effective Agent Tool APIs in Seven

A practical design guide for building LLM-facing tools in Seven, synthesized from agent tool engineering best practices (deterministic offloading, sparse patch updates, token efficiency, self-healing validation) and concrete patterns in this codebase.

---

## Part I — Core Principles

Designing a tool for an LLM is fundamentally different from designing a REST/RPC endpoint for human developers. Humans read full API docs, write glue logic, and tolerate verbose JSON. Models operate inside a finite attention window, choose tools purely from names/descriptions/schemas, and fail disproportionately when asked to perform arithmetic, deep JSON nesting, or multi-step micro-orchestration.

### 1. Coarse-Grained Intent Over Micro-Orchestration
Expose **one high-value verb per user/agent intent**, not five sequential micro-steps.
- **Anti-pattern**: Requiring `get_deck` → `read_card` → `pick_variation` → `roll_dice` → `run_effects` → `consume_card`. Every extra hop compounds latency, token cost, and failure modes.
- **Target**: `play_card({ card, target?, say? })` resolves deck lookup, variation selection, target lookup, dice/effects, card consumption, UI events, and the compact outcome in one call.

### 2. Deterministic Offloading (Code Does Logic, LLM Does Intent)
Never ask the model to compute, pick structural routing modes, or enforce invariants that deterministic code already knows from runtime state.
- **Offload to code**: dice math, stat/bonus lookups, DC resolution, fuzzy entity resolution, saving state, deciding *which* mechanical mode/variation applies to the current scene context, and deduping/throttling.
- **Keep in LLM**: semantic intent (*which* action/memory/card to invoke), narrative framing, and creative decisions.

### 3. Minimal, Flat Schemas
Schema complexity directly drives argument hallucinations ("catalog-size" and nesting effects):
- **Keep parameters flat** (top-level primitives over 3-level nested objects).
- **Drop parameters that can be defaulted from context** (e.g., active session, active agent/character, world save, current target).
- **Use strict types & `enum`** for bounded choices instead of open strings (`phase: ['session', 'recent', 'backstory']`).
- **Make descriptions act as prompt specs**: state format, defaults, *when* to use the tool, and *when not* to use it. Keep schemas short enough that every tool fits comfortably in context.

### 4. Sparse / Patch Updates (`undefined` = Untouched, `null` = Clear)
When updating multi-field records (character sheets, stats, memories, cards, variations), **never force the agent to read the entire object and rewrite unchanged fields**. Re-emitting full state wastes output tokens and routinely drops or hallucinates untouched fields.
- **Three-state contract** for optional update parameters:
  - **Omitted / `undefined`**: keep existing value untouched (merge!).
  - **`null`**: explicitly clear/remove the value (where clearing makes sense).
  - **Provided value**: replace or update only that field.
- **Preserve untouched sub-objects**: If a card has `gameplay` or `roleplay.action.effects`, patching one nested field (e.g. `bonus` or `whatHappens`) should preserve sibling keys and linked trigger actions rather than wiping them with defaults.
- **Seven examples**:
  - Good: [`update_stats`](file:///o:/GitHub/seven/src/modules/core/characterTools.ts#L31-L76) (`pick` keeps existing values when omitted/null) and [`add_character_memory`](file:///o:/GitHub/seven/src/modules/core/characterTools.ts#L172-L248) (`id` patches only supplied fields).
  - Caution: [`game/cardVariation.ts`](file:///o:/GitHub/seven/src/modules/game/cardVariation.ts#L34-L38) currently reconstructs the whole `gameplay` object on apply, resetting omitted `bonus`/`dc` to defaults (`0`/`12`)—any future rework should merge against existing `card.gameplay`.

### 5. Zero Context Bloat on Reads & Returns (Snippet-First Retrieval)
A model's context window is a finite working buffer. Large prose or raw JSON dumps degrade reasoning across the whole turn.
- **Snippet-first pattern** (like code search → open file range):
  - Search tools return ranked **1-line summaries with stable IDs** (e.g., `story_recall({ query })`, mind `recall({ query })`).
  - Full bodies (`detail`, full markdown notes, large logs) are loaded **only on explicit `id` fetch**.
- **Ambient summaries over polling tools**: When small state prevents wasted list calls (e.g., `"Your cards: Firebolt ×2, Pocket Sand ×1"`), include a 1-line summary in context rather than forcing a round-trip read first.
- **Short return strings**: Tool outputs should be 1–6 concise lines stating *what changed*, *mechanical outcome*, and *next instruction if any*—never raw JSON dumps.

### 6. Atomic Pre-Validation & Self-Healing Errors
Agents retry and self-correct reliably when errors explain *why* cleanly and leave state uncorrupted:
- **Validate everything before mutating/consuming**: Check existence, permissions, deck counts, and target ambiguity *before* deducting items, HP, or cards. Failed calls must be zero-side-effect so retries are idempotent-safe.
- **Actionable error payloads**: Never return `"Invalid target"` or generic exceptions. Return exact candidates or next steps:
  - *Bad*: `"Target not found"`
  - *Good*: `"Ambiguous target 'Goblin'. Choose one of: Goblin Scout 1, Goblin Archer 2."`

---

## Part II — Pre-Ship Checklist for New Seven Tools

Before adding or editing any `ToolDef` in Seven:
1. **Can two calls be collapsed into one?** (If the agent always calls Tool A solely to feed Tool B, let Tool B accept friendly refs directly.)
2. **Are any parameters inferable from `ToolContext` (`agentId`, `sessionId`, active world/player)?** (Infer them; keep them optional or omit them.)
3. **Is every decision deterministically computable left out of the model's parameters?** (Roll math, variation selection, DC checks, effect execution.)
4. **Do updates support sparse partial fields?** (Omitted keys preserve current values, including nested sub-fields.)
5. **Do search/list returns stay compact (`snippet + id`)?**
6. **If a call fails on invalid/ambiguous input, does it leave all state unchanged and name valid options in the error text?**

---

## Part III — Reference Blueprint: Agent Card Play (`play_card`)

A concrete application of all six principles above for allowing agents to play their own cards without bloating prompts or forcing variation/targeting guesswork.

### Goal
Let an agent hold its own deck (`agentSide(agent)` in [`cardDecks.ts`](file:///o:/GitHub/seven/src/shared/cardDecks.ts#L57-L60)) and cast cards at **any target** (user PC, party ally, enemy creature, self, or map object) with a single concise tool call, while Seven automatically chooses the right card variation for the scene context.

### 1. Minimal Agent Interface
- **Ambient awareness** (in [`context.ts`](file:///o:/GitHub/seven/src/engine/chat/context.ts) when `play_card` is available and the agent's deck has entries):
  - Inject a single line, e.g.: `Your cards: Firebolt ×2, Pocket Sand ×1, Snide Remark ×1`
- **Single execution tool** (in [`src/modules/cards/index.ts`](file:///o:/GitHub/seven/src/modules/cards/index.ts)):
  ```ts
  play_card({
    card: string,          // Card name or link from agent's deck (fuzzy-matched)
    target?: string | null // "user", "self", sheet name, creature name, or map prop; inferred if omitted
    say?: string | null    // Optional short in-character line displayed on the played card element
  })
  ```

### 2. Automatic Context-Driven Variation Cascade
The engine—never the LLM—picks which variation executes based on live runtime availability:

1. **Priority 1 — `gameplay`** ([`game/cardVariation.ts`](file:///o:/GitHub/seven/src/modules/game/cardVariation.ts)):
   - Chosen when `moduleIsOn('game')`, card has `.gameplay`, AND the resolved context has live game entity state (`sheetSide.hittable` or active `saveInPlay(world)`).
   - Engine resolves caster (`{ sheet }`) and target (`{ sheet } | { creature } | { placed }`), computes d20 + check bonus vs target's defence or fixed `dc`, executes [`runEffects`](file:///o:/GitHub/seven/src/engine/effects/run.ts#L97) on `hit` / `miss`, and persists stat/HP deltas.
2. **Priority 2 — `roleplay`** ([`world/cardVariation.ts`](file:///o:/GitHub/seven/src/modules/world/cardVariation.ts)):
   - Chosen when `gameplay` is unavailable/blocked and card defines `action`, `opposed`, or `decision`:
     - **`action`**: Deterministic roll against DC/stat check + `runEffects` for `actionEffects`.
     - **`opposed`**: Caster stat vs target stat (or `dc`) + `sideEffects`.
     - **`decision`**: If targeting the user player, pauses cleanly with `ctx.ui.ask('decide', ...)` for player choice; if targeting an NPC/self, returns options & instructions concisely.
3. **Priority 3 — `prompt` (Universal Fallback)** ([`promptVariation.ts`](file:///o:/GitHub/seven/src/modules/cards/promptVariation.ts)):
   - Always valid for every card (`happens` + optional `instructions` + `ask`).
   - If the chat is outside tactical `game` mode or lacks matching mechanical targets, the card automatically degrades cleanly to `prompt` mode, rolls any inline `#random` / `@repo` tokens via `rollText`, and returns concise instructions for the agent to play out as an enhanced reply.

### 3. Multi-Target Resolution (Friendly String → `EffectTargetRef`)
Resolve `target` on the engine side before spending the card:
- `"self"` → caster's active sheet (`{ sheet }`)
- `"user"` or omitted *(when clear from chat context)* → chat player (`chatPlayer` → `{ sheet }`)
- Character sheet match (`findSheet(target)`) → `{ sheet }` (works for party allies, rival NPCs, or other agent characters)
- Active world creature (`saveInPlay(world)?.creatures`) → `{ creature: uid }`
- Placed map object ref → `{ placed }`
- **Ambiguity or missing target**: Abort *before* `takeCard` and list exact matching target names (e.g., `"Ambiguous target 'Goblin': Goblin 1, Goblin 2"`).

### 4. Execution Lifecycle & Visual Sync
1. **Atomic validation**: Verify card in `agentSide(agent)` deck (`countOf > 0`), resolve variation & target.
2. **Consume card**: [`takeCard(agentSide(agent), card.name)`](file:///o:/GitHub/seven/src/engine/cards/decks.ts#L93-L98).
3. **Execute engine resolution**: Compute roll/effects via Node [`runEffects`](file:///o:/GitHub/seven/src/engine/effects/run.ts#L97) (or `rollText` for prompt fallback).
4. **Emit UI / chat feedback automatically**:
   - Attach a [`card_play`](file:///o:/GitHub/seven/src/renderer/src/components/cards/cardPlay.ts#L7-L13) element via `ctx.addElement(...)` so chat displays the played card, target, roll, and outcome inline.
   - Forward any `ViewEvent[]` from `EffectOutcome` so HP bars / play tabletop update automatically.
5. **Return compact result** (3–5 lines):
   ```text
   PLAYED Firebolt [gameplay] -> Goblin 2
   Roll: 14 + 5 = 19 vs AC 13 — HIT
   Effects: Goblin 2 HP 12 -> 4
   Play this out in your reply.
   ```

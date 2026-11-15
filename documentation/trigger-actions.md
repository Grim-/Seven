# Trigger Actions & Extensible Action Behaviors

In Seven, a **Trigger Action** (`trigger_action`) is a first-class Data kind that encapsulates deterministic game logic and world state mutations executed directly within the 2D Game Cockpit (such as teleporting a party, awarding items, setting flags, dealing damage, or spawning creatures).

Unlike conversational chat prompts which instruct the LLM, Trigger Actions execute literal game functions with zero latency, zero hallucination risk, and complete predictability.

---

## 1. Architectural Overview

Trigger Actions follow a **Pluggable Handler Registry Pattern**. There are **no hardcoded switch statements**. 

```
                                  [Action Check / Decision / Zone Trigger]
                                                     │
                                                     ▼
                                          [Outcome Resolution]
                                      (calculates target action ID)
                                                     │
                                                     ▼
                                            dispatchOutcome()
                                                     │
                                ┌────────────────────┴────────────────────┐
                                ▼                                         ▼
                        [In 2D Game Cockpit]                        [In AI Chat]
                                │                                         │
                                ▼                                         ▼
                    runTriggerAction(action, ctx)               Preserved as narrative
                                │                               lore & AI story prompts
                                ▼
                   [Look up in Handler Registry]
                                │
                                ▼
                     handler.execute(params, ctx)
```

1. **Storage (`data/triggerActions.json`)**: Trigger actions are stored as records with an `id`, `name`, `actionType`, `params` map, and metadata.
2. **Registry (`TriggerActionHandler<P>`)**: Handlers register their type, technical metadata, parameter editor component, and execution function.
3. **Execution Context (`GameExecutionContext`)**: Handlers receive a comprehensive sandbox providing access to the map canvas, party sheets, inventory, world flags, audio/visual cues, and the engine IPC bus.
4. **Outcome Dispatcher (`dispatchOutcome`)**: Evaluates results from dice rolls, card checks, or player decision picks, safely executing the action in-game while preserving narrative prompt generation for chat.

---

## 2. Implementing a New Action Behavior (For Technical Users & Addons)

To implement a new action behavior, you implement and register a `TriggerActionHandler<P>`.

### The Handler Interface

```typescript
export interface TriggerActionHandler<P = Record<string, unknown>> {
  /** Unique action identifier (e.g. 'cast_spell', 'modify_weather', 'custom_python') */
  type: string

  /** Display label for menus and kind pickers */
  label: string

  /** Technical description shown in the Data editor */
  description: string

  /** Optional lucide icon name */
  icon?: string

  /**
   * UI Editor component rendered inside the Trigger Action editor.
   * MUST use Seven UI components (Field, Input, Segmented, FlagSelect, ItemSelect, etc.).
   */
  Editor: React.ComponentType<{
    params: P
    world?: string
    onChange: (next: P) => void
  }>

  /**
   * Deterministic execution function run when this action fires in the 2D game cockpit.
   */
  execute: (params: P, ctx: GameExecutionContext) => Promise<void> | void
}
```

### The `GameExecutionContext` API

When your handler's `execute` function runs, it receives the active game execution context:

| Property / Method | Description |
| :--- | :--- |
| `ctx.world` | Active world ID. |
| `ctx.map` | Active map ID. |
| `ctx.sheet` | Active player character sheet ID. |
| `ctx.party` | Array of party character sheet IDs. |
| `ctx.flags` | Live key-value store of world flags. |
| `ctx.engine(method, payload)` | Full access to Seven engine IPC endpoints. |
| `ctx.warp(mapId, at)` | Teleport player to a map at coordinates or marker `{ x, y }`. |
| `ctx.giveItem(itemId, count, gold)` | Add item(s) and/or gold currency to inventory. |
| `ctx.removeItem(itemId, count)` | Consume/remove item(s) from inventory. |
| `ctx.setFlag(flag, value)` | Mutate a world flag in the save file. |
| `ctx.modifyHealth(target, amount)` | Damage or heal (`'player'`, `'party'`, or `'target'`). |
| `ctx.spawnCreature(creatureId, factionId, at)` | Place a live creature token onto the map. |
| `ctx.startCombat(encounterId)` | Trigger tactical turn-based battle overlay. |
| `ctx.playCue(cueId, sound)` | Trigger screen shake, flashes, or audio SFX. |
| `ctx.notify(text, tone)` | Surface a HUD feedback toast to the player. |

---

## 3. Step-by-Step Example: Custom Environmental Hazard

Here is a complete, working example of registering a custom action behavior called `poison_cloud`:

```typescript
// src/renderer/src/game/triggerActions/handlers/poisonCloud.tsx
import { registerTriggerActionHandler } from '../registry'
import { Field, Input, Segmented } from '../../../components/ui'

interface PoisonCloudParams {
  damagePerTick: number
  durationSeconds: number
  target: 'player' | 'party'
  screenTint: string
}

registerTriggerActionHandler<PoCloudParams>({
  type: 'poison_cloud',
  label: 'Poison Cloud Hazard',
  description: 'Inflicts ticking poison damage and tints the viewport.',
  icon: 'skull',

  Editor: ({ params, onChange }) => (
    <div className="flex flex-col gap-3 font-mono text-[11px]">
      <div className="grid grid-cols-2 gap-2">
        <Field label="DAMAGE PER SECOND">
          <Input
            type="number"
            min={1}
            value={params.damagePerTick ?? 5}
            onChange={(e) => onChange({ ...params, damagePerTick: Number(e.target.value) })}
          />
        </Field>
        <Field label="DURATION (SECONDS)">
          <Input
            type="number"
            min={1}
            value={params.durationSeconds ?? 6}
            onChange={(e) => onChange({ ...params, durationSeconds: Number(e.target.value) })}
          />
        </Field>
      </div>

      <Field label="AFFECTED TARGETS">
        <Segmented
          value={params.target ?? 'player'}
          options={[
            { value: 'player', label: 'Lead Character Only' },
            { value: 'party', label: 'Entire Party' }
          ]}
          onChange={(target) => onChange({ ...params, target: target as 'player' | 'party' })}
        />
      </Field>
    </div>
  ),

  execute: async (params, ctx) => {
    const damage = params.damagePerTick || 5
    const duration = params.durationSeconds || 6
    const target = params.target || 'player'

    ctx.notify(`A choking poison mist engulfs you!`, 'danger')
    ctx.playCue('screen_shake', 'sfx/gas_leak.wav')

    // Apply immediate tick
    await ctx.modifyHealth(target, -damage)

    // Set a world flag noting that the player was poisoned
    await ctx.setFlag('status_poisoned', true)
  }
})
```

---

## 4. How Outcome Dispatching Works

Actions, Decisions, and Opposed checks do not inline brittle conditional execution. Instead, they use `dispatchOutcome`:

```typescript
import { dispatchOutcome } from '@shared/game/triggerActions/dispatcher'

// When an action roll passes or fails:
const result = rollAction(action, dndStats, character)

await dispatchOutcome({
  narrative: result.outcome,
  cards: result.cards,
  triggerActionId: result.triggerAction // Automatically resolved from passAction / failAction
}, gameExecutionContext)
```

### Safety and Boundaries
1. **Chat Decoupling**: If `gameExecutionContext` is null (e.g. running inside Chat View or the Storyteller conversation), `dispatchOutcome` smoothly skips 2D world side-effects without throwing errors. The narrative prompt and card mechanics continue uninterrupted.
2. **Error Isolation**: If an action handler throws or references a missing asset, the error is caught, surfaced to `ctx.notify(..., 'danger')`, and logged without crashing the map canvas or UI loop.

# Seven Workspace Agent Rules

These rules are strictly binding for all development in the Seven codebase.

## Core Philosophy
Seven is an agentic AI harness, not a traditional web app. Everything is an inspectable Kind or Component. The Play View is a live runtime simulation of data-driven entities.

## UI & UX Engineering Rules
All frontend, HUD, canvas, and dialogue implementations must strictly follow:
@[UI & UX Engineering Rules](docs/ui-ux-rules.md)

### Non-Negotiable Invariants:
1. **Geometry**: Strictly zero rounded corners (`border-radius: 0px !important`).
2. **Typography**: Monospace telemetry font (`font-mono`).
3. **No Emojis**: Strictly zero emojis in code, comments, or UI.
4. **Spatial Discipline**: Symmetrical encounter stacks (allies left, hostiles right), dense action deck, zero colliding floating HUD layers.
5. **Discrete Tile Simulation**: BFS discrete 5ft tile highlights, turn gating, and speed budget deduction.
6. **Data-Driven Composition**: UI must project the entity's underlying Component graph (`Abilities`, `Inventory`, `Resource`, `ActionEconomy`).

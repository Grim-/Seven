# Seven Workspace Agent Rules

These rules are strictly binding for all development in the Seven codebase.

## Strict Privacy & User Data Boundary
- **NEVER inspect, read, list, grep, query, or touch user data directories** outside the repository (specifically `~/.seven`, `C:\Users\Bry\.seven`, user sessions, user data, or personal files).
- **NEVER inspect personal chats, session contents, private notes, or user profiles.**
- All investigation, testing, and debugging must occur strictly within the repository codebase (`o:\GitHub\seven`) using code inspection, unit/integration mocks, and static analysis.

## Core Philosophy
Seven is an agentic AI harness, not a traditional web app. Everything is an inspectable Kind or Component. The Play View is a live runtime simulation of data-driven entities.

## UI & UX Engineering Rules
All frontend, HUD, canvas, and dialogue implementations must strictly follow:
@[UI & UX Engineering Rules](docs/ui-ux-rules.md)

### Non-Negotiable Invariants:
1. **User Data Boundary**: Strictly zero access to `~/.seven`, user data, personal sessions, or personal files. Work exclusively inside the repository.
2. **Geometry**: Strictly zero rounded corners (`border-radius: 0px !important`).
3. **Typography**: Monospace telemetry font (`font-mono`).
4. **No Emojis**: Strictly zero emojis in code, comments, or UI.
5. **Spatial Discipline**: Symmetrical encounter stacks (allies left, hostiles right), dense action deck, zero colliding floating HUD layers.
6. **Discrete Tile Simulation**: BFS discrete 5ft tile highlights, turn gating, and speed budget deduction.
7. **Data-Driven Composition**: UI must project the entity's underlying Component graph (`Abilities`, `Inventory`, `Resource`, `ActionEconomy`).

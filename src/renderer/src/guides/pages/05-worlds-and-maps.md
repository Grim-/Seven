---
title: Worlds, Regions & Map Blueprints
section: Worlds & Maps
order: 50
summary: How Map Blueprint templates differ from live World Atlases, spatial containment, tokens, triggers, and player mode.
tags: [worlds, maps, atlas, blueprints, tokens, triggers, regions, places]
---

Seven separates **reusable Map Blueprints** from **live World Atlases** so you can design a map once and pull fresh copies into as many worlds or campaigns as you like.

## Map Blueprints vs. World Atlases

- **Map Blueprint (Template):** Nothing "lives" inside a blueprint. Zones, markers, and links act as **placers and designators**. When you pull a blueprint into a World, everything comes pre-wired — and from that point on, your World owns its own independent live copy.
- **World Atlas (Live):** Holds live character tokens, active state, fog/visibility, triggers, and links to real places and regions. Both editors share the exact same toolbar, layer deck, and canvas controls so you never have to relearn layouts.

## Spatial Containment: Place → Region → Wilderness

Tokens track where they actually stand on the canvas:

1. If a token is **inside a Place's zone**, that character is counted as being at that **Place**.
2. If you move the token **outside the Place**, it is no longer at that Place — it falls back to the containing **Region**.
3. If the token is outside every Place and Region, its location becomes **Wilderness**.

## Essential Canvas Controls

- **Pan & Zoom:** Drag empty space (or middle-drag) to pan; scroll wheel to zoom smoothly toward the cursor.
- **Click a Token:** Clicking a token in the atlas list or canvas smoothly pans the camera to focus on that token.
- **Right-Click Cancel:** While drawing a zone, placing a marker, or linking stages, right-clicking cleanly cancels the active tool without opening a stray context menu.
- **Categorized Context Menu:** Right-clicking on the canvas opens a categorized menu grouped by action type (Navigate, Create, Edit, View).
- **Collapsible Left Rail:** Toggle the left sidebar collapsed in **both Editor and Player modes** to maximize map space.
- **Floating Toolbar & Layers:** Drag the horizontal toolbar anywhere or lock it in place; use the **Layers** deck to toggle visibility and lock layers independently.
- **Triggers:** Drag and resize trigger zones directly on the map and control their Z-order cleanly.

# Stage 4: Touch

## Goal

Everything reachable with a mouse is reachable with a finger.

## Checklist

- [ ] Context menus (`openMenu`) open from a long press (delay from settings) on the same targets that take a right-click, through the shared context menu pieces, so every existing right-click menu gets it at once.
- [ ] A visible "more" control on `touch:` where a right-click menu is the only way to an action.
- [ ] Hover-only hints that carry real information (disabled reasons, truncated names) get a touch equivalent: tap-and-hold shows the tooltip.
- [ ] Hover-revealed controls are always shown on `touch:`.
- [ ] Touch targets at least the minimum size from settings on `touch:`, applied in the shared button, icon button, row and tab components.
- [ ] Drag and drop: shared drag pieces accept touch (pointer events) or offer a non-drag way to do the same thing.

## Problems and how they are solved

- **Long press clashing with text selection and scrolling.** Long press is taken only on menu targets, cancelled by movement past a small threshold (setting). **Solved.**
- **Bigger targets changing the desktop look.** Sizing lives under `touch:` only. **Solved.**

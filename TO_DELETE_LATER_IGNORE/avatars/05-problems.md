# 05 · Problems and solutions

| Problem | Solution |
|---|---|
| Saved agents point at `{ kind: 'coded', type }` and `{ kind: 'file' }` | Built-in avatars use the old type ids; `file` draws through Picture. Both are resolved when read, and nothing stored is rewritten (01) |
| Kind/state if-chains: `CodedAvatar`, `skullKey`, `MOTION`, `TINT`, `StateFx`, `CODED_AVATARS`, `MAKERS`, `BACKGROUNDS` | Self-registering renderers and backgrounds. Renderers read mood dials, not mood names. Mood names live only in `shared/moods.ts` as data (02, 03) |
| Each avatar has its own data shape, so no editor can serve them | One `SettingSpec` schema, also used by backgrounds (03) |
| Changing backgrounds onto the shared base could break them | Phase 1 only moves code: same frame cap, same reduced-motion behaviour, same reactions. Verify each background looks identical before phase 2 |
| Many live avatars cost CPU and GPU | One shared loop, off-screen pausing, `dot` size drawn still, 30 fps cap (03) |
| Mood changes snap | Dials ease and `strength` fades; art crossfades at the halfway point (02) |
| New moods would need art for every avatar | Nearest-mood fallback by dials (01) |
| Tiny sizes turn to mush | Sizes declared per renderer, and the studio shows every size while editing (03, 04) |
| Agents could produce broken avatars | Tool schemas list each renderer's settings with fixed choices and ranges; the store cleans values against the schema (04, 01) |
| Shared avatars need their pictures | `pack`/`uses` carry files the same way other carriable kinds do (01) |
| Thinking/talking are moods today but really describe what the agent is doing | They become `activity`, with `tool` and `listening` added (02) |
| Add-ons can't add avatars today | The renderer registry is reachable from add-on modules, and add-on avatars are ordinary entries |

## Not solved by this plan

- **Lip sync / voice level.** Left out on purpose for now. The `voice` signal is reserved so adding it later changes no renderer contract. When it's picked up: Piper plays through an `Audio` element and can be analysed; system voices (Web Speech) never expose their audio, so they can only get a pulse per word boundary.
- **3D models.** The renderer contract holds a three.js renderer with an animation controller, but the controller, model loading and clip mapping are a separate later plan.
- **Per-agent rendering cost on very weak hardware.** Reduced motion and `dot` stills limit it, but heavy renderers (Swarm with many particles) can still be slow with several on screen. The renderer's own settings (particle count) are the control; there is no automatic quality scaling in this plan.

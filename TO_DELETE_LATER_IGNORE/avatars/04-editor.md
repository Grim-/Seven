# 04 · Studio, placement and agent tools

## Avatar studio (the `avatar` kind's screen)

**Why a studio and not more fields in the look editor:** you judge an avatar by watching it react, and the current editor gives you a 96 px preview and a mood select. Making something "magical" needs a big live view and ways to provoke it.

Layout:
- **Stage preview**, large, on the theme background, with a strip of the same avatar at `portrait`, `badge` and `dot` beneath it. **Why:** something that looks great big can be mush at 28 px; seeing all sizes at once catches that while you edit.
- **Mood pad**: a 2D pad (energy across, warmth up). Drag anywhere to preview any blend, and the named moods appear as marks on it. Clicking a mark previews that mood with its real fade in and out. Right-click a mark gives Edit this mood's art when the renderer has `moodSettings`.
- **Doing**: one segmented row for every activity (Idle, Listening, Thinking, Using a tool, Talking; Talking previews with a steady writing speed), plus **At rest**. **Why:** this lets you see every signal-driven behaviour without starting a chat. A React button comes when a renderer answers reactions.
- **Settings**, generated from the renderer's `SettingSpec` with the shared controls (`03-renderers.md`). With a mood selected on the pad, the panel edits that mood's overrides, and overridden fields show a reset.
- **Frame editor** for `frames` settings: a list of frames in a monospace field with a live loop of just those frames and a speed slider, built as a reusable component.
- **Renderer picker**: a row of live thumbnails of each renderer's first built-in. Switching keeps the shared settings (colours) and drops the rest, with an undo toast.
- Built-ins show **Save a copy** in place of Save.

Gaze in the studio follows the real pointer, so Eyes and Picture react while you edit.

Components to build reusable: `MoodPad`, `SizeStrip`, `FrameEditor`, `SettingControls` (from `SettingSpec`, also used by the theme editor for background settings), `LiveAvatar` (renders an avatar entry without an agent, for thumbs and pickers). They get added to `docs/ui-components.md`.

## Look editor

The Picture and Animated avatar fields become one **Avatar** field: live tiles of every avatar, a picture/GIF/video picker (kept as a plain picture look, drawn by the Picture renderer), "Open in studio" for an avatar, and "Make it an editable avatar" for a picture (makes a Picture avatar entry from it and switches to it). A picture is not turned into an entry unless asked, so avatars don't fill up with one-off pictures. The preview pane keeps working as now and gains the mood pad in place of the mood select.

**Why one field:** with Picture as a renderer, "picture or animated" is no longer a real choice; everything is an avatar.

## Where avatars appear

The existing places (beside replies, chat header, overlay button, lists) stay. Phase 4 adds the **stage** size:
- **Overlay presence**: the overlay button can show the active agent's avatar at stage size when expanded.
- **Idle screen**: when Seven has been idle and in focus for a while, the active agent's avatar at stage size over the theme background.

Both are settings, off by default, so nothing changes until you turn them on.

## Agent tools

The tools are terse, with fixed sets of choices and names that say exactly what they do:

- `create_avatar(name, renderer, description?, settings?)`: `renderer` is one of the registered ids; the `settings` schema lists every renderer's settings with their ranges and choices (each setting type gives its own schema). Values a renderer doesn't take are dropped and named in the result.
- `change_avatar(avatar, name?, description?, settings?, pose?, pose_settings?, clear_pose?)`: built-ins refuse with the save-a-copy message.
- `set_agent_avatar(agent, avatar)`.
- Reading uses the normal library read through the kind's `line`/`card`/`full`.

The mood tool in `modules/look` keeps its shape, and its mood choices come from `shared/moods.ts`.

**Why let agents make avatars:** "make yourself look like a jellyfish made of light" is exactly the kind of request a home assistant should be able to fulfil, and it's safe because only data is produced.

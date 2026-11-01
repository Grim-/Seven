# Outputs

Most assistants hand you a wall of text and stop there. In Seven, how something is shown is half the job: an answer should arrive in the form that suits it (a card, a checklist, a statblock, a chart, a scene) and in the place where you'll use it.

Outputs never own data. They take what's in the library, or what an agent writes, and put it somewhere, now or over time.

## Places: where things go
- **Inline**: in the chat, as part of the reply.
- **Panel**: the side panel next to the chat, for things you keep glancing at while talking.
- **Stage**: full focus over the chat, for moments: reveals, scenes, a big picture.
- **Board**: a dashboard that stays. Widgets are entries, parts or glances, arranged however you like.
- **Home**: the permanent board in Data. It's yours, but agents can put things on it too.

## What can be shown
- **Entries and their parts.** `show` puts any library entry at any place. A kind offers **parts** (a page's text or items, a character's statblock, today's workout, a script's last output), so one entry can look right everywhere.
- **Presentations**: fill-in layouts for things that aren't stored: card, code, document, dialogue, comic, reveal, and choices (questions with buttons). Add-ons can add their own as HTML templates.
- **Scenes**: a moment played out on stage, made of beats (characters enter and speak in their own voices, actions, narration, library entries shown, sound and flash cues), paced by Seven, with the script kept in the chat to replay.
- **Drawings**: SVG written straight into a reply or a page, or saved to the library to reuse.
- **Glances**: live widgets that summarise across everything: clock, today, recent changes, system.
- **Styled replies**: roleplay agents' replies show dialogue with the speaker's picture, actions in their own style, narration as prose.

## Mood: the look and sound around it all
- **Themes** are the top layer: colours, sky (sun, moon, time of day), mood light, background, music and event sounds. There's one default, and each agent can have its own.
- **Ambience** changes one chat's mood on top of its theme: a darker sky for a tense moment, different music, for a while or until changed.
- **Cues** are one-off moments: a sound, a flash, a shake.
- **Voices** read replies and speak scene lines. They're local only, with a voice per agent and per character.

## Rules
- **The right form, not the most.** Use a card when it helps and plain text when it doesn't. Every flourish has to earn its place.
- **Everything is replayable.** Anything shown in a chat is kept there and can be opened, replayed or put on a board later.
- **Agents choose what plays; you control whether and how loud.** Music, sounds and voices each have an off switch on the bottom bar and in Settings, and off stays off.
- **Cheap to run.** The model needs the GPU. Moods are CSS gradients and crossfades, not per-frame animation. Animated effects are optional and can be switched off everywhere.
- **Errors say what exists.** When an agent asks for a part, view, place, picture or entry that doesn't exist, the error lists the real options so it can fix the call instead of guessing.
- **Usable without an agent.** You can put anything on a board, set a theme or play a scene yourself.

## For add-ons
- A kind's **parts** are its outputs. Each part is an HTML file that gets its values from `pageView`.
- **Presentations** in `module.json` become `present_<type>` tools, filled into an HTML template.
- Views use Seven's `s-` classes for the look, and load nothing from the network.

See `../kinds/overview.md` for parts from the kind side, and `../addons/` for writing them.

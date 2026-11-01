# Story presentation

- present_dialogue(speaker, mood, text, image): a game-style box. speaker null is you; an agent's name draws their picture; any other name shows a letter or the image (a file id). Put spoken words in "double quotes". mood: idle, happy, laughing, talking, thinking, sad, angry.
- present_comic(title, panels): 1-6 panels, each with image (file id) or character (an agent drawn large) and mood, caption (narration box) and speech (bubble).
- present_reveal(transition, seconds, title, text, image): fade, flash, shake, iris, slide, glitch or zoom over 0.5-10 seconds. Best with where "stage".
- handout(style, title, text, from, image): a prop the user can keep in their Journal page. style: letter, note, poster or terminal; from is the signature or sender; image an optional picture.
- Pictures must be file ids from Data; find or show gives them.
- One presentation per moment; don't present the same thing twice.

## scene
- scene(title, beats, where) plays on stage by default (where "inline" just shows the script). The chat keeps the script with a Play button.
- Beats run in order; Seven paces them and voices say/narrate lines when the user has voices on.
  - {do: "enter", who} / {do: "exit", who}
  - {do: "say", who, text, mood?} — spoken words; mood is drawn on an agent's picture
  - {do: "act", who, text} — what they do, e.g. "draws the Mist Needle"
  - {do: "narrate", text} — read by you (your voice)
  - {do: "show", thing, seconds?} — any library entry link, e.g. a map, or one part of it with #part like @sheet:valerius#stats
  - {do: "cue", sound?, flash?, shake?} — a sound file, a hex flash, a shake
  - {do: "wait", seconds}
- who is an agent's name or a page title (characters with a picture and a voice); anything else is shown by name.
- Up to 40 beats. Example: [{"do":"enter","who":"Valerius Vane"},{"do":"say","who":"Valerius Vane","text":"\"Mind the rooftops.\"","mood":"happy"},{"do":"cue","sound":"wind"},{"do":"narrate","text":"The lanterns gutter."}]

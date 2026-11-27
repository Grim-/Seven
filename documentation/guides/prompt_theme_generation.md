prompt_theme_generation
Build a theme for Seven, a desktop AI chat app. A theme is one JSON export plus the picture and sound files it names; the user drops the JSON into Seven to import it. This theme is a stress test: it must use every part of the format below to turn the app into a completely different object.

## The look

A big white mage's book. The whole app is the open book.

- Main surfaces (panels, pages, dialogs, the side panel) read as book pages: warm white paper with a fine grain, a soft page shadow, printed-book typography.
- The chat input is the book's spine: bound and rounded, with raised bands and gold tooling, the text box set into it.
- The chat window is the thick end of the book: a visible stack of page edges along its side and bottom, gilded at the edge.
- A red silk ribbon bookmark hangs from the top of the chat window, over the page edge.
- White and ivory dominate, with gold embellishments (corner pieces, rules, clasps, tooled lines) and small touches of bright red (ribbon, rubrics, the accent, the danger button, active marks).
- Sleek and readable, never cluttered. Every control must still work.

## Delivery

One folder:

- white-mage.json (the export below);
- every file it names, at the paths it gives;
- the scripts that generated the pictures and sounds;

## Export envelope

Top level of the .json:

- seven: "export"
- version: 3
- protection: "none"
- savedAt: a number (ms since epoch)
- about: { kind: "theme", label: "Theme", title, also: \[\] }
- entries: exactly one item { kind: "theme", id, title, value }, where value is the theme
- files: one item per file { id, name, path }

## Files

- A file id is a\_ followed by lowercase letters and digits only, chosen by you. Use the same id everywhere that file is needed.
- path is relative to the .json's folder; subfolders are allowed. Never absolute, never "..", never a network path. Every file named must exist, or the import is refused.
- Pictures: PNG, at most 8192 px on each side, sensibly sized. SVG is rejected. Generate every picture yourself (e.g. Python with Pillow/NumPy). Textures must tile seamlessly. Frames and edges are nine-slice: corners stay fixed while edges stretch or tile, and slice is the corner size in the picture's pixels. Decorations need transparency.
- Sounds: short WAV files you generate yourself.
- Fonts: font stacks of system fonts only, with file set to null.
- Never use artwork, logos or characters from any product or brand.

## Theme value

Values out of range are clamped and unknown keys dropped, so stay inside these.

- name (≤60 chars), description (≤300).
- scheme: "dark" | "light".
- colours: "#rrggbb" or "#rrggbbaa" per role.
  - The main colours are accent, accent-soft, secondary, bg, ink and surface. When unset, secondary-ink follows secondary, and line and line-strong follow accent-soft.
  - grounds: bg, sidebar, panel, surface, card, card-hover, well
  - overlays: scrim (behind dialogs), shade (shadows)
  - text: ink, dim, faint
  - lines: line, line-strong, line-hover
  - accents: accent, accent-soft, accent-dark, on-accent (text on accent)
  - second accent: secondary, secondary-ink
  - states: alert, warn, ok
- tints: hex per cyan, teal, purple, purple-ink, red, red-ink, amber, amber-ink, green, green-ink, sky, sky-ink, yellow, yellow-ink, orange.
- fonts: per role ui, label, heading, body, data: { family, file }. family is a font stack of letters, digits, spaces, commas, quotes and hyphens.
- type: per eyebrow, label, title, heading:
  - font: "inherit" or a font role
  - size: 7–48
  - weight: 100–900
  - case: none | uppercase | lowercase | capitalize
  - tracking: −0.1–0.5 (em)
  - variant: normal | small-caps | all-small-caps
- numerals: normal | tabular-nums | oldstyle-nums | lining-nums.
- shape:
  - notch 0–32, notchSm 0–24 (cut corners)
  - radiusPanel 0–32, radiusControl 0–24
  - blur 0–32 (panel glass), glow 0–2, solidity 0–1
  - shadow: { y 0–60, blur 0–120, inset 0–60, strength 0–1 }, all four keys
- lettering: capsSpacing 0–2, sizeAdjust 0.3–0.8.
- images, all file ids:
  - ground: behind everything
  - surface: on panels and cards
  - divider: rules in documents
  - frame: { image, slice 0–400, width 0–96 }, panel edges
- ornament: headingMark (≤4 characters, no quotes or backslash), scanlines 0–1, vignette 0–1.
- options:
  - frame: notched | double-rule | plain
  - active: glow-bar | underline
  - hover: wash | lift
  - heading: mark | rule
- skies: all four of dawn, day, dusk and night, or none. Each is { orb: "#rrggbb" }, the sun or moon colour.
- sky: off | clock | dawn | day | dusk | night. When the sun or moon and stars show; clock follows the time of day.
- backdrop: { colors: \[\], image: file id, slideshow: null, dim: 0–0.9 }, a picture behind everything (dim darkens it), or null.
- gradient: { stops: \[{ color: "#rrggbb" or "#rrggbbaa", at: 0–100 }, … up to 8\], angle: 0–359 }, drawn over the backdrop picture and the sky, or null.
- light (mood light): { stops: \[same as gradient\], strength: 0–1 }, a radial glow from the bottom middle over everything else; at 0 is its centre. Or null.
- effect: "none"; effectSettings: {}.
- chatFadeOpacity: 0–1.
- music: sound file ids, looped in order; volume: 0–1.
- sounds: { reply, reminder, ask }, each a sound file id or null.
- motion: { decode: boolean, glitch: boolean }; the text scramble and the glitch.
- surfaces: per-surface styles (below).

Layers, bottom to top: backdrop picture, sky, gradient, mood light, then the app.

## Surfaces and what they contain

Style inner parts with nested selectors, preferring element and state selectors (& textarea, & header, & svg, &:hover). The app's own class names are internal and change.

- app: the root of the window, with everything inside it. Use it for anything with no surface of its own.
- chat-log: the whole chat column, the scrolling messages then the chat input at the bottom.
- message-user: one user message: name label, the text, any attached files.
- message-agent: one agent message: avatar, name label, the reply as rendered Markdown (& p, & a, & code, & pre, & blockquote, & ul, & table), thinking blocks and tool cards.
- chat-input: a form holding, in order:
  - the player character dock;
  - a row of icon tool buttons;
  - the textarea;
  - the send/stop button.

  Pop-up panels (command hints, draw, play) open above it, absolutely positioned inside it.
- panel: every panel, a section with an optional header (title left, actions right), then the body.
- sidebar: the side panel's section, a header with the tab menu, then the active tab's content.
- top-bar: the title bar header with navigation, status and window controls.
- page: an open page's body, with its tools then the text editor or the collection.
- dialog: the dialog box, a title row (title, close ×), the body, then a footer of buttons. The dimmed backdrop is its parent, not part of it.
- toast: each pop-up notice: title, message, optional action button.
- approval: an approval or question card in chat, with its answer buttons.
- lock-screen: the full overlay under the title bar, with the unlock card in the middle.
- Buttons: every button drawn by the app's button component, holding an optional icon svg and then the label. States: &:hover, &:active, &:focus-visible, &:disabled.
  - button-primary: the main action (Send, Save, Import)
  - button-secondary: the ordinary button, and the default
  - button-danger: destructive or stopping actions
  - button-ghost: quiet buttons in toolbars and headers
  - button-badge: small tag-like buttons
- Other clickable things (icon tools, close ×, window controls, list rows, tabs) are not button surfaces. Style them through the surface they sit in.

## Surface style format

- A surface's style is a JSON object, never a CSS string.
- A key that is a CSS property maps to its value as a string.
- A key that is a selector or at-rule maps to a nested object: &::before, &::after, &:hover, & &lt;descendant>, @media …, @keyframes &lt;name> (whose keys are 0%, 50%, to and so on).
- & is the surface element. Any CSS property is allowed, and the theme's rules win over the app's own without !important.
- Pictures: url(a_id) with a file id. Remote URLs never load.
- ::before / ::after need "content": "\\"\\"", plus position: relative on the surface when it would otherwise be static. Give decorations pointer-events: none.
- Use the theme's variables instead of repeating hex values:
  - colours: var(--color-&lt;role>), var(--color-tint-&lt;name>)
  - fonts: var(--font-ui|label|heading|body|data)
  - text styles: var(--&lt;eyebrow|label|title|heading>-size|weight|case|tracking|variant|font)
  - shape: var(--radius-panel), var(--radius-control), var(--notch), var(--panel-blur), var(--glow), var(--shadow-panel)
  - pictures: var(--ground-texture), var(--surface-texture), var(--frame-image), var(--divider-image)
- Each surface stays under 200,000 characters of JSON.

## Use every part

Set every field above, each doing something deliberate:

- every colour role and tint;
- all four type styles;
- every look option slot;
- all four image slots;
- all four sky phases;
- backdrop, gradient (with see-through stops) and mood light (fading to transparent);
- music and all three sounds;
- every surface id, using between them:
  - url() pictures and ::before/::after decorations;
  - border-image edge tiling, padding and margins;
  - hover, active, focus-visible and disabled styles on every button variant;
  - at least one @keyframes and one @media rule for narrow widths.

## Quality bar

- Text stays readable on every surface it sits on, including the spine and text on the accent. Every button is readable in every state, and danger still reads as destructive.
- Nothing hidden, clipped or unclickable: the textarea, send/stop, dialog footers, approval buttons, toasts and the lock screen must work, also at phone and tablet widths, which use the same surfaces.
- Decorations never cover controls.
- Before finishing, check every value in the JSON against the ranges and lists above, and that every file id named exists in files with a matching path.

# What it links to
It links to nothing.

# Making Themes

A theme is Seven's whole look and mood: colours, fonts, text styles, corners and shadows, textures, a panel frame, ornaments, skies, your own CSS for each part of the app, and the sky, mood light, background, music and sounds.

There are two ways to make one:
- **In Seven:** make a new theme under Themes in Data. Every setting below has a page in the editor, the whole app previews it while you work, and it saves as you go. Export it from Data as a card, a `.sevenpack` or a `.json`.
- **By hand:** a folder with a `.json` and your pictures, which anyone can drop into Seven. The rest of this guide is the reference for that.

## A theme folder

```
mage-book/
  mage-book.json
  images/cover.png
  images/clasp.png
  images/vellum.png
```

`mage-book.json`:

```json
{
  "seven": "export",
  "version": 3,
  "protection": "none",
  "savedAt": 0,
  "about": { "kind": "theme", "label": "Theme", "title": "Mage Book", "also": [] },
  "entries": [
    {
      "kind": "theme",
      "id": "mage-book",
      "title": "Mage Book",
      "value": {
        "name": "Mage Book",
        "description": "Leather, vellum and brass.",
        "scheme": "light",
        "colours": { "bg": "#2b1d14", "panel": "#efe1bf", "ink": "#2a1d12", "accent": "#a8321e" },
        "sky": "clock",
        "images": { "surface": "a_vellum" },
        "surfaces": {
          "chat-input": {
            "border-image": "url(a_cover) 40 / 28px round",
            "padding": "18px 24px",
            "&::before": {
              "content": "\"\"",
              "position": "absolute",
              "left": "-14px",
              "top": "50%",
              "translate": "0 -50%",
              "width": "28px",
              "height": "56px",
              "background": "url(a_clasp) center / contain no-repeat"
            }
          }
        }
      }
    }
  ],
  "files": [
    { "id": "a_cover", "name": "cover.png", "path": "images/cover.png" },
    { "id": "a_clasp", "name": "clasp.png", "path": "images/clasp.png" },
    { "id": "a_vellum", "name": "vellum.png", "path": "images/vellum.png" }
  ]
}
```

- **File ids** are yours to choose: `a_` followed by lowercase letters and digits (`a_cover`, `a_clasp2`). Use the same id wherever the theme needs that picture or sound: in `images`, `fonts`, `backdrop`, `music`, `sounds` and `url()` in CSS. On import, Seven stores each file and swaps your ids for its own.
- **Where files come from:** each `files[]` entry is either:
  - **beside the JSON:** `path`, relative to the JSON's folder (subfolders are fine). `size` isn't needed;
  - **inside the JSON:** `data`, the file as base64.
- **Refused paths:** paths that leave the folder, absolute paths and network paths. If a file can't be found, the import dialog lists it and won't import until it's there.
- **Only `name` is required in `value`.** Anything you leave out uses the Seven theme's value.
- **Where it lands:** importing puts everything in its own folder, `Imports/<title>/` by default.

## Every setting

| Field | What it sets | Values |
|---|---|---|
| `name`, `description` | The theme's name (up to 60 characters) and a line about it (up to 300) | text |
| `scheme` | Whether built-in controls (scrollbars, date pickers) draw light or dark | `dark`, `light` |
| `colours` | The colour roles (see below) | `#rrggbb` or `#rrggbbaa` |
| `tints` | Colours for tags, categories and game pieces: `cyan`, `teal`, `purple`, `red`, `amber`, `green`, `sky`, `yellow`, `orange`, and text shades `purple-ink`, `red-ink`, `amber-ink`, `green-ink`, `sky-ink`, `yellow-ink` | `#rrggbb` or `#rrggbbaa` |
| `fonts` | Font per role: `ui`, `label`, `heading`, `body`, `data` | `{ "family": "'Name', Georgia, serif", "file": "a_font" }`; `file` is a WOFF2/WOFF/TTF/OTF or `null` |
| `type` | Text styles: `eyebrow`, `label`, `title`, `heading` | `font` (`inherit` or a font role), `size` 7–48, `weight` 100–900, `case` (`none`, `uppercase`, `lowercase`, `capitalize`), `tracking` −0.1–0.5 em, `variant` (`normal`, `small-caps`, `all-small-caps`) |
| `numerals` | How numbers are drawn | `normal`, `tabular-nums`, `oldstyle-nums`, `lining-nums` |
| `shape` | Corners and depth | `notch` 0–32, `notchSm` 0–24 (cut corners), `radiusPanel` 0–32, `radiusControl` 0–24, `blur` 0–32 (panel glass), `glow` 0–2, `solidity` 0–1, `shadow` `{ y 0–60, blur 0–120, inset 0–60, strength 0–1 }` |
| `lettering` | `capsSpacing` 0–2 (spacing in capitals), `sizeAdjust` 0.3–0.8 (`font-size-adjust`, off when unset) | numbers |
| `images` | `ground` (behind everything), `surface` (on panels and cards), `divider` (rules in documents), `frame` `{ image, slice 0–400, width 0–96 }` (panel edges; `slice` and `width` are one number or four `[top, right, bottom, left]`) | file ids |
| `ornament` | `headingMark` (up to 4 characters before headings), `scanlines` 0–1, `vignette` 0–1 | |
| `options` | Built-in structural looks: `frame` (`notched`, `double-rule`, `plain`), `active` (`glow-bar`, `underline`), `hover` (`wash`, `lift`), `heading` (`mark`, `rule`) | ids |
| `skies` | The sun or moon colour for `dawn`, `day`, `dusk`, `night`, each `{ "orb": "#rrggbb" }`; all four or none | |
| `motion` | `decode` (text scramble), `glitch` | `true` / `false` |
| `surfaces` | Your CSS for each surface (below) | an object per surface: property names to values, nested selectors as nested objects |
| `sky` | When the sky (sun, moon and stars) shows; `skies` sets their colours | `off`, `clock` (follows the time of day), `dawn`, `day`, `dusk`, `night` |
| `light` | A soft glow from the bottom middle, over everything else; `at` 0 is the centre of the glow | `{ "stops": [{ "color": "#rrggbb" or "#rrggbbaa", "at": 0–100 }, …up to 8], "strength": 0–1 }` or `null` |
| `backdrop` | A background picture or video, behind everything | `{ "colors": [], "image": file id or null, "slideshow": null, "dim": 0–0.9 (darkens the picture) }` or `null` |
| `gradient` | A gradient over the picture and the sky, under the mood light | `{ "stops": [{ "color": "#rrggbb" or "#rrggbbaa", "at": 0–100 }, …up to 8], "angle": 0–359 }` or `null` |
| `effect`, `effectSettings` | The animated background and its settings | an effect id, or `none`; settings by name |
| `chatFadeOpacity` | How visible the unpinned chat is in Tabletop mode | 0–1 |
| `music`, `volume` | Tracks that loop in order, and their volume | file ids; 0–1 |
| `sounds` | Sounds for `reply`, `reminder`, `ask` | file id or `null` each |

Colour roles (the main colours are `accent`, `accent-soft`, `secondary`, `bg`, `ink` and `surface`; when unset, `secondary-ink` follows `secondary`, and `line` and `line-strong` follow `accent-soft`):
- **Grounds:** `bg`, `sidebar`, `panel`, `surface`, `card`, `card-hover`, `well`
- **Overlays:** `scrim` (behind dialogs), `shade` (shadows)
- **Text:** `ink`, `dim`, `faint`
- **Lines:** `line`, `line-strong`, `line-hover`
- **Accents:** `accent`, `accent-soft`, `accent-dark`, `on-accent` (text on accent)
- **Second accent:** `secondary`, `secondary-ink`
- **States:** `alert`, `warn`, `ok`

## Surfaces

| Surface | What it is |
|---|---|
| `app` | The whole window. Reach anything that has no surface of its own with nested selectors. |
| `chat-input` | The message box at the bottom of a chat |
| `chat-log` | The chat column, messages and box together |
| `chat-messages` | The scrolling list of messages, without the message box |
| `chat-popover` | Each pop-up above the message box: command hints, the open command, draw, play and questions |
| `message-user` | Each of your messages |
| `message-agent` | Each agent message |
| `panel` | Every panel |
| `sidebar` | The side panel |
| `top-bar` | The title bar |
| `page` | An open page |
| `dialog` | Every dialog window |
| `dialog-backdrop` | The dimmed layer behind a dialog |
| `toast` | Pop-up notices |
| `approval` | Approval and question cards in chat |
| `lock-screen` | The vault lock screen |
| `button-primary`, `button-secondary`, `button-danger`, `button-ghost`, `button-badge` | Buttons, by kind |

How a surface's CSS works:
- Each surface is an object. A key that's a CSS property (`"padding"`, `"border-image"`) sets that property on the surface; a camelCase name (`"borderImage"`) is saved as its CSS name. A key that's a selector or rule (`"&::before"`, `"& textarea"`, `"&:hover"`, `"@media (max-width: 600px)"`, `"@keyframes glint"`) holds an object of its own.
- `&` is the surface. In the editor the same thing is shown and typed as ordinary CSS.
- Your CSS comes after Seven's own, so it wins without `!important`.
- Anything goes: pseudo-elements, positioning, transforms, filters, animations, `@keyframes` and media queries.
- `url(a_…)` uses one of the theme's files. Seven doesn't load anything from the internet.
- For a `::before` or `::after`, the surface needs a `position` other than `static`. The editor's Decorations control sets `position: relative` when it's needed.

The theme's own values are CSS variables, so surface CSS can stay in step with the colours:
- **Colours:** `--color-<role>`, e.g. `--color-accent`, `--color-ink`, `--color-panel`
- **Tints:** `--color-tint-<name>`
- **Fonts:** `--font-ui`, `--font-label`, `--font-heading`, `--font-body`, `--font-data`
- **Text styles:** `--<style>-size`, `--<style>-weight`, `--<style>-case`, `--<style>-tracking`, `--<style>-variant`, `--<style>-font`, for `eyebrow`, `label`, `title`, `heading`
- **Shape:** `--notch`, `--notch-sm`, `--radius-panel`, `--radius-control`, `--panel-blur`, `--glow`, `--shadow-panel`
- **Pictures:** `--ground-texture`, `--surface-texture`, `--frame-image`, `--frame-slice`, `--frame-width`, `--divider-image`

```json
"button-primary": {
  "background": "linear-gradient(var(--color-accent), var(--color-accent-dark))",
  "border-image": "url(a_brass) 12 / 6px stretch",
  "font-family": "var(--font-heading)",
  "animation": "glint 4s ease-in-out infinite",
  "&:hover": { "filter": "brightness(1.1)" },
  "@keyframes glint": { "50%": { "box-shadow": "0 0 12px var(--color-accent-soft)" } }
}
```

## Limits
- Pictures must be PNG, JPEG, WebP or GIF, at most 8192 px wide or tall (Largest theme picture, in the Export & import settings). Anything else is left out when the theme is saved or imported, and Problems names the file.
- An import can unpack up to 250 MB (Maximum unpacked size, in the Export & import settings).
- Each surface's style can be up to 200,000 characters of JSON.

## If a theme hides the UI
Press **Ctrl+Alt+0** for the Seven theme, and again to bring yours back. It can be changed with the other keybinds.

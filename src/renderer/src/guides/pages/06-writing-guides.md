---
title: Editing & Adding Built-In Guides
section: Authoring
order: 90
summary: How to edit these user guides, add new tutorial pages, embed screenshots or animated GIFs, and wire jump links.
tags: [authoring, markdown, gifs, images, documentation, wiki]
---

These user guides are **built directly into Seven's source code** as plain Markdown files. That keeps them **read-only inside the app** and completely separate from user Files and Agent documentation — while making them effortless to edit in any text editor.

## 1. Where Guide Files Live

| Folder | What goes here |
| --- | --- |
| `src/renderer/src/guides/pages/*.md` | Every `.md` file is automatically discovered and added to the sidebar |
| `src/renderer/src/guides/media/*` | Screenshots & animated GIFs (`.png`, `.jpg`, `.webp`, `.gif`, `.svg`) bundled into the app |

You do **not** need to register new pages in TypeScript — simply drop a `.md` file into `pages/` and it appears automatically, sorted by its `order` number.

## 2. Page Frontmatter Template

Put a short YAML header at the top of each `.md` file:

```markdown
---
title: Your Guide Title
section: Image Generation
order: 45
summary: One-line description shown under the title and in search results.
tags: [image, workflow, tips]
---

## First Section

Write normal GitHub-flavored Markdown here — headings automatically populate
the right-hand **On This Page** table of contents.
```

## 3. Adding Images & Animated GIFs

Drop any `.png`, `.jpg`, `.webp`, `.gif`, or `.svg` into `src/renderer/src/guides/media/` and embed it with standard Markdown syntax:

```markdown
![Dragging a trigger box on the World Atlas](../media/atlas-triggers.gif)
```

- Relative paths (`../media/demo.gif` or `media/demo.gif`) are automatically resolved to bundled app assets in both dev and packaged builds.
- Animated `.gif` files play automatically and show a subtle **GIF** indicator.
- Clicking any image or GIF opens a full-screen lightbox view.

## 4. Copyable Prompts & Section Copying

If a guide includes a prompt meant to be pasted into an external web model (like a theme generator or coding prompt), wrap it in a `prompt` fenced block — Seven renders it as a dedicated **Copyable Prompt Card** with a prominent one-click **Copy prompt** button (and automatic collapse/expand for long prompts):

````markdown
```prompt:Theme_Generator_Prompt
You are designing a complete Seven theme...
```
````

- Use `prompt` for a default `"Prompt To Paste"` header, `prompt:Custom_Title` for a custom label, or `copy` for any non-prompt snippet.
- Readers can also hover any `##` or `###` heading to click **Copy section**, or click **Copy page** at the top of any guide.

## 5. Linking to Other Guides & App Screens

- **Link to another guide:** Use `guide:<filename-without-.md>`, e.g. `[Image Generation](guide:04-image-generation)`.
- **Jump straight to a Seven screen:** Use `seven-view:<viewId>`, e.g. `[Open Models](seven-view:models)`, `[Open Image Generator](seven-view:image)`, `[Open Agents](seven-view:agents)`, or `[Open Settings](seven-view:settings)`.
- **Mermaid diagrams & syntax-highlighted code blocks:** Standard fenced `mermaid` and language code blocks render natively.

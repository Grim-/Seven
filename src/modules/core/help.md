# Library, pages and show

## Pages and folders
- A page has markdown text and optional items: rows with fields, shown as a table, list, checklist and so on.
- A page's id is its path: folders, then the page, e.g. recipes/pancakes. read_kind(folder, recipes) lists what recipes holds; read_kind(folder, /) lists the top level.
- Ids are lowercase with underscores; Seven tidies any id you give, so recipes/Pancake Day is recipes/pancake_day.
- Link any entry with @kind:id, e.g. @page:recipes/pancakes, in replies, pages and tool arguments.

## Showing
- show takes links or file paths and shows each the way Seven draws its kind; several files make one gallery. End a link with #part for one part of it, e.g. @sheet:valerius#stats; the library list says which kinds have parts.

## Drawings
- A ```svg block in a reply or a page's text is drawn in place. One <svg>…</svg> element; scripts, event handlers and outside links are removed. Simple shapes, gradients and SMIL/CSS animation work.
- A ```mermaid block in a reply or a page's text is drawn as a diagram. Start it with the diagram type: flowchart TD, sequenceDiagram, timeline, gantt, pie or mindmap.
- ![label](seven:file/<file id or name>) shows any library picture, sound or video inside a page.

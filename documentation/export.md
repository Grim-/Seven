# Export

## Goal
Get your stuff out of Seven as normal files you can use anywhere: an Obsidian vault, a GitHub repo, or just a folder on your PC.

## What
- **Pick what:** selected entries, a whole kind, or everything with a tag.
- **One file per entry:** pages as markdown, with their items as a table; every other kind as its own markdown export (sheets, repos, chats, days…).
- **Files come along:** pictures and files a page uses or links go in an `attachments` folder next to it.
- **Two targets:**
  - **Obsidian:** links become `[[Name]]`, pictures `![[picture.png]]`, tags and dates go in the frontmatter.
  - **Plain markdown:** links become relative links between the exported files, pictures `![](attachments/…)`.
- A link to something that wasn't exported becomes its plain name.

## Rules
- **Only the exported copies change.** Inside Seven, links stay `@kind:Name`.
- **Never overwrites.** Each export goes into a new folder (`Seven export <date>`) inside the folder you pick.
- **Exported files aren't encrypted.** Seven says so before writing them.
- Getting them to GitHub or anywhere else is up to you; Seven just writes the folder.

## Not doing
- Importing back in (later, maybe).
- Syncing: an export is a snapshot.

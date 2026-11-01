# Seven: purpose and principles

## What Seven is for
Seven is a home assistant harness for a local LLM that knows the user's personal things, presents them visually and well, and is genuinely useful day to day. It grew out of running an assistant through LM Studio and MCPs, plus a pile of standalone web pages built for single jobs (like the workout tracker). Seven brings all of that into one place.

The long view: in a couple of years the user should be able to ask Seven whether their training is getting better or worse, who recommended a book, where their D&D character is in the story, to recite a poem in a cool presentation, or whether a file is still in its workspace, and have the answer come from data that has been building up in Seven the whole time.

## The model: everything is an entry
Everything Seven keeps is an entry of a kind: pages, files, skills, repos, character sheets, agents, memories, commands, and whatever an add-on brings. Every entry, of every kind, works the same way: it has a name you can find, one link that points at it (`@kind:Name`), and the same few things you can do with it: find it, read it, link it, tag it, show it, rename it, delete it.

Kinds describe themselves. What makes a kind special (a repo can roll, a sheet can be worn by an agent, a card game enforces its rules) is declared by the kind, not special-cased by Seven. A new kind slots in without new rules, so learning one kind means you've learned them all.

The Library (pages and every kind) and Mind (memory and reasoning) are the core. You can switch them off, but without them Seven is just somewhere to run a model.

## Principles
- **Usable without an agent.** Everything a tool does for an agent, the user can also do directly in Seven's UI, quickly. Logging reps, adding a plan, ticking a list, editing a page: none of it should need a chat turn. The agent is an extra way in, not the only one.
- **Native, not embedded.** Tools that are part of daily life get proper Seven screens built from Seven's own components (like Skills, Worlds and Workout), not a web page in a box.
- **One place for the data.** Pages, files, tool data and agent memory live in Seven so they can be found, linked and asked about later.
- **Private by default, shared on purpose.** With the vault set up, everything Seven keeps is encrypted; nothing personal sits in plain files. Each agent's memory is its own and private; anything every agent should know goes on a page (the wiki), which is also encrypted but readable by all agents. Vault agents are hidden entirely while the vault is locked.
- **Plans and content often come from other LLMs.** Make it easy to paste or load what a web LLM wrote (Workout: "Copy the plan format for an LLM", paste or load a file), and to copy things back out for revising.
- **Visual and fun where it helps.** Presentations, boards, backgrounds and avatars are part of the point, not decoration to cut.
- **Built for other users too.** Seven should make sense to someone else installing it, not only its author.
- **Simple concepts, said the way you'd say them.** Seven has a few ideas (an entry, its kind, a page, a link) and they map onto how people talk. You say "find the so-and-so page", not "get me list X from table Y". Concepts stay abstract and intuitive, so you spend your time getting results, not explaining how the app works.
- **A shared space.** Seven is one space the user and the agent both live in. Anything written anywhere in Seven, by the user, an add-on or an agent, is there for the other straight away: no copying, pasting or shuffling things around inside the app to get them in front of the agent.
- **One model for user and agent.** The user and the agent use the same entries, the same links and the same verbs. "Find the page", "load that repo", "link me to it" mean the same thing to both, and what the agent hands back is the same chip the user would click. Nothing is quietly translated behind either of them: if the agent writes it, the user could have, and the other way round.
- **One way to do a thing.** One link syntax, everywhere. Names that say what they act on. If something needs a second way to express it, the first way is wrong.
- **Never annoying.** A feature that takes an extra click, a backspace or a workaround every time is broken, however clever it is. Speed and flow come first: autocomplete, keyboard first, pick and done.
- **A workbench, not a comfy chat shell.** Seven should make you and the agent think and make better, not just talk: probing what you actually want, varying what you've got, rolling from your own repos, building characters from parts, prompts with parameters. Comfortable isn't the goal; useful is. This is what subscription chat apps keep skipping.
- **Tools carry the load, the model improvises.** Anything that can be tracked, counted, enforced or remembered by Seven (turns, rules, stats, queues, how long since it last used memory) is done by Seven, so the model only has to do what it's good at.
- **Errors say what to do next.** Every error a tool returns is written for the smallest model that might read it: it says what to do instead (the call to make, the values that work, or what to read), not only what went wrong. Internal names never show up in one. If a model can't act on an error, the error is wrong.
- **The user decides.** Seven offers defaults and makes the core obvious, but doesn't decide for the user what goes where or what's turned on. If it doesn't make sense to anyone else but works for them, that's fine.
- **Agents never grant themselves anything.** Permissions are the user's alone.
- **Never regress.** A change must not break what already works, and the user's data is never touched or migrated unasked.

# Features

A quick list of what Seven does. For the why, see `overview.md`.

## Chat and agents
- Chat with agents running on your own model, in the app or from the overlay button and bar over your desktop.
- Agents: each with its own instructions, model, tools, permissions, look, voice, theme and character sheet. Some can live in the vault, hidden while it's locked.
- Agents can make other agents. Only you give them tools and permissions.
- Edit the agent's replies and tool results, rewind to any message (undoing file changes), fork a chat from any point.
- Commands: built-in ones like `/probe` and `/askme`, plus your own.
- Probe mode: an agent interviews you about something until it has the picture, and writes it down.
- Long chats are summarised when the context fills, with your approval.

## Seeing what the agent does
- Questions come as choices with buttons, requests for data as forms, results as cards.
- Reasoning shows as a box you can open, read and change.
- Presentations: cards, code, documents, dialogue boxes, comics and reveals, inline, in the side panel or on stage.
- Voiced scenes played out on stage, and drawings straight into replies.
- A todo list per chat that you can tick yourself.
- Reactions and moods on the agent's picture.

## Memory
- Each agent has a private mind: memories (pinned ones in every chat, the rest recalled when relevant), thoughts and a journal.
- Check-ins remind the agent to use its memory every few turns.
- Reasoning styles: how an agent works through a problem, optionally as voices arguing it out.

## The library
- Everything is an entry of a kind: pages, files, sheets, repos, worlds, stories, scripts, skills, workouts, chats, agents, themes, boards, days, routines and add-on kinds.
- One way to link everywhere, `@kind:Name`, with autocomplete. Links in a message give the agent the entry itself.
- Pages: the shared wiki (see `pages.md`).
- Character sheets with editable fields, and repos of values you can roll from with `#random`.
- Tags, search, export to markdown and JSON, and "All …" pages for every kind.

## Time
- The timeline records who made, changed or talked about what, without copying anything.
- Days: `@day:today` shows what happened.
- Routines: unattended work you set up, run on a schedule or when something happens.
- Reminders and scheduled tasks.

## Look and sound
- Themes: colours, sky with sun or moon, mood light, background picture or colours, music and event sounds. One default, and one per agent if you like.
- Animated backgrounds: the data feed built in; Cyberdeck, Neon cityscape and Blackwall from the Backgrounds add-on.
- Agents can change a chat's mood for a while and play cues: a sound, a flash, a shake, a background reaction.
- Local voices reading replies and speaking scenes, and a music player for your library.

## Boards
- Dashboards of entries, parts and glances (clock, today, recent changes, system, theme, media player, weather).
- The side panel next to the chat, and Home in the Data tab.

## Tools
- Read and edit files, run commands, Python with saved scripts, web search and pages, a built-in browser, vision, dice, weather, card games, worlds, Story Nexus and workouts.
- Permission modes per agent and per chat; file changes are saved first, so a chat can be rewound.

## Your data
- Everything in one data folder, a vault, encrypted with your passphrase.
- Several vaults to switch between (work, home); restoring a backup makes a new vault and never overwrites one.
- Backups are one file.

## Models
- Runs GGUF models with llama.cpp on CUDA, Vulkan or CPU.
- Scan your model folders, set per-model settings and chat templates.

## Add-ons
- Add tools, kinds, part views, screens, presentations, backgrounds and settings, in plain JavaScript and HTML, or connect MCP servers.
- Nothing runs until you approve it, and a changed add-on pauses until you approve it again.

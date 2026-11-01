# The Composer

Built in v359. Mockup: `mockups/composer.html`.

## Why

Almost everything in Seven reduces to a prompt sent to an agent. A command is one, a card is one with a face, a decision is one. And inside Seven the agent understands anything you link to it: a page, a character, a world, a place, a map, a repo. So the smooth part is putting the prompt together. You already write scenarios as pages ("These are instructions for a scenario") and link them in, with characters, D&D stats, a world and a map. The Composer is a nicer way to gather all that into one prompt than typing links into the chat box. Nothing in it is new power; it's a better builder.

## What it is

- **A view of its own**, at the top level beside Data, Agents and Tools.
- **The paper:** one sheet you write on and drop things onto. It holds your text and blocks, in order:
  - links to anything in Seven, of every kind: pages, pictures, videos, files, characters, worlds, places, maps, objects, repos, cards, slideshows, handouts, agents, boards, anything a kind or a tool adds. Each block shows as its kind presents itself (its face, picture or chat surface), never as a bare link, so the paper is as visual as what it holds: a picture shows as the picture, a character with their portrait, a card as its card, a map as its map;
  - repo rolls, either rolled now (the result is kept) or rolled when it's sent;
  - actions and decisions, built with the existing forms;
  - cards, as their prompt (or their action or decision).
- **Adding things:** drag from Data, Files, the map, a hand or anywhere a thing shows; drop files from outside; type @ to link; or use the side panel's tabs (Library, Draw, Play, Cards). Blocks can be dragged to reorder and right-clicked for Open, Roll again, Edit, Take out.
- **What the agent gets:** a toggle that shows the paper as the exact text that will be sent.
- **Chat preview:** when the paper has a place on it, a preview of the chat as it will look there (its backdrop, who is here with their portraits, the opening message) before you send.

## Visual by default

The paper is meant to be looked at, not just read: big pictures, portraits, card faces and map previews, laid out on the sheet. Blocks are drawn by each kind's own surfaces (`KindUi.present`), so a new kind shows up properly on the paper without the Composer knowing about it. Pictures can be placed side by side or full width.

## A pad is a page

- What's sent is plain text: your paragraphs, with each block as its link or its text on its own line. A saved pad is a page with that same text, so it's one source of truth whichever agent is narrating.
- **Save as page** writes it (title and folder). **Open a page** puts any page's text on the paper: lines that are only a link come back as blocks.
- An unsaved pad is a draft. It's kept until you clear it, so leaving the view loses nothing.

## Sending

- **Start a chat:** pick an agent; the paper is the first message.
- **Send to a chat:** any open chat, as your next message.
- Repos marked "roll when sent" roll then.

## In a chat

- The composer's "Set the scene" button becomes the Composer button. It offers:
  - **Open a page** in the modal editor: the same paper, with Send into this chat;
  - **Open the Composer** view.
- "Set the scene" goes. Its recent scenes are replaced by pages.
- The Draw panel and the action/decision builder become the paper's side tabs; the chat composer's own buttons for them stay as quick ways in.

## Cards

- Clicking a card in a hand still plays it straight away: to start a chat or mid-chat as a prebuilt reply. That uses it up.
- A card dropped on the paper is part of the prompt, like any other block. It isn't used up: the paper can't tell which hand it came from or whether it was ever sent.

## Commands

- Stay as they are.

## Build plan

1. **Mockup** (`mockups/composer.html`): the view (side tabs, paper, send panel), blocks of several kinds including pictures, the agent's text toggle, the modal editor in a chat.
2. **The paper:** the shared component (text and blocks drawn by each kind's own surfaces, drag in, reorder, menus), reading and writing the plain text.
3. **The view:** side tabs (Library, Draw, Play, Cards), the draft, Save as page, Open a page, Start a chat, Send to a chat.
4. **In a chat:** the Composer button and the modal editor; "Set the scene" removed.

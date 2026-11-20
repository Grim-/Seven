# Seven

> Seven is a local desktop app for running AI agents at home — built for roleplay, writing, worldbuilding, and visual/interactive stuff, not coding.


NOTE: This is a pre-release version, while mostly working and stable and tested, there might be bugs and other problems, I welcome feedback and idea's how to improve Seven to provide a richer writing and roleplay experience.


Almost every agent tool out there is a terminal wrapper built for writing software. Seven is purposely not that. I built it primarily for myself because I wanted somewhere to actually *do* things with agents visually — have character sheets, notes, cards, random tables, maps, and images sitting right there on screen where both you and the agent can see and edit them, all saved locally on your own machine.
<img width="1920" height="1050" alt="main_demo_image_1" src="https://github.com/user-attachments/assets/133609c3-b61c-4d9a-b647-834d8674a711" />



---

## What's different about it

### Three ways to use Chat (try Tabletop)

Chat splits the agent's side at the top and yours at the bottom, and you can flip between three view modes anytime using the button on the chat bar (or <kbd>Shift+V</kbd>):

| Mode | |
| :--- | :--- |
| **Default** | Mostly what you'd expect from a chat view, just with more visual outputs. |
| **Tabletop** | This is the one to try. Chat sits over a live surface where you can drop **slates** (character sheets, pages, cards, images, boards) right next to the conversation. You can edit them yourself, and when you ask the agent to change something you'll actually watch it update. Right-click the canvas to place a slate or change the background. |
| **Cinema** | Fullscreen, out-of-the-way view when you just want to read and immerse yourself. |

### Everything is a Kind, and you can link anything

Pages, files, character sheets, cards, decks, repos (random tables for names, concepts, palettes, whatever), maps, and worlds are all just **Kinds** in your local vault. Type `@kind:name` pretty much anywhere — chat, pages, image prompts — to link or pull something straight in. You can also export and import anything (or bundles of things) as `.sevenpack` files.

### Local-first, and modular

You can run your own local chat and image models on your hardware, or just plug in a remote API key. Most features (Cards, Storyteller, Image gen, Web & Browser, Workouts, the 2D Play preview) live as modules in **Tools** — if you don't want something, switch it off and it gets out of your way without deleting any of your data.


<img width="1920" height="1050" alt="main_demo_image" src="https://github.com/user-attachments/assets/80da7e2b-18c5-4c68-9258-a687a83a86c1" />
---

## Getting Started

1. **Install and open Seven** — set a vault passphrase if you want your data encrypted, or skip it for plain local files.
2. **Grab the local runners (if running locally)** — head to **Settings → Helper installers** and install `llama-server` (runs local chat models) and/or `sd-server` (runs local image models). Skip this if you're using remote APIs.
3. **Add a model** — open **Models → Download models** to pull one straight from Hugging Face, point **Models → Folders** at a folder of models you already have, or add a remote API in **Models**.
4. **Switch Chat to Tabletop** — hit the mode button on the chat bar (or <kbd>Shift+V</kbd>), pick **Tabletop**, and **right-click the background** to place a slate or change the surface backdrop.
5. **Explore a bit** — type `@` anywhere to link things, hit <kbd>Ctrl+K</kbd> to search and jump anywhere, click your own or the agent's portrait, and right-click stuff. There are a lot of buttons — try them.
<img width="1920" height="1050" alt="main_demo_image_0" src="https://github.com/user-attachments/assets/89b9418e-8803-4e45-ac6a-823e6b3d4056" />



Note : Seven will always be free and open source, a donation link *may* be added a later date but is *neve*r required and is *never mentioned anywhere inside the application*.

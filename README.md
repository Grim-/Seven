# Seven

NOTE: This is a pre-release version, while mostly working and stable and tested, there might be bugs and other problems, I welcome feedback and idea's how to improve Seven to provide a richer writing and roleplay experience.


Note: Note: Seven makes use of agentic coding, but I would not call it vibe coded I have been a developer long before the advent of LLM's, and have applied the best practices, patterns and designs that I could reasonably apply to keep Seven modular and flexible, pains (oh great pain..) has been taken to ensure the important parts of the app have been reviewed, all of the app has been personally test by me.

However this does not mean there may not be issues and I am happy to address these but I am full time carer developing this for my own use, as such I welcome any help or additions, please use the discussions tab if you want to help in anyway or have suggestions.


Note: Note: Note: This is partially LLM wrote page but I'd hazard to say only 20% where I struggle with formatting.


NOTE: WARNING: You are advised to use the edit_file tool with care, attempts have been to limit what destructive calls and box it into a workspace folder, however if enabled, a clever agent can find a way to mess up, further  all tool calls *should* require permission every single time for anything outside of seven, this module is disabled by default and not recommended unless you're really sure.


## Known Issues
- Current remote models cannot properly invoke the vision tool.
- Hydration of certain kind values and actions injected into the prompt is currently broken due to an update to the prompt freezing mechanism, this powers the linking mechanism and currently causes a prompt refresh if a linked stat changes due to a buff. Expect this to be fixed before anything else.


## On with the good stuff

> Seven is a local desktop app for running AI agents at home — built for roleplay, writing, worldbuilding, and visual/interactive stuff, not coding.


Almost every agent tool out there is a terminal wrapper built for writing software. 

Seven is purposely not that. I built it primarily for myself because I wanted somewhere to actually *do* things with agents visually — have character sheets, notes, cards, random tables, maps, and images sitting right there on screen where both you and the agent can see and edit them, all saved locally on your own machine.

<img width="1920" height="1050" alt="main_demo_image_1" src="https://github.com/user-attachments/assets/133609c3-b61c-4d9a-b647-834d8674a711" />
<img width="1920" height="1050" alt="main_demo_image_2" src="https://github.com/user-attachments/assets/d894ff23-f7b2-4d23-9094-45e2aabc2021" />


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
<img width="1920" height="1050" alt="seven_example_pageediting" src="https://github.com/user-attachments/assets/533c8127-52c2-4219-b3ae-2fcd9b8173aa" />

<img width="1839" height="985" alt="seven_making_a_card" src="https://github.com/user-attachments/assets/d5261ec3-fe52-48cb-90ac-796bc371da2b" />
<img width="1839" height="985" alt="seven_composer" src="https://github.com/user-attachments/assets/6af32811-5f0f-4496-ba96-fd2a7d298de2" />


## What Next
1: You can export and import almost anything from and to Seven as Seven cards, simply dragging the card onto seven or placing it in Your_seven_install/resources/ is enough to get them imported.

2: Be sure to explore all the various different kinds, they all serve a purpose and a function and often kinds make use of other kinds.

3: Check the tools and create your own agent, and avatar.

4: You can click the various image fields such as a character sheet and if you have sd-server installed and set up (you need to use the download and find a proper image generation model) it can directly pass in the character sheet fields generate the image and assign it.


## Roadmap
** Much more thorough themeing support
<img width="2752" height="1536" alt="themeslices" src="https://github.com/user-attachments/assets/dfe71158-92ed-45ae-9065-c31efc8ce10f" />

** Proper language key support to enable UI translations to other languages

** Experimental 2D top down RPG implementation

** Improving the data modelling and tools for agents and roleplay.

** Test and release the android local network companion app.


Note : Seven will always be free and open source, a donation link *may* be added a later date but is *neve*r required and is *never mentioned anywhere inside the application*.


You can download this card and drop it into Seven to import the character Vesper! (And you can export anything like this too or as json or markdown in most cases)

<img width="321" height="404" alt="vesper" src="https://github.com/user-attachments/assets/355d6946-43f4-47fe-b6ab-66a5dee32168" />

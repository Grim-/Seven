---
title: Agents, Chats & Tools
section: Chat & Agents
order: 30
summary: Ways to configure personas, pick models per agent, enable tools safely, and choose the right chat mode.
tags: [agents, chat, tools, tabletop, cinema, thinking, context]
---

An **Agent** in Seven is a reusable setup combining a persona/system prompt, a model choice, sampling settings, linked sheets/characters, and the exact tools that agent is allowed to call. Open [Agents](seven-view:agents) to create or tune one.

## Practical Agent Patterns

### 1. Focused Specialist Agents
Instead of giving one agent every tool, create small specialists:
- **Writer / Lorekeeper:** Library + Notes tools enabled; clean system prompt; no shell/workspace tools.
- **Game Master:** Play / World tools + Image tool enabled; paired with a World Atlas in Tabletop chat mode.
- **Coding / Research Partner:** Workspace folder linked + file/search tools enabled.

### 2. Mixing Local and Remote Models
Each agent can either follow your **currently loaded local model** or pin a specific **remote model** (e.g. `gemini-3.8-flash`, `claude-sonnet-4-5`, or `openai/gpt-4.1`). Remote models do not need to be loaded in the taskbar — they respond on demand.

### 3. Chat Layouts
Hover the **Chat** tab in the taskbar to switch between three layouts:
- **Default:** Classic clean message thread with collapsible tool calls and thoughts.
- **Tabletop:** Side-by-side live World Atlas, character sheets, and chat — built for RPG sessions and interactive scenes.
- **Cinema:** Focused widescreen presentation with ambient visuals and audio.

## Enabling Tools Without Clutter

- Open an agent and turn on only the tool groups it needs (for example, enable **Image** so the agent can call `generate_image` and `edit_image`).
- Review or customize tool availability globally in [Tools](seven-view:tools).
- If an agent runs into its tool-round limit on big tasks, increase **Most tool rounds per reply** in that agent's settings.

---
title: Models, Servers & Remote APIs
section: Models & Servers
order: 20
summary: Managing local GGUF checkpoints, LoRAs, Control Vectors, and cloud providers (Google, OpenAI, Anthropic, OpenRouter).
tags: [models, gguf, remote, openai, gemini, openrouter, ollama, lora, control-vector]
---

Seven can run **local models** on your own GPU/CPU (`llama-server` for chat, `sd-server` for diffusion images) and connect to **remote APIs** side-by-side. Open [Models](seven-view:models) to manage everything in one place.

## Local Models vs. Remote Models

| Type | Runs via | How you use it |
| --- | --- | --- |
| Local Chat (`.gguf`) | `llama-server` | Load from the taskbar picker or Models view; shared by local agents |
| Local Image (`.safetensors` / `.gguf`) | `sd-server` | Pick in Image Generator or set as Default for `generate_image` |
| LoRAs & Control Vectors | Attached at runtime | Listed in their own categories in Models; never loaded standalone |
| Remote Chat (Gemini / GPT / Claude / OpenRouter) | Cloud HTTPS or LAN | Assign directly to any agent in [Agents](seven-view:agents) — no global load step |
| Remote Image (GPT Image / Gemini Image / OpenRouter) | Cloud HTTPS | Mark **Use for → Image generation** and set as Default for images |

## Using the Taskbar Model Picker

Click the model status button on the bottom taskbar to open the quick picker without leaving your chat:

1. **Star favourites** directly in the list so your daily models pin to the top.
2. **Search & filter** by name, family, quant, architecture, or provider — click **Filter** for the full Family / Dense-MoE / MTP / Quant / Max Size controls.
3. **Jump to details** by clicking the arrow button (`↗`) on any model row (or next to the currently loaded model) to open its full settings screen in [Models](seven-view:models).

## Connecting a Remote Model

1. Open [Models](seven-view:models) and click **Add Remote**.
2. Pick a provider preset (**Google Gemini**, **OpenAI**, **Anthropic**, **OpenRouter**, **Local Server**, or **Custom**).
3. Paste your API key and click **Fetch list** to browse every model enabled on your key (use **Browse all** to filter by `Chat`, `Reasoning`, or `Image`).
4. Set **Use for** to **Chat** (for agents) or **Image generation** (for the Image tab and `generate_image`).

> **Tip:** Remote models are assigned per-agent in [Agents](seven-view:agents), so one agent can run a fast local Qwen model while another uses Claude or Gemini at the same time.

## Companion Weights, LoRAs & Control Vectors

- **LoRAs** and **Control Vectors** appear in their own tabs inside **Models** so they stay out of your runnable chat list.
- When you download an image pack, Seven automatically matches companion files (VAE, CLIP-L, CLIP-G, T5XXL, LLM encoder) and opens the setup modal if anything still needs your confirmation.

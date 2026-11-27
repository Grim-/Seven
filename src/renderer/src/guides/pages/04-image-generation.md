---
title: Image Generation & Editing
section: Image Generation
order: 40
summary: Local sd-server pipelines, LoRAs, remote image models (OpenAI, Gemini, OpenRouter), and letting agents call generate_image.
tags: [image, sd-server, lora, img2img, generate_image, edit_image, openai, gemini, openrouter]
---

Seven's [Image Generator](seven-view:image) and the `generate_image` / `edit_image` agent tools share the exact same image runtime, history, and default-model setting — working seamlessly with both **local diffusion models** and **remote cloud image APIs**.

## Setting a Default Image Model (for Agents)

Whenever an agent calls `generate_image` without naming a specific model, Seven uses your **Default image model**:

1. In [Image Generator](seven-view:image), select your preferred local or remote image model and click the **star / Default** button next to the picker (or click **Set as default** on the model's detail page in [Models](seven-view:models)).
2. Make sure your agent has the **Image** tool group enabled in [Agents](seven-view:agents).
3. Your agent can now generate or edit images on demand and drop `@file:...` links straight into chat.

## Using Local `sd-server` Models

- **Auto-configuration:** Downloading a checkpoint or modular pack automatically detects companions (VAE, CLIP, T5XXL, LLM) and opens the setup modal so you can review or tweak any slot.
- **LoRAs:** Expand the **LoRAs** chip in the left studio dock to stack one or more installed LoRAs and dial each weight slider individually — Seven injects the `<lora:name:weight>` tags automatically.
- **Low-VRAM options:** Toggle `CLIP on CPU`, `VAE Tiling`, `Offload to CPU`, or `Flash Attention` right in the model's config or studio dock.
- **Reference image (img2img / edit):** Click **Add Ref** below the prompt box (or **Edit / img2img** on any generated image) to guide the next render from an existing library picture.

## Using Remote Image Models

You can generate images without any local GPU using cloud providers:

- **OpenAI:** Add a remote model with `gpt-image-1`, `gpt-image-1-mini`, or `dall-e-3` (Seven automatically adapts `output_format` and clamps aspect ratios to supported OpenAI sizes).
- **Google Gemini:** Add a remote model with `gemini-2.5-flash-image` or `gemini-nano-banana-2.1`.
- **OpenRouter:** Add a remote model with `google/gemini-2.5-flash-image-preview`, `black-forest-labs/flux.2-pro`, or `openai/gpt-5-image` — Seven routes OpenRouter image models through `/chat/completions` with image modalities automatically.
- **Custom OpenAI-compatible proxies:** Enter your endpoint URL and toggle **Use for → Image generation**.

## Viewer, Scan Progress & History

- Starting a new render clears the old picture immediately and displays a progressive **top-to-bottom scan** until the finished image reveals cleanly.
- The viewer supports **mouse-wheel zoom**, **click-and-drag pan**, **double-click Fit/100%**, and a floating **Properties** drawer that overlays without shrinking the image.
- Click **History** to open the remembered **Prompts** / **Grid** modal — click any image to reload its prompt and settings, or right-click for quick actions (Edit, Open in Files, Copy Prompt, Delete).

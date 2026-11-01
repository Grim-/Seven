# Remote agents

## Goal
An agent can run on a remote model (OpenAI, OpenRouter, Anthropic, LM Studio or Ollama on another PC, the stateful-agents proxy) and nothing else in Seven knows the difference: same tools, library, memory, timeline, routines, approvals, presentations. Remote is a property of the model, not of the agent.

## Rules
- **A remote model is a model.** It sits in the Models list next to local ones, and an agent picks it the same way.
- **Two APIs:** OpenAI-compatible (which covers almost everything) and Anthropic's own.
- **Keys live in the vault**, per vault. A work agent with a work key sits in a work vault; switching vaults is the boundary.
- **It's visible.** A remote model, an agent using one and its chats are marked remote, so it's always clear when data leaves the machine.
- **What it can see is what the agent can see.** Library access and permissions work exactly as for local agents; nothing extra is sent.
- **Errors say what happened** (bad key, rate limit, model not found, offline), in plain words.

## How
The model is only asked for things in two places today: chat turns (the runner) and the reason tool. Both go through llama.cpp's chat session.

1. **Remote models.** Models view: add a remote model (API, base URL, model name, key, context size), test it, set sampling like any model.
2. **A remote chat session** that looks the same to the runner as the local one: it keeps the same history format, sends it to the API with tools, streams text and thinking back, runs tool calls through the same tool hooks and stops when asked. Local-only parts (loading weights, the saved KV state, exact token counts, GPU stats) are skipped; context use comes from what the API reports, or an estimate.
3. **Everything else that asks the model:** summaries when a chat is compacted, chat titles and the reason tool go through the same session, so a remote agent is remote all the way.

## Later
- Pictures to vision-capable remote models.
- Showing token use and cost per chat.

## Not doing
- Sending anything to a remote model the agent didn't ask for.
- Mixing: one agent turn uses one model.

# Hardening pass

What to make solid once Seven has had real day-to-day use.

## CUDA

- Seven uses node-llama-cpp's prebuilt CUDA builds (`@node-llama-cpp/win-x64-cuda` and `-cuda-ext`). The `-ext` build should carry the CUDA runtime, so a machine needs only a current NVIDIA driver, not the toolkit. Confirm on a clean machine.
- Nothing may fall back to Vulkan silently. With GPU set to CUDA, a failure must say why CUDA couldn't start. Auto should say which backend it picked.
- Anything that opens its own model engine (the embedder runs CPU only) must never start a second GPU backend.
- The installed build must carry every backend: `electron-builder.yml` unpacks `bins`, `@node-llama-cpp` and `llama/localBuilds`.

## Updating the engine

Updating means a version bump of `node-llama-cpp`, which brings a newer llama.cpp and new prebuilt binaries. Seven leans on a few of its internals; check these after every update:

- The Gemma 4 chat-template fix in `src/engine/model/wrappers.ts`.
- Thinking: `budgets.thoughtTokens` (the Thinking toggle) and the thought-marker handling in `src/engine/model/tags.ts`.
- Function calling and the chat history Seven rebuilds (`src/engine/chat/history.ts`).
- GPU selection and memory checks (`src/engine/model/host.ts`).

Run `scripts/bench-context.ts` and `scripts/eval-tools.ts` against the models in daily use before switching, and keep the previous version pinned until they pass.

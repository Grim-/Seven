# Architecture

Broad strokes only; the code is the detail.

- **Three parts.** The window (what you see), the engine (the model, agents, tools and the library, in its own process so a crash there doesn't take the app down) and the main process (windows, tray, overlay, vault and files). It's an Electron app.
- **The model** runs locally through llama.cpp, on your GPU and CPU.
- **Your data** lives in one folder, a vault. Set a passphrase and it's encrypted. You can keep several vaults and switch between them, and a backup is one file.
- **Agents work through tools**, grouped in modules. Most are built in; add-ons add more from your Tools folder once you approve them.
- **Screens ask the kinds.** What you see of an entry, anywhere, comes from its kind.

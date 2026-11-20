# Image Generation (`image`)

Adds two tools for generating and editing pictures via external `sd-server` diffusion models or configured remote image APIs:

- **`generate_image`**: Creates a new image from a text prompt (with optional negative prompt, dimensions, seed, filename, and model choice).
- **`edit_image`**: Transforms or edits an existing library image (referenced by file id or name) according to a prompt and optional mask image.

Every output image is automatically saved into **Files** and returned as a Vault-safe `@file:<id>` link so characters, cards, handouts, maps, and chat replies can use it immediately.

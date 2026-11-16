# Cards

- A card's variations combine Prompt (`whatHappens`, `agentInstructions`, `requiresPlayerResponse`), Roleplay (`action` / `decision` / `opposed` with optional `effects` and `passAction` / `failAction`), and Gameplay (`check`, `defence`, `dc`, `hit`/`miss` trigger actions, and inline `effects`).
- `make_card` accepts one `variation` or a `variations` array to configure multiple layers in one call; `make_card_layout` creates/updates `@card_layout` field templates.
- `manage_deck` lists or modifies cards in your own (`self`), `user`, `character`, or named `deck`, and deals `card_set` templates with `deal_set`.
- `play_card` plays a card from your own deck onto a user, self, character sheet, creature, or map object. `give_card` can roll a repo of card names for random loot.

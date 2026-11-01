# Cards

Built in v353.

## Why

When you play a story with an agent, you're king: you can win at any point, and even an agent playing fair leans toward giving you what you want. A hand of cards gives you a set of real moves to puzzle out a moment with. You can still type anything, but given a hand you'll use it.

Cards keep it visual. Text alone flattens a lot; a hand you can fan, lift and throw into the chat is a game-like wrapper around what are really choose-your-own-adventure books. The agent only ever sees clear text.

## Terms

- **Card:** one move. Three types:
  - **Generic:** a prebuilt prompt with a face. Played, its text is sent as your message (in a chat) or goes to Play this out (on the map).
  - **Action:** an attempt rolled against the character's stats (the roll modal; "one check, picked" asks which first). The result picks the outcome.
  - **Decision:** a choice with options, made by the user or an agent. Never rolled.
- **Card Set:** a template. A premade list of cards with a quantity of each, like a wizard's starter set. Never used up, never changed by play.
- **Card Deck:** an inventory, the cards actually held. It can start empty and earn cards as it goes, start from a Card Set (adding a set copies its cards and quantities in), and gain or lose cards from outcomes and decisions or from the agent.

**Cost** is always the card itself: playing one takes it out of the deck. Nothing fancier. **Outcome** can be anything at all, far beyond a normal card game, because an LLM plays it out; what decides it is the character's stats (actions) or the user (decisions).

## Whose deck

- **A character** has a Card Deck of their own, scoped to that character.
- **An agent** is given one of:
  - **a Card Deck** to use: "here's an existing set of cards to use", carried on from chat to chat;
  - **a Card Set**: "here's a new set of cards", so each new chat starts a fresh deck from it;
  - **a character**: their deck is the one used.
- **In a world's Play view** it's your character's deck.
- The agent never sees the deck. It only learns about a card when one is played. It can give and take cards with `give_card` and `take_card` (a card, or a repo of cards for random loot).

## Gaining and losing cards

- An action's pass and fail outcomes (and each check's own), and each option of a decision, can say which cards the deck gains or loses ("gain Healing potion", "lose Homestone"). It happens when that outcome comes up, and the roll or decision shows it.
- That's how cards are earned in play as well as from the agent.

## Playing

- **The hand** is the deck in use, fanned Hearthstone style: hover pulls a card up to read; click or drag it to play. It sits by the composer in a chat and under the map in Play.
- **In a chat** a card plays straight away: it glows and burns out, then its message appears. The composer is separate: typing and pressing Send is one choice, playing a card is the other, and a card only sends its own text.
- **On the map** each card shows its button (Use, Roll, Decide); pressing it does the thing and burns the card out. Results go to Play this out and the journey.
- What the agent is told is the existing text (ACTION RESULT, DECISION FOR …, or the generic card's prompt) with a `CARD PLAYED: [Fireball]` line first. `{repo}` tokens roll and links resolve when a card is played.

## What there is today, and what changes

- Cards are a module (`src/modules/cards`): kinds `card`, `deck`, `layout`, `rules`, `game`; the screens `CardScreen`, `DeckScreen`, `LayoutScreen`, `CardFace` (on `ShellFace`), `LiveCard`; tools `cards_card`, `cards_deck` and seven game tools; a game engine (`rules.ts`, `game.ts`, `examples.ts`).
- **Stays:** cards and layouts (how a card looks), `cards_card`. Today's `deck` kind (a list of cards with counts) becomes the **Card Set**; `cards_set` makes Card Sets. The Draw panel keeps drawing from sets and repos.
- **New:** the **Card Deck** kind (an inventory), held by a character or given to an agent.
- **Goes:** the game engine, the rule set and game kinds, the seven game tools (`cards_rules`, `cards_starter`, `cards_new_game`, `cards_state`, `cards_play`, `cards_end_turn`, `cards_ruling`), and the decks' rule sets. There are none to delete.
- **The Fireball demo** becomes a map card with an action.

## Build plan

1. **Mockup** (`mockups/cards.html`, done): the fanned hand in the chat (hover to lift, click or drag to play, the burn-out), the map hand under Play with buttons, and the card screen's new parts.
2. **Cards get their type:** Generic (its prompt), Action or Decision, edited with the existing action and decision forms; outcomes and options can gain or lose cards. The face shows the type, with its check line worked out from its checks. `{repo}` tokens roll when a card is played, and when any action or decision is used (places, objects and characters too); links resolve for the agent.
3. **Card Sets and Card Decks:** the deck kind renamed to Card Set; the new Card Deck kind (Add a card, Add a set, Take one away); a character's deck on their sheet; an agent's Cards setting (a deck, a set, or a character), and its "Your character" setting; `give_card` and `take_card`.
4. **The hands:** the shared fanned hand component (hover, click, drag, burn-out), by the composer and under the Play map, each playing the deck in use and taking the card out of it.
5. **Clean-up:** the game engine, kinds and tools go.

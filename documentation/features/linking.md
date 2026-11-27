# Small pages, linked together

This is the idea everything else in Seven builds on.

Most apps give you a preset or a character card: one big block of text. Seven gives you small pieces and a way to join them.

<!-- GIF: the composer building a prompt from linked pages, sheets and repos -->

## Everything can be linked

Pages, character sheets, places, stats, repos, cards, reasoning styles: everything in Seven is something you can point at. Type `@` anywhere and pick one:

```
@page:turn_based_rules
@sheet:tessa
@stat:anger
@repo:saloon_names:value
```

When an agent reads a link, it gets the thing itself, as plain markdown. A repo link rolls a value: `:value` rolls fresh every time the text is read, `:roll` rolls once and keeps it.

## So a "preset" is just a page

Write a few small pages, each about one thing. Then write one page that links them. Link that page in an agent's instructions and the agent has the lot.

Change one small page later and everything that links it changes too. Nothing to copy, nothing to keep in sync. You can build these by typing, or pick the pieces in the **Composer**.

## Here's what you can do with it

- [Set up a campaign](campaign-setup.md): rules, cast, places and random names in one page.
- [Meet a different person every time](random-character.md): one character sheet, a new face every scene.
- [Make a mood mechanic](stats-and-rules.md): a stat that explains itself and a three-line rule.
- [Let cards move the story](cards-and-stats.md): cards that push stats, and an agent that reacts.
- [Open a portal](portal-scenes.md): a card that drops you into a random prewritten scene.
- [Always offer choices](choices.md): the agent ends each turn with options to pick from.

Anything you build this way can be exported as a Seven card and shared.

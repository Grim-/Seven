# Example: set up a campaign

A western roleplay, made of small pieces. See [Small pages, linked together](linking.md) for the idea behind it.

## The pieces

- a page with your **writing style**
- a page with your **turn rules**
- **character sheets** for the cast
- a few **places**
- a **repo** of saloon names

## The page that joins them

```
# Western campaign
Follow @page:writing_style and @page:turn_based_rules.
The cast: @character:tessa, @character:old_jim.
We start at @place:the_rusty_spur.
Each new saloon is called @repo:saloon_names:value.
```

Link `@page:western_campaign` in an agent's instructions and start playing.

<!-- GIF: building the campaign page in the Composer -->

## Why it works

- **Fix the rules once.** Tweak "Turn based rules" and every campaign that links it plays by the new rules.
- **Reuse the cast.** Tessa can turn up in a different campaign without being copied.
- **Fresh details.** Every new saloon gets a new name from the repo.

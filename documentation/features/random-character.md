# Example: a different person every time

A link works in any field, and it's read fresh every time an agent reads the entry. So a character sheet doesn't have to describe one person. It can describe a kind of person, and come out different each time. See [Small pages, linked together](linking.md) for the idea behind it.

Let's build one: a wild druid.

## The body

Start with a basic character sheet and add a few fields:

| Field | Value |
|---|---|
| Hair | `@repo:colours:value` |
| Race | `@repo:fantasy_races:value` |
| Traits | `@repo:character_traits:value` |
| Backstory | `@page:raised_alone_in_the_woods` |

Every time the sheet goes into an agent's prompt, the repos roll again. Red-haired half-orc one scene, silver-haired elf the next. The backstory is a page you wrote once, so she always grew up alone in the woods.

<!-- GIF: the sheet with linked fields, then two chats meeting two different druids -->

## The mind

With the Mind module on, her sheet gets a **Mind** tab: the same mind agents have, scoped to her.

- **Reasoning style:** one that thinks about nature through brutal, pragmatic survival. What will this cost me, what can I eat, who can I trust.
- **Founding memories:** a few memories about independence. The winter she got through alone, the first time she refused help.
- **Speaking:** simple words, short sentences, nothing academic.

<!-- IMAGE: the Mind tab filled in -->

## What you've got

One sheet that always thinks, remembers and talks like the same wild druid, but looks like someone new each time you meet her.

- **Choose what stays.** `:value` rolls on every read. Use `:roll` for anything that should be picked once and kept, like a name.
- **Repos nest.** A trait can link another repo ("haunted by `@repo:regrets:value`"), so you get combinations nobody wrote out.
- **Make a set.** Corrupt guard, street kid, travelling monk: one sheet each and you have endless people to meet.

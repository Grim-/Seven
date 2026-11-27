---
title: Creating Dynamic Characters
section: Characters & Gameplay
order: 32
summary: Build a single character sheet that rolls fresh appearance and traits on every read while keeping a consistent mind and backstory.
tags: [characters, sheets, repos, mind, roleplay, links]
---

A link works in any field, and it's read fresh every time an agent reads the entry. So a character sheet doesn't have to describe one person — it can describe a **kind of person**, and come out different each time.

Let's build one: a **wildling druid**.

![Character sheet setup for the wildling druid](../media/archetype_character_1.png)

## The Body

Start with a basic character sheet in [Data](seven-view:data) and add a few fields:

| Field | Value |
| --- | --- |
| Identity | `@repo:starter_names:value` |
| Hair | `@repo:colours:value` |
| Race | `@repo:fantasy_races:value` |
| Traits | `@repo:character_traits:value` |
| Backstory | `@page:raised_alone_in_the_woods` |

Every time the sheet goes into an agent's prompt, the repos roll again — red-haired half-orc one scene, silver-haired elf the next.

The backstory is a page you wrote once, so she always grew up alone in the woods.

![Linked repo fields and backstory on the character sheet](../media/archetype_character_2.png)

## The Mind

Open her **Mind** tab (the agent wearing her in [Agents](seven-view:agents) needs its **Mind** tools on):

- **Reasoning style:** "think like your character".
- **Founding memories:** a few memories about independence — the winter she got through alone, the first time she refused help.
- **Speaking:** simple words, short sentences, nothing academic.

![Mind tab configuration with reasoning style, founding memories, and speaking style](../media/archetype_character_3.png)

## What You've Got

One sheet that always thinks, remembers, and talks like the same wild druid, but looks like someone new each time you meet her.

- **Choose what stays.** `:value` rolls on every read. Use `:roll` for anything that should be picked once and kept, like a name.
- **Repos nest.** A trait can link another repo (`haunted by @repo:regrets:value`), so you get combinations nobody wrote out.
- **Make a set.** Corrupt guard, street kid, travelling monk — one sheet each and you have endless people to meet.

And here we have one random feral druid:

![First generated wildling druid instance](../media/archetype_character_5.png)

![Wildling druid responding in character in chat](../media/archetype_character_6.png)

Same character sheet, new chat — vaguely the same, yet a different wildling druid.

Hopefully this gives you an idea of how links, repos, custom character sheets, and stats enable varied behaviours in your agents, and let you interact with them through roleplay or systemic card gameplay (including buffs and debuffs that affect stats).

![Second chat with the same dynamic character sheet rolling a fresh variant](../media/archetype_character_6.png)

Next: learn how to drive agent mood and mechanics with custom stats in [Stats & Rules: Stat-Driven Behaviour](guide:08-stat-driven-behaviour).

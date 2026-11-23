# Example: a different person every time

A link works in any field, and it's read fresh every time an agent reads the entry.
So a character sheet doesn't have to describe one person. It can describe a kind of person, and come out different each time. 


Let's build one: a wildling druid.

<img width="1920" height="1050" alt="image" src="https://github.com/user-attachments/assets/32575fb5-f7ee-49a0-9083-0ef272d04ad9" />


## The body

Start with a basic character sheet and add a few fields:

| Field | Value |
|---|---|
| Identity | `@repo:starter_names:value` |
| Hair | `@repo:colours:value` |
| Race | `@repo:fantasy_races:value` |
| Traits | `@repo:character_traits:value` |
| Backstory | `@page:raised_alone_in_the_woods` |

Choose what stays. :value stays a live link and picks a fresh result each time the sheet is loaded into a new scene. :roll rolls immediately right where you type it and bakes the result into the sheet as plain text—handy if you want to lock in a random name or trait for good. 

So you can have a Red-haired half-orc one scene or silver-haired elf the next.

The backstory is a page you wrote once, so she always grew up alone in the woods.

<img width="1920" height="1050" alt="image" src="https://github.com/user-attachments/assets/6326c5e0-747c-4bf3-b5bb-4b90f0c635dd" />


## The mind

Open her **Mind** tab (the agent wearing her needs its Mind tools on):

- **Reasoning style:** 'think like your character'.
- **Founding memories:** a few memories about independence. The winter she got through alone, the first time she refused help.
- **Speaking:** simple words, short sentences, nothing academic.

<img width="1920" height="1050" alt="image" src="https://github.com/user-attachments/assets/8b6d107a-40c3-4e2d-bc01-bb478d6eec87" />


## What you've got

One sheet that always thinks, remembers and talks like the same wild druid, but looks like someone new each time you meet her.


- **Choose what stays.** `:value` rolls on every read. Use `:roll` for anything that should be picked once and kept, like a name.
- **Repos nest.** A trait can link another repo ("haunted by `@repo:regrets:value`"), so you get combinations nobody wrote out.
- **Make a set.** Corrupt guard, street kid, travelling monk: one sheet each and you have endless people to meet.


And here we have one random feral druid.

<img width="1920" height="1050" alt="image" src="https://github.com/user-attachments/assets/fa41b1f9-5964-4ee4-a9f8-ceccc04f55d6" />
<img width="1920" height="1050" alt="image" src="https://github.com/user-attachments/assets/d03254e6-1f78-4819-8284-58fe640f149e" />


Same character sheet, new chat, vaguely the same but different wilding druid.

Hopefully this provides an idea of how you can using links and various repos, and custom character sheets and stats enable varied behaviours in the agents characters, and interact with them via roleplay or the systemic gameplay of cards (which can be used on agents with a variety of effects - including buffs and debuffs that affect stats!)


<img width="1920" height="1050" alt="image" src="https://github.com/user-attachments/assets/fbbbe8f1-240e-47f0-b32d-9bdafcd4ff50" />



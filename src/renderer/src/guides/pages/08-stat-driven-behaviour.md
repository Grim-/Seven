---
title: Stats & Rules: Stat-Driven Behaviour
section: Characters & Gameplay
order: 34
summary: Track custom stats like Anger, Trust, or Fear on character sheets and connect a short rules page so agents react automatically.
tags: [stats, rules, buffs, cards, gameplay, characters, mood]
---

Seven doesn't decide what your game tracks — you do. A stat can be Strength or Health, or it can just as easily be **Anger**, **Trust**, **Fear**, or how drunk someone is. Link it into a short rules page and the agent plays by it.

## 1. A Stat That Explains Itself

Create a stat called **Anger** in [Data](seven-view:data). Give it a range (`0` to `10`), a default, and a description written for the agent:

> This stat describes how angry a character CURRENTLY is. The lowest value means very calm and placid, the highest value denotes incandescent rage.

That description travels with the stat. Whenever an agent looks at `@stat:anger`, it gets the meaning and the limits as well as the number. You never have to explain Anger anywhere else.

![Creating the Anger stat with range 0 to 10 and an agent-facing description](https://github.com/user-attachments/assets/9505c76f-d57c-41b8-b014-653566e6fade)

Ensure the character in question has a **Game** tab added in its character sheet (next to the tab menu):

![Adding the Game tab to a character sheet](https://github.com/user-attachments/assets/4c023f5f-268b-402a-94a3-3fdc5150d568)

Now you can see the custom **ANGER** stat at a value of `10` — and adjust it directly:

![Viewing the custom ANGER stat on the character's Game tab](https://github.com/user-attachments/assets/c1e3bd7f-ce3a-44d3-b72c-acc3f4fd9107)

Each character sheet holds its own current value, and buffs, items, and events in play push it up and down.

## 2. A Tiny Rules Page

Write a short page telling the agent to use the stat — for example, `mood_rules`:

```markdown
# Mood rules
Your mood is tracked in stats, and it changes during play:
buffs, items and events push it up or down.

Before every reply:
1. Look up your character sheet and read your current @stat:anger.
2. Read what that value means from the stat's own description.
3. Let it shape how you speak and act this turn.

The value moves between turns, so read it fresh each time.
```

You can also create an optional **buff** that decreases the target's Anger stat by `5`:

![Buff definition that lowers the target's Anger stat by 5](https://github.com/user-attachments/assets/d5fc6877-b883-4cb8-947f-baf0c22459f7)

And a **card** with a gameplay variant that applies this buff:

![Gameplay card applying the calming buff to a character](https://github.com/user-attachments/assets/e543be76-4a16-4252-90a2-9eae5a1313f5)

## 3. Hand It to the Agent

Link `@page:mood_rules` in the agent's **instructions** in [Agents](seven-view:agents) (or in the initial prompt / campaign setup page — agent instructions work best). Done.

## Why This Is Useful

- **The game moves the mood, not you.** A taunt raises Anger, a calming draught lowers it, and the agent's tone follows on its own. You never type "be angrier now".
- **One rules page, many characters.** Tessa sits at `2` and Old Jim at `8` — same page, same stat, two very different replies.
- **Thresholds live in the stat.** Put them in the description ("at 8 or more, refuses to cooperate") and the rules page stays short.
- **Swap the stat, keep the rules.** Fear, Trust, Sanity, or Corruption work the same way. Give them a group such as `mind` and have the rules page say "read every stat in your mind group" — any new stat you add later is covered automatically.
- **Fix it once.** Change the description of Anger and every character and agent using it behaves differently from the very next reply.
- **Nothing hidden.** The stat sits on the sheet where you can inspect or tweak it yourself to steer a scene.

Related: [Creating Dynamic Characters](guide:07-creating-characters).

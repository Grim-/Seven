# Stats and rules: make your own mechanics

Seven doesn't decide what your game tracks. You do. A stat can be Strength or Health, but it can just as easily be Anger, Trust, Fear or how drunk someone is. Link it into a short rules page and the agent plays by it.

## 1. A stat that explains itself

Make a stat called **Anger**. Give it a range (0 to 10), a default, and a description written for the agent:

> This stat describes how angry a character CURRENTLY is. The lowest value means very calm and placid, the highest value denotes incandescent rage.

That description travels with the stat. Whenever an agent looks at `@stat:anger`, it gets the meaning and the limits as well as the number. You never have to explain Anger anywhere else.


<img width="1920" height="1050" alt="image" src="https://github.com/user-attachments/assets/9505c76f-d57c-41b8-b014-653566e6fade" />



Ensure the character in question has a 'Game' Tab added in its character sheet (next to the tab menu!)

<img width="1920" height="1050" alt="image" src="https://github.com/user-attachments/assets/4c023f5f-268b-402a-94a3-3fdc5150d568" />


Now we can see our custom stat, ANGER at a value of 10, we can fix that!

<img width="1920" height="1050" alt="image" src="https://github.com/user-attachments/assets/c1e3bd7f-ce3a-44d3-b72c-acc3f4fd9107" />


Each character sheet holds its own current value, and buffs, items and events in play push it up and down.

## 2. A tiny rules page

Now write a page that tells the agent to use it, lets call it mood_rules

```
# Mood rules
Your mood is tracked in stats, and it changes during play:
buffs, items and events push it up or down.

Before every reply:
1. Look up your character sheet and read your current @stat:anger.
2. Read what that value means from the stat's own description.
3. Let it shape how you speak and act this turn.

The value moves between turns, so read it fresh each time.
```


Lets also create an optional buff that decreases the targets anger stat by 5.
<img width="1920" height="1050" alt="image" src="https://github.com/user-attachments/assets/d5fc6877-b883-4cb8-947f-baf0c22459f7" />

And a card with a gameplay variant that adds this buff.

<img width="1920" height="1050" alt="image" src="https://github.com/user-attachments/assets/e543be76-4a16-4252-90a2-9eae5a1313f5" />



## 3. Hand it to the agent

Link `@page:mood_rules` in the agent's instructions or the intial prompt (but the instructions are best!), or in the page that sets up your [campaign](campaign-setup.md). Done.

<!-- GIF: a buff raising Anger, and the agent's next reply turning sharper -->

## Why this is useful

- **The game moves the mood, not you.** A taunt raises Anger, a calming draught lowers it, and the agent's tone follows on its own. You never type "be angrier now".
- **One rules page, many characters.** Tessa sits at 2 and Old Jim at 8. Same page, same stat, two very different replies.
- **Thresholds live in the stat.** Put them in the description ("at 8 or more, refuses to cooperate") and the rules page stays the same short page.
- **Swap the stat, keep the rules.** Fear, Trust, Sanity or Corruption work exactly the same way. Give them a group such as `mind`, have the rules page say "read every stat in your mind group", and any new stat you add later is covered without touching the page.
- **Fix it once.** Change the description of Anger and every character and agent that uses it behaves differently from the next reply on.
- **Nothing hidden.** The stat is on the sheet where you can see it, and you can change the value yourself to steer a scene.

Next: [let cards move the story](cards-and-stats.md).

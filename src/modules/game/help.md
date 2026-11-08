# Game

The rules data the world game runs on. Everything here is yours to change; the game reads it, nothing about it is built into the code.

- **Stats**: each has a group (attribute, resource, combat, resist…), a default, a lowest and highest value, and for resources a regeneration per second, minute, hour or day. Health, Stamina and Mana are stats: the stat is the maximum, the character's current value fills and drains under it.
- **Damage types**: each names the resist stat that reduces it. A resist of 0 takes damage normally, 0.5 takes half, 1 takes none, −1 takes double.
- **Formulas**: rules written as formulas. Damage looks up the formula with the id `damage`.
- **Clocks**: how fast game time runs and how long ticks, hours, days and battle rounds are.
- **Checks**: rolls the game asks a character for, such as Perception. Each has its dice (`1d20`, or `max(1d20, 1d20)` to keep the higher of two) and a bonus formula reading the roller's stats as `user.<stat id>`.

Everything here belongs to a **rule set**. A world picks the rule set it plays by (Rules, beside Your character in the world), so a fantasy world and a world with guns can have different rules. New rule sets start empty or as a copy of another. Seven makes the Starter rule set when there is none.

A starter set is put in the first time each list of a rule set is opened. Deleting entries never brings it back.

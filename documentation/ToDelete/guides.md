n# Guides

## Goal

What agents are told shouldn't be hidden. Seven is built around pages, so how each tool works, and what each agent is given, are pages too: visible to the user, linkable, read with `read` like everything else.

## Rules

- **Guides are generated pages.** One per tool module, built from the module every time it's read, so it's always current and can't be edited. A "Seven" section in the page tree holds them.
- **Each agent's instructions are a page.** "Instructions: Name" shows exactly what that agent is given. The user and that agent can read it; other agents can't (it holds the agent's pinned memories).
- **One way to read.** `tool_help` goes; guides are read with `read`.
- **The instructions keep only the core:** the agent's own prompt and character, the user, the environment, how to read and link, the library kinds, and one line per tool module pointing at its guide. The detail lives in the guides.
- **Errors point at guides.** A failed tool call says which guide explains it.

## A guide

`Seven: <module>`: what the module is for, its tools with what each does, then the module's own guide text (its prompt and help), filled in for the agent reading it.

## Phases

1. **Pages:** the guide pages, the instructions pages, the "Seven" section, `tool_help` removed, errors pointing at guides.
2. **Shrink:** module guide text leaves the instructions; each module becomes one line linking its guide.

If a model ignores guides and misuses tools after phase 2, the module's key rules go back into the instructions, still shown on its page.

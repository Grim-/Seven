# Timeline

## Goal

Seven knows *what* everything is (entries of kinds) but not *when* things happen. The timeline is one stream of what happened, shared by the user and agents, so:

- Memory gets easier: agents can see what actually happened lately instead of having to have remembered it.
- Days become entries: `@day:today` is a page of what happened, linkable and readable like anything else.
- Seven gets a place for proactivity later (routines).

## Rules

- **Events point, they never copy.** An event is "at this time, this happened to this entry, by this person/agent". No titles or content are stored; anything shown is read live from the entry.
- **Deleting an entry takes its events with it.** One action, nothing to hunt down. Deletions are never logged.
- **Days are generated**, like "All <kind>" pages: rebuilt every read, never stored, so a deleted entry simply isn't there.
- **Agents see only what they can see.** A day read by an agent leaves out entries hidden from it (hidden kinds, chats it can't read, other agents' minds, vault entries while locked).
- **It's a kind like everything else**: found with find, read with read, linked with @day:. No new tools.

## An event

`{ at, kind, id, action, by, chat }`: when, which entry, what happened (made, changed, talked, remembered, fired), who did it (an agent, or the user when empty), and the chat it happened in. Repeated changes to the same entry by the same person within a short window fold into one event.

Stored per month in the data folder, encrypted by the vault like other personal data.

## What gets recorded

- Pages of every type (including sheets, repos and add-on kinds), files and boards: made and changed.
- Chats: talked (one event per stretch of conversation).
- Minds: an agent remembered something.
- Agents and themes: made and changed.
- Reminders: fired.

Who did it comes from where the change was made: inside a tool call it's that agent (and chat); anywhere else it's the user.

## Days

- Kind `day`, ids like `2026-10-06`; `today` and `yesterday` also work.
- Reading a day lists what happened in order, with @links.
- Deleting a day forgets its events (the entries themselves are untouched).

## Phases

1. **Stream:** record events, attribute them, cascade deletes.
2. **Days:** the day kind, readable by user and agents; the Recent changes glance reads from the timeline.
3. **Routines:** a kind of its own that fully defines who, what, when and where the output goes. See routines.md.

Later option: deleting a chat could offer to delete what it produced (memories already record their chat).

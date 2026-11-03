# Routines

## Goal

Seven acts on its own when you've told it to. A routine is a kind that fully defines a piece of unattended work: who does it, what they do, when, and where the result goes. Nothing about it is decided at run time.

## A routine

- **Who:** one agent.
- **What:** an instruction, written like a message (@links attach entries the same way they do in chat).
- **When:** one of
  - a schedule: a time, repeating hourly, daily, on weekdays or weekly, or once;
  - something happening on the timeline: an entry of a kind (or one particular entry) being made or changed, by you or by anyone.
- **Where it goes:**
  - a chat: a new chat each run, or one ongoing chat for the routine;
  - optionally also a page, with each run's reply added under the date;
  - optionally a notification.
- **Permission mode** for its chat (ask, auto-edit, trusted), set by you. Approvals it needs wait in its chat, with a notification, like any chat.
- **On or off.**

## Rules

- Only you make, change or switch on routines. Agents can find and read them (they're entries), never set them up; that's the same line as agents never setting permissions.
- One runs at a time; if Seven is busy, it waits its turn.
- A routine never triggers itself: changes made during its own runs don't count, and a timeline routine waits at least 5 minutes between runs.
- Each run is on the timeline ("Routine X ran"), and deleting a routine takes its events with it. Chats and pages it wrote stay; they're yours.
- While the vault is locked, due routines wait and run once it's unlocked.

## Reminders and check-ins

They stay as they are. Scheduled runs from set_reminder keep working. If routines prove themselves, they can absorb those later.

## Where

- Data tab: Routines kind (group Time) with a screen to make, edit, run now, and switch on or off; shows next and last run.
- Engine: a routine store and scheduler next to the timeline; runs go through the normal chat runner.

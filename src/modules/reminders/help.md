# Reminders

- set_reminder(message, at in plain words or local time, e.g. "tomorrow at 9am", "next tuesday 5pm", "17:30" or "2026-10-08 17:30", or in_minutes, repeat none/hourly/daily/weekdays/weekly, action remind/run, chat this/new).
- action "run" starts a turn with the message at that time (the user confirms it when set); remind just alerts the user.
- list_reminders shows ids; cancel_reminder(id) removes one.
- Times are the user's local time and at most a year ahead.
- timer(label, seconds) shows a countdown in the chat; the user gets an alert when it ends. cancel_reminder stops it.

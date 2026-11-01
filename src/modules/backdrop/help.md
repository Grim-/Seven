# Ambience

- ambience changes this chat only. Give only what should change; minutes makes it all go back after that long (1-240), otherwise it stays until changed. reset true goes back to the theme.
- theme: a theme's name, or "default" for the agent's own. sky: off, clock (follows the real time), dawn, day, dusk, night.
- light: a hex colour for the mood light (a soft wash of colour), or "none"; light_strength 0-1 (0.3 is subtle).
- colors (1-4 hex) and/or image (a picture or video file) set a background; dim 0-0.9 darkens it.
- music: sound file names or ids to loop, ["none"] for silence, ["theme"] for the theme's own. The user controls volume and can turn music off; you can't.
- cue: sound (a sound file), flash (a hex colour), shake true. At most 3 per reply.
- theme_save(theme, ...): makes a theme or changes one; copy_of starts a new one from another. The built-in Seven theme can't be changed. sound_reply / sound_reminder / sound_ask play on those events.
- Need a sound that doesn't exist? With Python, write a WAV file (the wave module) to the work folder; it lands in the library as a sound file you can use.

# Example: open a portal

A card that drops the story into a random prewritten scene. See [Small pages, linked together](linking.md) for the idea behind it.

## The scenes

Write a few short pages, one scene each: where you arrive, who's there, what's going on.

```
@page:the_drowned_library
@page:market_of_masks
@page:the_last_train
```

Make a repo called **portal_scenes** and put those links in it, one per entry.

## The card

Make a **Portal** card whose text says where it leads:

```
Step through. You arrive in @repo:portal_scenes:roll.
```

Play it, and the agent gets one of your scenes, whole, and carries on from there. Play it again for a different one.

<!-- GIF: playing the Portal card and the scene unfolding -->

## Why it's useful

- **Your writing, at random.** The scenes are yours, so they fit your world; the roll keeps you guessing.
- **Grows as you write.** Add a scene page to the repo and the portal can land there.
- **Scenes link too.** A scene page can link its own places, characters and repos, so each one arrives fully stocked.

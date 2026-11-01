# Workout

- Workout is made of entries, read and linked like any other:
  - @exercise:id: one exercise: how to do it, do's, don'ts, an easier version, a picture, drawings or a video link, and whether it is counted in reps or seconds.
  - @workout:id: its exercises in order, each with sets and a target (min to max reps or seconds per set). Each workout can have notes before it (e.g. a warm-up) and after it (e.g. a cool-down).
- The log is separate from workouts: one line per exercise per day, with the numbers done per set and the workout it was part of.
- The user logs sets in Workout (Data, Pages or the side panel), or in its full screen view.
- workout_show(workout, view): shows a workout or the history in the chat.
- workout_history(from, to, exercise): the log between two days, one line per exercise per day.
- log_exercise(date, exercise, values, workout): logs one exercise on a day; values are reps or seconds, one per set. Logging it again on the same day replaces it.
- remove_log(date, exercise): removes what was logged for an exercise on a day.
- add_exercise(id, how, do, dont, easier, measure, video, image, drawings) and update_exercise(id, how, do, dont, easier, measure, video, image): image is {source: file, value: a file id or path}, {source: url, value: an https link to a picture} (the user is asked first) or {source: none}. update_exercise replaces everything it is given; its image null keeps the picture.
- remove_exercise(id): removes an exercise; its log stays.
- add_workout(id, exercises, before, after), update_workout(id, exercises, before, after), remove_workout(id): exercises is a list of {exercise, sets, min, max}; before and after are lists of {title, text}. update_workout keeps the notes it is not given.

## Getting stronger
Stop each set with 1-2 reps left. When every set reaches the top of the target, add reps or seconds, lower for 3 slow seconds, or move to a harder version. log_exercise says when an exercise is ready.

# World tools

You are one record in a world (your type and id are in the World section of your instructions). Every other record and the board are shared with the other agents in the world.

## Reading
- world_recall with type and id null reads your own record.
- world_recall(type, id) reads anyone's. Add field to read one field, query to filter its entries, sort "oldest" / "weight" for logs.
- Ids are lower case with _ for spaces ("old_tom"). Not sure of an id? world_search("tom") first.
- Derived fields (like who is at a location) are read like fields; they can't be written.

## Writing your record (world_remember)
- text / number / enum fields: value. Enums only take their listed values.
- ref fields: value is the other record's id; refs take a list of ids.
- list and log fields: entries (a list of text). Logs get the time added. Weighted logs take weight 1-10 (10 = never forget). link attaches every entry to a record id when the field links to a type.
- map fields (kept per target, like relationships): target is the other record's id; values sets numbers or text absolutely ({"affinity": 40}); shift moves numbers relatively ({"affinity": -5}). Numbers stay inside the field's min and max.
- Your record is created the first time you remember something.

## Refusals and what they mean
- "fixed by the world": the field is locked; nobody but the user changes it.
- "only be set when first created": set-once fields like names.
- "can only be added to": append-only; add new entries instead of changing old ones.
- "has no X. Fields: …": use one of the listed names exactly.

## The board
- world_post(message, to) posts signed as you; to is a record id or null for everyone.
- world_board(limit, query) reads the latest posts. Check it when you come back to the world.

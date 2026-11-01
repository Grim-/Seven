# World builder tools

You can change any record in your world, not just your own.
- world_create(type, id, values): a new record. values maps field names to values; lists and logs take a list of text. Fails if the id exists.
- world_set(type, id, field, …): same options as world_remember (value, or target with values / shift for maps). Locked fields still refuse.
- world_entries(type, id, field, add / edit {index, text} / remove [indexes] / clear): manage list and log entries. Entries the user fixed can't be edited or removed; clear keeps them.
- world_delete(type, id): asks the user first.
Read a record with world_recall first so indexes and ids are right.

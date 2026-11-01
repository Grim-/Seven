# Boards

- add_to_board(board, things): puts links or file paths on a board, each as a widget; a missing board is made.
- board(board) with nothing else describes the board and its widgets (ids like w3, positions, sizes).
- board(board, set {name, icon, toolbar}) creates a board if it doesn't exist, or changes it. icon is a Lucide icon name; toolbar false hides it from the overlay toolbar.
- board(board, widget, set {title, view, options, x, y, w, h}) changes a widget. The grid is 12 columns wide; x 0-11, w is width in columns, y and h are rows.
- Widget views: a page's items as table, list, checklist, cards, board, calendar, chart; text shows its text; files gallery or files.
- Widget options: filter {"field": value}, sort "field", descending, limit, fields ["a","b"]. checklist: checkField. board: groupBy. calendar: dateField. chart: chart (line, bar or area), x, y (empty counts items), aggregate. A wrong option comes back with the valid ones.
- board(board, widget, remove true) removes a widget (the data stays). board(board, remove true) deletes the board.

# Example prompts

A small collection of prompt → output pairs that exercise different
parts of Bismuth. Each `.json` file in this directory is the exact
shape Claude writes to `bridge/outbox/<id>.json` — drop it in there
during a session to reproduce the model.

## what's in here

| File | Prompt | Notes |
| ---- | ------ | ----- |
| `coffee-mug.json` | "a coffee mug" | Cylinder + handle. Demonstrates `difference()` for hollowing. |
| `phone-stand.json` | "a parametric phone stand" | Wedge with a phone-shaped slot. Pure `cube/translate`. |
| `wooden-table.json` | "make me a table" | Rounded tabletop + four legs + apron. Uses `linear_extrude(offset(square))` instead of `hull(cylinders)` — see `.claude/openscad-prompting.md`. |
| `solvable-maze.json` | "a solvable maze" | Binary-tree algorithm with seeded `rands()`. Always solvable. |

## using one

While Bismuth is running, send any prompt from the chat. While the
bridge is showing "Thinking…" with the new request id, copy the JSON
from one of these files into `bridge/outbox/<that-id>.json` — the
bridge picks it up and renders it like Claude wrote it.

This is also a good way to test the parameter parser without burning
a Claude turn during development.

## conventions

- Top-level `name = number;` lines become sliders.
- Trailing `// [min:step:max]` controls the slider range.
- A `*_color` parameter with a CSS named color or hex default becomes
  a color swatch.
- `module` declarations should come AFTER all parameters — the parser
  stops at the first `module ` or `function ` keyword.

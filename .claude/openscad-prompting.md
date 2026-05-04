# OpenSCAD prompting playbook

Patterns to follow (and traps to avoid) when generating OpenSCAD in
response to a Bismuth prompt. The goal is reliably-fast WASM
compilation and good slider UX in the parameter panel.

## fast geometry

- **Rounded boxes / slabs:** use `linear_extrude(offset(square))`, NOT
  `hull(cylinders)`. Hulls of even four cylinders at table-scale
  dimensions can churn for 10+ seconds in WASM; the offset+extrude
  pattern compiles in tens of ms.
  ```scad
  module rounded_box(w, d, h, r) {
    if (r <= 0) cube([w, d, h]);
    else
      linear_extrude(height = h)
        translate([r, r])
        offset(r = r)
        square([w - 2 * r, d - 2 * r]);
  }
  ```
- **Spheres / smooth surfaces:** keep `$fn` modest at the file level
  (24–40). Bumping it past 60 multiplies CGAL cost on every boolean.
- **Large primitives are fine.** OpenSCAD doesn't care about coordinate
  magnitude — `cube([1200, 700, 30])` compiles as fast as
  `cube([12, 7, 0.3])`. Use real-world mm.
- **Boolean depth matters.** A `difference()` of two primitives is
  cheap; nested `union/difference/intersection` six layers deep gets
  expensive fast. Flatten where possible.

## sliders the user can drag

Every top-level `name = number;` line at the start of the file becomes
an interactive parameter slider. Trailing comments control the range:

```scad
mug_height = 100;     // [40:1:200]   min:step:max
mug_radius = 35;      // [10:80]      min:max  (step defaults to 1)
wall = 3;             // [1:0.5:8]    floats are fine
finish = "satin";     // [satin, gloss, matte]   string options
```

Rules of thumb:

- **Use `snake_case` and full descriptive names** — the parser converts
  them to display labels via `_` → space + title-case. `mug_radius`
  becomes "Mug Radius"; `r` becomes "R". Names render directly in the
  UI, so spend the bytes.
- **Group related params** with a `/* [Group Name] */` comment line
  above them. The parameter panel renders one collapsible section per
  group.
- **Expose colors as parameters** with a `*_color` suffix and CSS named
  colors or hex strings as defaults — `body_color = "SteelBlue";`
  becomes a color swatch the user can click.
- **Keep params above the first `module` or `function` declaration.**
  The parser stops at those keywords (so derived values like
  `leg_height = table_height - top_thickness;` should live below the
  raw inputs but won't show as sliders since their value starts with a
  letter, which is correct).

## determinism

- **`rands(min, max, count, seed)`** is the only randomness primitive.
  Always pass an explicit seed and expose it as a parameter
  (`maze_seed = 42; // [1:1:200]`) so the user can reroll without
  retyping the prompt.
- **Seeded mazes:** the binary-tree algorithm is the simplest "always
  solvable" generator — for each non-corner cell, randomly carve north
  or east. Produces a perfect (acyclic, fully connected) maze.

## structure

Recommended top-of-file order:

1. Parameter declarations (with slider comments)
2. `$fn = resolution;` if exposed
3. Derived constants (`leg_height = ...`)
4. `module` definitions
5. Top-level `color()` / `translate()` / model calls

This keeps the parameter parser happy AND makes the file readable.

## things to avoid

- `hull()` of more than four primitives at large coordinates
- `minkowski()` — almost always slower than the alternative
- Recursive functions deeper than ~50 levels (OpenSCAD WASM stack limit)
- Untyped magic numbers buried in module bodies — promote them to
  top-level params if the user might want to tweak them

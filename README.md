# Arrow Escape 3D

A web-based arrow puzzle game with a flat 2D mode and a rotatable 3D cube mode.
Tap an arrow to slide it out the way it points. If another arrow is in its path
it bumps and you lose a heart (3 per level). Clear the board to advance.

- **2D Classic** – bendy arrows on a flat grid.
- **3D Cube** – an n×n×n block of arrows. Drag to rotate, tap to launch.
- 💡 highlights an arrow that can leave right now; ↻ restarts the level.
- Levels are generated from a seed and are always solvable. Progress is saved in the browser.

## Run

No build step and no dependencies. Open `index.html`, or serve the folder:

```
python -m http.server 8123
```

then visit <http://localhost:8123>.

## License

[MIT](LICENSE)

# Space Stim

An unofficial fan-made 3D space exploration game set in the world of Isaac Asimov's novel *Foundation*.
Walk a spaceport, board your ship, fly to orbit, jump between stars, land and explore.

## Run

    python3 -m http.server 8765

Then open http://localhost:8765 (it must be served over HTTP; opening index.html directly will not load the modules).

## Layout

- `index.html` – page, HUD and styles
- `js/main.js` – game loop, input, transitions, hyperspace, saving
- `js/ship.js` – the walkable ship and flight model
- `js/world.js` – planet surfaces (Terminus, Anacreon, Trantor, procedural outposts)
- `js/space.js` – star systems seen from space, sky, hyperspace streaks
- `js/data.js` – star chart, economy, upgrades, all dialogue
- `js/ui.js` – HUD, dialogue, market, jobs, galactic chart
- `js/audio.js` – procedural sound
- `vendor/three.module.js` – three.js r170

Progress is saved in the browser's localStorage (`rimward-save-v1`).

## Working on it together

- Clone, run the server command above, open http://localhost:8765.
- After editing a module, hard-reload (Cmd/Ctrl+Shift+R); browsers cache ES modules aggressively.
- Pushing to `main` updates the live test build on GitHub Pages within a minute or two.
- Saves live in each browser's localStorage, so every machine/URL has its own save.

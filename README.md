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

## Two-player co-op

Install Node.js 20 or later. From the repository root run:

    npm ci
    npm start

Open http://localhost:8765, choose **Host private co-op**, copy the crew invite,
and click **Begin co-op**. The other player opens the invite, chooses **Join crew**,
and clicks **Begin co-op** when the host's ship is ready. The host pilots and
controls the ramp. Both players can walk around independently and explore after
landing. The host waits for the passenger to board before taking off. Closing
the host's tab ends the room.

For another device on the same network, both players should open the server
using its LAN address (for example, http://192.168.1.10:8765). Create the invite
from that address so the other device can use it. For friends on different
networks, run this Node server on a shared host with HTTPS and WebSocket
forwarding, then open the game at that host's URL. Set `PORT` if the hosting
provider assigns a port. GitHub Pages can still serve single-player, while
co-op uses the game page served by the Node process.

The host keeps their usual browser save. Passengers have session-only cargo,
credits and discoveries, and joining leaves their single-player save intact.
Room invites are private links. Each room seats one host and one guest.

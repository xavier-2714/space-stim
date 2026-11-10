import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { WebSocket, WebSocketServer } from 'ws';

const rooms = new Map();
const relay = new WebSocketServer({ noServer: true, maxPayload: 4096 });

const server = createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  const file = path === '/' ? '/index.html' : path;
  if (!['GET', 'HEAD'].includes(req.method) ||
      !/^\/(?:index\.html|(?:js|vendor)\/[a-z0-9.-]+\.js)$/.test(file)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const content = await readFile(new URL('.' + file, import.meta.url));
    res.writeHead(200, {
      'Content-Type': file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    res.writeHead(404).end();
  }
});

server.on('upgrade', (req, socket, head) => {
  let origin;
  try { origin = new URL(req.headers.origin); } catch { /* non-browser or invalid origin */ }
  if (req.url !== '/multiplayer' || !origin || origin.host !== req.headers.host || !['http:', 'https:'].includes(origin.protocol)) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    return;
  }
  relay.handleUpgrade(req, socket, head, (ws) => relay.emit('connection', ws));
});

function send(ws, message) {
  if (ws?.readyState === WebSocket.OPEN && ws.bufferedAmount < 65536) ws.send(JSON.stringify(message));
}

relay.on('connection', (ws) => {
  let room, code, role, lastState = 0;
  const joinDeadline = setTimeout(() => ws.close(1008, 'Join deadline elapsed'), 10000);
  ws.alive = true;
  ws.on('error', () => ws.terminate());
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (data, binary) => {
    if (binary) return;
    let message;
    try { message = JSON.parse(data); } catch { return; }
    if (!message || typeof message !== 'object') return;
    if (!room) {
      if (message.type === 'host' && rooms.size < 500) {
        code = randomBytes(12).toString('hex');
        room = { host: ws, guest: null, latest: null };
        rooms.set(code, room);
        role = 'host';
      } else if (message.type === 'join' && typeof message.code === 'string') {
        const requested = rooms.get(message.code);
        if (!requested || requested.guest) {
          send(ws, { type: 'error', reason: requested ? 'Room is full.' : 'Room is closed or the invite is invalid.' });
          ws.close(1008);
          return;
        }
        code = message.code;
        room = requested;
        room.guest = ws;
        role = 'guest';
      } else {
        send(ws, { type: 'error', reason: 'Unable to open a room.' });
        ws.close(1008);
        return;
      }
      clearTimeout(joinDeadline);
      send(ws, { type: 'ready', role, code, paired: Boolean(room.guest) });
      if (role === 'guest') {
        send(room.host, { type: 'peer', connected: true });
        if (room.latest) send(ws, room.latest);
      }
      return;
    }
    const now = Date.now();
    if (message.type !== 'state' || !message.player || now - lastState < 33) return;
    lastState = now;
    const state = { type: 'state', player: message.player };
    if (role === 'host' && message.ship) {
      state.ship = message.ship;
      room.latest = state;
      send(room.guest, state);
    } else if (role === 'guest') send(room.host, state);
  });
  ws.on('close', () => {
    clearTimeout(joinDeadline);
    if (!room) return;
    if (role === 'host') {
      rooms.delete(code);
      send(room.guest, { type: 'closed' });
      room.guest?.close(1000, 'Host left');
    } else {
      room.guest = null;
      send(room.host, { type: 'peer', connected: false });
    }
  });
});

const heartbeat = setInterval(() => {
  for (const ws of relay.clients) {
    if (!ws.alive) ws.terminate();
    else { ws.alive = false; ws.ping(); }
  }
}, 15000);
heartbeat.unref();

const port = Number(process.env.PORT || 8765);
server.listen(port, () => console.log(`Space Stim multiplayer listening on port ${port}`));

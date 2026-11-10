import * as THREE from 'three';
import { Explorer } from './explorer.js';

const sendInterval = 50;
const validCode = /^[a-f0-9]{24}$/;

export class Multiplayer {
  constructor(scene, systems) {
    this.systems = systems;
    this.avatar = new Explorer(0x60778d);
    this.avatar.group.visible = false;
    scene.add(this.avatar.group);
    this.roomParam = new URL(location.href).searchParams.get('room');
    this.startButton = document.getElementById('start');
    this.status = document.getElementById('room-status');
    this.invite = document.getElementById('room-invite');
    this.hostButton = document.getElementById('host-room');
    this.joinButton = document.getElementById('join-room');
    this.badge = document.getElementById('crew-status');
    this.role = null;
    this.paired = false;
    this.remote = null;
    this.snapshot = null;
    this.lastSent = -Infinity;
    this.remoteFrame = null;
    this.remotePosition = new THREE.Vector3();
    this.offset = new THREE.Vector3();
    this.hostButton.onclick = () => this.connect('host');
    this.joinButton.onclick = () => this.connect('join');
    if (this.roomParam) {
      this.startButton.disabled = true;
      this.startButton.textContent = 'Begin co-op';
      this.hostButton.hidden = true;
      this.joinButton.hidden = false;
      this.status.textContent = 'You have a crew invite. Join to board your friend’s ship.';
    }
  }

  connect(type) {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    if (type === 'join' && !validCode.test(this.roomParam)) {
      this.status.textContent = 'This crew invite is invalid.';
      return;
    }
    this.status.textContent = 'Connecting…';
    this.startButton.disabled = this.hostButton.disabled = this.joinButton.disabled = true;
    const endpoint = new URL('/multiplayer', location.href);
    endpoint.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = this.socket = new WebSocket(endpoint);
    let error = '';
    socket.onopen = () => socket.send(JSON.stringify({ type, code: this.roomParam }));
    socket.onmessage = ({ data }) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      switch (msg.type) {
        case 'ready': {
          this.role = msg.role;
          this.paired = msg.paired;
          this.hostButton.hidden = this.joinButton.hidden = true;
          if (this.role === 'host') {
            const url = new URL(location.href);
            url.searchParams.set('room', msg.code);
            this.startButton.disabled = false;
            this.startButton.textContent = 'Begin co-op';
            this.invite.value = url.href;
            this.invite.hidden = false;
          }
          this.refreshStatus();
          break;
        }
        case 'peer':
          this.paired = msg.connected;
          if (!this.paired) this.remote = null;
          this.refreshStatus();
          break;
        case 'state':
          if (this.role === 'guest') {
            if (!this.validShip(msg.ship)) return;
            this.snapshot = msg.ship;
            this.startButton.disabled = false;
          }
          if (this.validPlayer(msg.player)) this.remote = msg.player;
          break;
        case 'error': error = msg.reason; break;
        case 'closed': error = 'The host ended the room. Reopen an invite to join again.'; break;
      }
    };
    socket.onerror = () => { error ||= 'Multiplayer server unavailable. Start the game with npm start or use your host’s server link.'; };
    socket.onclose = () => {
      this.paired = false;
      this.remote = null;
      this.avatar.group.visible = false;
      if (this.role === 'host') this.role = null;
      this.status.textContent = error || 'Disconnected. Reopen the invite to reconnect.';
      this.badge.textContent = this.status.textContent;
      this.startButton.disabled = Boolean(this.roomParam);
      this.hostButton.disabled = this.joinButton.disabled = false;
      this.hostButton.hidden = Boolean(this.roomParam);
      this.joinButton.hidden = !this.roomParam;
      this.invite.hidden = true;
    };
  }

  refreshStatus() {
    const host = this.role === 'host';
    this.status.textContent = host
      ? (this.paired ? 'Crewmate connected. You pilot the ship.' : 'Send the invite to your crewmate. You can start while they join.')
      : 'Connected as passenger. The host pilots the ship.';
    this.badge.textContent = host
      ? (this.paired ? 'CO-OP · PILOT + CREWMATE' : 'CO-OP · WAITING FOR CREWMATE')
      : 'CO-OP · PASSENGER';
  }

  validPlayer(p) {
    return p && Object.hasOwn(this.systems, p.system) && ['surface', 'space', 'hyper'].includes(p.mode)
      && ['ship', 'world'].includes(p.frame) && [p.x, p.y, p.z, p.yaw, p.speed].every(Number.isFinite);
  }

  validShip(s) {
    const vector = (value, size) => Array.isArray(value) && value.length === size && value.every(Number.isFinite);
    return s && Object.hasOwn(this.systems, s.system) && ['surface', 'space', 'hyper'].includes(s.mode)
      && vector(s.pos, 3) && vector(s.quat, 4) && vector(s.vel, 3)
      && [s.yaw, s.throttle, s.ramp, s.jump].every(Number.isFinite)
      && typeof s.landed === 'boolean';
  }

  publish(now, game) {
    if (this.socket?.readyState !== WebSocket.OPEN || this.socket.bufferedAmount > 65536 || !this.role || now - this.lastSent < sendInterval) return;
    if (this.role === 'guest' && !this.snapshot) return;
    this.lastSent = now;
    const { player: p, ship, sys, mode, hyper } = game;
    const player = { system: sys.id, mode, frame: p.frame, x: p.x, y: p.y, z: p.z,
      yaw: p.yaw, speed: p.seated ? 0 : p.speed, seated: p.seated, grounded: p.onGround };
    if (p.seated) Object.assign(player, { x: 0, y: 1.4, z: -9.6, yaw: 0 });
    const state = { type: 'state', player };
    if (this.role === 'host') state.ship = { system: sys.id, mode, pos: ship.pos.toArray(),
      quat: ship.quat.toArray(), vel: ship.vel.toArray(), yaw: ship.yaw, throttle: ship.throttle,
      landed: ship.landed, ramp: ship.ramp, jump: hyper?.t ?? 0 };
    this.socket.send(JSON.stringify(state));
  }

  renderPeer(dt, game) {
    const remote = this.remote, body = this.avatar.group;
    body.visible = Boolean(this.paired && remote && remote.system === game.sys.id && remote.mode === game.mode);
    if (!body.visible) { this.remoteFrame = null; return; }
    const frame = remote.system + ':' + remote.mode + ':' + remote.frame;
    this.offset.set(remote.x, remote.y - (remote.seated ? 0.38 : 0), remote.z);
    if (this.remoteFrame !== frame || this.remotePosition.distanceToSquared(this.offset) > 64) this.remotePosition.copy(this.offset);
    else this.remotePosition.lerp(this.offset, 1 - Math.exp(-20 * dt));
    this.remoteFrame = frame;
    body.position.copy(this.remotePosition);
    body.rotation.set(0, remote.yaw, 0);
    if (remote.frame === 'ship') {
      game.ship.group.localToWorld(body.position);
      body.quaternion.premultiply(game.ship.quat);
    }
    this.avatar.animate(dt, THREE.MathUtils.clamp(remote.speed, 0, 10), remote.grounded);
  }
}

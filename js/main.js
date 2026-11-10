import * as THREE from 'three';
import { G, clamp, lerp, smooth, moveBody } from './util.js';
import { SYS, dist } from './data.js';
import { Explorer, clipBoom } from './explorer.js';
import { parkMotorcycles, poseMotorcycle, rideMotorcycle } from './motorcycle.js';
import { Multiplayer } from './multiplayer.js';
import { Ship } from './ship.js';
import { Surface } from './world.js';
import { Backdrop, SpaceScene, Tunnel, PLANET_R } from './space.js';
import { ui, jumpRange, cargoCount, cap, jobTitle } from './ui.js';
import { audio } from './audio.js';

const SAVE_KEY = 'rimward-save-v1', R = PLANET_R;
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const V = () => new THREE.Vector3();
const _a = V(), _b = V(), _c = V(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

// ---------- save ----------
const newSave = () => ({ credits: 600, cargo: {}, up: { drive: 0, engine: 0, hold: 0 }, jobs: [], board: {}, surveyed: {}, visited: { terminus: 1 }, found: {}, sys: 'terminus', where: 'landed', shipPos: null, target: null, invert: false });
let saved = null; try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* fresh start */ }
G.save = saved && SYS[saved.sys] ? { ...newSave(), ...saved } : newSave();
function persist() {
  if (!G.started || multiplayer.role === 'guest') return;
  const s = G.save; s.sys = G.sys.id;
  s.where = G.mode === 'surface' && ship.landed ? 'landed' : 'space';
  if (s.where === 'landed') s.shipPos = { x: ship.pos.x, y: ship.pos.y, z: ship.pos.z, yaw: ship.yaw };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
}

// ---------- renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 3e6);
const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1), sun = new THREE.DirectionalLight(0xffffff, 2), amb = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(hemi, sun, amb, sun.target);
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 1, far: 290 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.normalBias = 0.035;
sun.shadow.bias = -0.00015;
const backdrop = new Backdrop(scene);
const ship = new Ship(); scene.add(ship.group);
const explorer = new Explorer(); scene.add(explorer.group);
const multiplayer = new Multiplayer(scene, SYS);
const parking = new THREE.Group();
scene.add(parking);
let motorcycles = [], mountedBike = null;
const tunnel = new Tunnel(); ship.group.add(tunnel.mesh);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const player = { frame: 'world', x: 0, y: 0, z: 0, vy: 0, onGround: true, yaw: 0, pitch: 0, seated: false, speed: 0, stepAcc: 0 };
let view = 'chase', camQ = new THREE.Quaternion(), shake = 0, charge = 0, lastEvt = 0, poiT = 0, saveT = 0, current = null;
const stick = { x: 0, y: 0 }, keys = {};
Object.assign(G, { ui, audio, ship, player, scene, camera, mode: 'surface', sys: SYS[G.save.sys], surface: null, space: null, trans: null, hyper: null, started: false });

G.changed = () => { ship.setCargo(cargoCount(), cap()); ship.engineMult = [1, 1.3, 1.65][G.save.up.engine]; ui.status(); persist(); };
G.relock = () => { if (G.started && !ui.modal && !ui.mapOpen && document.pointerLockElement !== canvas) { try { const p = canvas.requestPointerLock(); p && p.catch && p.catch(() => {}); } catch (e) { /* ignore */ } } };
G.setTarget = (id) => { G.save.target = id; persist(); if (id) { ui.toast(`Course plotted: <b>${SYS[id].name}</b><small>Leave the planet, put the nose on the marker, and hold J.</small>`); audio.sfx('ok'); } };
G.teleport = (d) => { audio.sfx('lift'); transition('#0b0e12', 0.4, () => { player.frame = 'world'; player.x = d.x; player.y = d.y; player.z = d.z; player.yaw = d.yaw; player.pitch = 0; player.vy = 0; }); };

// ---------- environment ----------
function ensureSurface() {
  if (!G.surface) {
    G.surface = new Surface(G.sys);
    scene.add(G.surface.group);
    motorcycles = parkMotorcycles(G.surface, parking, multiplayer.role === 'guest');
  }
}
function ensureSpace() { if (!G.space) { G.space = new SpaceScene(G.sys); scene.add(G.space.group); } }
let surfaceTarget = null;
function disposeSystem() { surfaceTarget = null; parking.clear(); motorcycles = []; mountedBike = null; player.riding = false; for (const k of ['surface', 'space']) if (G[k]) { scene.remove(G[k].group); G[k].dispose(); G[k] = null; } }
function setMode(m) {
  G.mode = m;
  parking.visible = m === 'surface';
  if (m !== 'surface' && mountedBike) dismountMotorcycle();
  if (G.surface) G.surface.group.visible = m === 'surface';
  if (G.space) G.space.group.visible = m === 'space';
  if (m === 'surface') {
    const e = G.surface.env; sun.castShadow = G.surface.key === 'korell'; scene.fog = new THREE.Fog(e.fog, 80, e.fogFar);
    hemi.color.set(e.zen).lerp(new THREE.Color(0xffffff), 0.55); hemi.groundColor.set(e.pal[0]).multiplyScalar(0.6); hemi.intensity = e.hemi;
    sun.color.set(e.sunCol); sun.intensity = e.sunI; sun.target.position.set(0, 0, 0); sun.position.set(...e.sun); amb.intensity = 0.22;
  } else {
    sun.castShadow = false; sun.target.position.set(0, 0, 0);
    scene.fog = null; hemi.intensity = 0; amb.intensity = m === 'space' ? 0.28 : 0.6;
    if (G.space) { sun.color.set(G.sys.star).lerp(new THREE.Color(0xffffff), 0.5); sun.intensity = 3; sun.position.copy(G.space.sunDir); }
    backdrop.set(null, 1);
  }
}
function transition(color, half, mid) { G.trans = { t: 0, half, mid, color, done: false }; }

function placeLanded(p) {
  const y = p.y ?? G.surface.ground(p.x, p.z, (G.surface.pad.y || 0) + 3);
  ship.pos.set(p.x, y, p.z); ship.setYaw(p.yaw || 0); ship.landed = true; ship.vel.set(0, 0, 0); ship.throttle = 0; ship.rampTarget = 0; ship.setRamp(0);
  ship.group.updateMatrixWorld(true);
}
function standBesideShip() {
  const w = ship.group.localToWorld(_a.set(8.5, 0, 20)); player.frame = 'world'; player.seated = false;
  player.x = w.x; player.z = w.z; player.y = G.surface.h(w.x, w.z); player.yaw = ship.yaw + 0.58; player.pitch = -0.12; player.vy = 0;
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  if (!G.started) return;
  if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (ui.mapOpen) { if (e.code === 'KeyM' || e.code === 'Escape') ui.toggleMap(false); return; }
  if (ui.modal) { if (['Tab', 'KeyH'].includes(e.code)) ui.close(); else ui.key(e.code); return; }
  keys[e.code] = true;
  if (G.hyper || G.trans) return;
  switch (e.code) {
    case 'KeyF': interact(); break;
    case 'KeyN':
      if (G.mode === 'surface' && G.surface.destinations) {
        const opts = G.surface.destinations.map(p => ({
          t: `${p.field}<small>${p.name} · ${p.detail}</small>`,
          fn: () => { surfaceTarget = p; ui.close(); ui.toast(`Surface course set: <b>${p.field}</b>`); },
        }));
        ui.open('<h2>Korell surface atlas</h2><div class="sub">Middle-earth</div><p>Choose a landing field to mark it on your HUD. Pilots can press L in flight to land at the selected field.</p>', opts);
      }
      break;
    case 'KeyM': ui.toggleMap(true); break;
    case 'Tab': ui.journal(); break;
    case 'KeyH': ui.help(); break;
    case 'KeyV': if (player.seated) { view = view === 'cockpit' ? 'chase' : 'cockpit'; camQ.copy(ship.quat); } break;
    case 'KeyI': G.save.invert = !G.save.invert; ui.toast('Pitch ' + (G.save.invert ? 'inverted' : 'normal')); break;
    case 'KeyL':
      if (player.seated && G.mode === 'surface' && !ship.landed) {
        if (ship.assist) { ship.assist = null; ui.toast('Landing assist off — you have the ship.'); }
        else { const p = surfaceTarget || G.surface.pad; ship.startAssist({ x: p.x, z: p.z, yaw: p.yaw, cruiseY: G.surface.destinations ? 1200 : undefined, y: G.surface.ground(p.x, p.z, (p.y || 0) + 3) }); ui.toast('Landing assist engaged — bringing her in to the port.', true); audio.sfx('ok'); }
      } else if (player.seated && G.mode === 'space') ui.toast('Landing assist works inside an atmosphere. Fly at the planet first.');
      break;
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('click', () => G.relock());
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas || ui.modal || ui.mapOpen) return;
  if (player.seated) { stick.x = clamp(stick.x + e.movementX / 260, -1, 1); stick.y = clamp(stick.y + e.movementY / 260, -1, 1); }
  else if (player.riding) { player.pitch = clamp(player.pitch - e.movementY * 0.0023, -0.8, 0.45); }
  else { player.yaw -= e.movementX * 0.0023; player.pitch = clamp(player.pitch - e.movementY * 0.0023, -1.5, 1.5); }
});

// ---------- interaction ----------
const shipActs = [
  { l: V().set(0, 2.3, -9.4), r: 2.3, label: () => multiplayer.role === 'guest' ? null : 'Take the pilot\'s seat', act: () => sit() },
  { l: V().set(2.9, 2.7, 6.1), r: 2.6, label: () => (multiplayer.role !== 'guest' && ship.landed ? (ship.rampTarget ? 'Lower the ramp' : 'Raise the ramp') : null), act: () => { ship.rampTarget = ship.rampTarget ? 0 : 1; audio.sfx('ramp'); } },
  { l: V().set(-2.7, 2.6, -2.6), r: 2.2, label: () => 'Consult the galactic chart', act: () => ui.toggleMap(true) },
  { l: V().set(-2.6, 2.3, -5.6), r: 2.0, label: () => 'Rest in your bunk (save)', act: () => { persist(); ui.toast('You sleep a few hours. The ship ticks and cools around you. <small>Journey saved.</small>', true); } },
];
function sit() { if (multiplayer.role === 'guest') return; player.seated = true; player.frame = 'ship'; stick.x = stick.y = 0; camQ.copy(ship.quat); audio.sfx('ok'); }
function stand() { player.seated = false; player.frame = 'ship'; player.x = 0; player.y = 1.4; player.z = -8.4; player.yaw = Math.PI; player.pitch = 0; player.vy = 0; ship.throttle = 0; ship.assist = null; if (!ship.landed) ui.toast('Drives idle. The ship will hold here.'); }
function mountMotorcycle(bike) {
  mountedBike = bike;
  Object.assign(player, { x: bike.x, y: bike.y, z: bike.z, yaw: bike.yaw, pitch: -0.18,
    riding: true, bikeSpeed: 0, bikeLean: 0, speed: 0, vy: 0, onGround: true });
  audio.sfx('ok');
}
function dismountMotorcycle() {
  Object.assign(mountedBike, { x: player.x, y: player.y, z: player.z, yaw: player.yaw });
  poseMotorcycle(mountedBike.model, mountedBike, 0);
  mountedBike = null;
  player.riding = false;
  player.speed = 0;
}
function findInteract(eye, fwd) {
  if (mountedBike) return { label: 'Park motorcycle and get off', act: dismountMotorcycle };
  let best = null, bd = 1e9;
  const test = (pos, r, label, act) => { const d = pos.distanceTo(eye); if (d > r || d >= bd || !label) return; if (d > 1.4 && _c.copy(pos).sub(eye).normalize().dot(fwd) < 0.3) return; bd = d; best = { label, act }; };
  if (player.seated) {
    if (G.mode === 'space' && G.space.station && ship.pos.distanceTo(G.space.station.position) < 800) {
      return ship.speed() < 90 ? { label: 'Request docking — ' + G.space.stationName, act: dock } : { label: null, hint: 'Slow below 90 m/s to dock' };
    }
    return { label: ship.landed ? 'Leave the seat' : 'Leave the seat (ship will hold position)', act: stand, quiet: true };
  }
  if (player.frame === 'ship') for (const s of shipActs) test(ship.group.localToWorld(_b.copy(s.l)), s.r, s.label(), s.act);
  else if (G.mode === 'surface') for (const s of G.surface.interacts) test(s.pos, s.r, s.label, s.act);
  if (player.frame === 'world' && G.mode === 'surface') {
    for (const bike of motorcycles) test(_b.set(bike.x, bike.y + 1, bike.z), 3.4, 'Ride motorcycle', () => mountMotorcycle(bike));
  }
  return best;
}
function interact() { if (current && current.act) current.act(); }
function dock() { ship.vel.set(0, 0, 0); ship.throttle = 0; ship.docked = true; audio.sfx('land'); ui.station(G.space.stationName); const iv = setInterval(() => { if (!ui.modal) { ship.docked = false; clearInterval(iv); persist(); } }, 200); }

// ---------- transitions between surface and space ----------
function toSpace() {
  audio.sfx('whoosh');
  transition('#060a14', 0.7, () => {
    ensureSpace(); setMode('space'); const d = G.space.launchDir;
    ship.pos.copy(d).multiplyScalar(R + 540); ship.quat.setFromUnitVectors(_a.set(0, 0, -1), d); ship.vel.copy(d).multiplyScalar(220); ship.throttle = 0.65; ship.assist = null; camQ.copy(ship.quat);
    ui.toast(`<b>${G.sys.name} orbit</b><small>${G.save.target ? 'Fly clear of the planet and line up on your course marker.' : 'Press M for the galactic chart.'}</small>`);
  });
}
function toSurface() {
  audio.sfx('whoosh');
  transition('#ffd2a8', 0.8, () => {
    ensureSurface(); setMode('surface'); const p = G.surface.pad;
    ship.pos.set(p.x + 700, (p.y || 0) + 2350, p.z + 5200); ship.quat.setFromEuler(_e.set(-0.17, Math.atan2(700, 5200), 0, 'YXZ'));
    ship.forward(ship.vel).multiplyScalar(150); ship.throttle = 0.75; ship.landed = false; camQ.copy(ship.quat);
    ui.toast(`<b>Entering atmosphere — ${G.sys.name}</b><small>The port is ahead. Slow down, descend with C, or press L for landing assist.</small>`);
  });
}
function onLanded() {
  audio.sfx('land'); shake = 0.5; persist();
  const ports = G.surface.destinations || [G.surface.pad];
  const atPort = ports.find(p => Math.hypot(ship.pos.x - p.x, ship.pos.z - p.z) < 60);
  const next = multiplayer.role === 'guest' ? 'Ramp lowering. You can disembark when it opens.' : 'Ramp lowering. Press F to leave your seat.';
  ui.toast(`<b>Touchdown</b> — ${G.sys.name}${atPort ? ' · ' + (atPort.field || 'spaceport') : ', open country'}<small>${next}</small>`, true);
}

// ---------- hyperspace ----------
function targetDir(out) { const t = SYS[G.save.target]; return out.set(t.x - G.sys.x, 0, t.y - G.sys.y).normalize(); }
function startJump() { G.hyper = { t: 0, stage: 0, target: SYS[G.save.target], flash: 0 }; audio.charge(false); audio.sfx('jump'); ship.throttle = 1; ui.jump(null); persist(); }
function updateHyper(dt) {
  const h = G.hyper; h.t += dt; let k = 1;
  if (h.stage === 0) {
    k = Math.min(1, h.t / 1.9); ship.vel.lerp(ship.forward(_a).multiplyScalar(1500 * k), 0.1);
    if (h.t >= 1.9) { h.stage = 1; h.flash = 1; disposeSystem(); setMode('hyper'); ship.pos.set(0, 0, 0); ship.vel.set(0, 0, 0); backdrop.stars.visible = false; backdrop.lens.visible = false; }
  } else if (h.stage === 1) {
    scene.background.setHSL(0.72 + Math.sin(h.t * 1.7) * 0.04, 0.5, 0.045 + Math.sin(h.t * 3.1) * 0.012); shake = Math.max(shake, 0.12);
    if (h.t >= 6.3) {
      h.stage = 2; h.flash = 1; const first = !G.save.visited[h.target.id];
      G.sys = h.target; G.save.visited[G.sys.id] = 1; G.save.target = null; scene.background.set(0x000000);
      backdrop.setSystem(G.sys); ensureSpace(); setMode('space');
      ship.forward(_a); ship.pos.copy(_a).multiplyScalar(-(R + 13000)).addScaledVector(ship.up(_b), 2200); ship.vel.copy(_a).multiplyScalar(200); ship.throttle = 0.3;
      audio.sfx('arrive'); h.first = first;
    }
  } else {
    k = Math.max(0, 1 - (h.t - 6.3) / 1.6);
    if (h.t >= 7.9) {
      G.hyper = null; const s = G.sys;
      ui.toast(`<b>${s.name}</b> — ${s.faction}<small>${s.desc}</small>`, false, 9000);
      if (h.first) { const c = s.lore ? 60 : 150; G.save.credits += c; ui.toast(`New system logged · chart fee <b>+${c} cr</b>`, true); audio.sfx('found'); }
      G.changed(); k = 0;
    }
  }
  h.flash = Math.max(0, h.flash - dt * 1.6); ui.fade('#eaf2ff', h.flash); tunnel.update(dt, k);
  camera.fov = 70 + 38 * k; camera.updateProjectionMatrix();
}

// The host simulates the ship. Passengers only simulate their own walking.
const networkPosition = V(), networkRotation = new THREE.Quaternion();
let passengerReady = false, previousShipSnapshot = null;
function followHost(dt) {
  const s = multiplayer.snapshot;
  if (!s) return;
  const first = !passengerReady, changedSystem = G.sys.id !== s.system;
  const changedMode = G.mode !== s.mode;
  const oldMode = G.mode;
  if (first) G.save = newSave();
  if (changedSystem) {
    disposeSystem();
    G.sys = SYS[s.system];
    G.save.visited[s.system] = 1;
    backdrop.setSystem(G.sys);
  }
  if (first || changedSystem || changedMode) {
    if (s.mode === 'surface') ensureSurface();
    else if (s.mode === 'space') ensureSpace();
    setMode(s.mode);
    backdrop.stars.visible = backdrop.lens.visible = false;
    if (G.started && !first) {
      audio.sfx(s.mode === 'hyper' ? 'jump' : oldMode === 'hyper' ? 'arrive' : 'whoosh');
      transition(s.mode === 'surface' ? '#ffd2a8' : '#080c19', 0.25, () => {});
    }
  }
  networkPosition.fromArray(s.pos);
  networkRotation.fromArray(s.quat).normalize();
  const snap = first || changedSystem || changedMode || ship.pos.distanceToSquared(networkPosition) > 640000;
  const blend = snap ? 1 : 1 - Math.exp(-23 * dt);
  ship.pos.lerp(networkPosition, blend);
  ship.quat.slerp(networkRotation, blend);
  ship.vel.fromArray(s.vel);
  ship.yaw = s.yaw;
  ship.throttle = s.throttle;
  ship.landed = s.landed;
  ship.setRamp(clamp(s.ramp, 0, 1));
  ship.updateEffects();
  ship.group.updateMatrixWorld(true);
  if (first && s.mode === 'surface' && s.landed) {
    motorcycles = parkMotorcycles(G.surface, parking, true);
    standBesideShip();
    const w = ship.group.localToWorld(_a.set(-8.5, 0, 20));
    player.x = w.x; player.z = w.z; player.y = G.surface.h(w.x, w.z); player.yaw = ship.yaw - 0.58;
  } else if (first || (player.frame === 'world' && !s.landed)) {
    if (mountedBike) dismountMotorcycle();
    Object.assign(player, { frame: 'ship', x: 0, y: 1.4, z: 3, yaw: 0, pitch: 0, vy: 0, speed: 0 });
  }
  player.seated = false;
  passengerReady = true;
  if (s !== previousShipSnapshot && previousShipSnapshot && !previousShipSnapshot.landed && s.landed && G.started) onLanded();
  previousShipSnapshot = s;
  const jump = s.jump;
  tunnel.update(dt, jump <= 0 ? 0 : jump < 1.9 ? jump / 1.9 : jump < 6.3 ? 1 : clamp(1 - (jump - 6.3) / 1.6, 0, 1));
  scene.background.set(s.mode === 'hyper' ? 0x151126 : 0x000000);
}

// ---------- per-frame ----------
function flightInput(dt) {
  const d = Math.exp(-0.8 * dt); stick.x *= d; stick.y *= d;
  const dz = (v) => (Math.abs(v) < 0.04 ? 0 : v), k = keys, inv = G.save.invert ? -1 : 1;
  const inp = {
    pitch: clamp(-dz(stick.y) * inv + (k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0), -1, 1),
    yaw: clamp(-dz(stick.x) + (k.KeyA || k.ArrowLeft ? 1 : 0) - (k.KeyD || k.ArrowRight ? 1 : 0), -1, 1),
    roll: (k.KeyQ ? 1 : 0) - (k.KeyE ? 1 : 0), thr: (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0),
    boost: !!(k.ShiftLeft || k.ShiftRight), vert: (k.Space ? 1 : 0) - (k.KeyC ? 1 : 0), stop: !!k.KeyX,
  };
  if (ship.assist && (inp.thr || inp.vert || inp.stop)) { ship.assist = null; ui.toast('Landing assist off — you have the ship.'); }
  return inp;
}
const surfEnv = { atmo: true, vmax: 190, boost: 2, ground: (x, z, y) => G.surface.ground(x, z, y), flat: (x, z, q) => G.surface.flat(x, z, q, ship.pos.y), solids: null };
const spaceEnv = { atmo: false, vmax: 330, boost: 3.2 };

function updatePlayer(dt) {
  if (mountedBike) {
    rideMotorcycle(player, keys, dt, G.surface.walkEnv());
    poseMotorcycle(mountedBike.model, player, dt);
    return;
  }
  const startX = player.x, startZ = player.z, startFrame = player.frame;
  const k = keys, look = 1.9 * dt;
  player.yaw += ((k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0)) * look; player.pitch = clamp(player.pitch + ((k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0)) * look, -1.5, 1.5);
  const f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0), s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), inShip = player.frame === 'ship';
  const sp = (inShip ? 3.6 : k.ShiftLeft || k.ShiftRight ? 9 : 4.6) * (f && s ? 0.707 : 1) * dt, sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  const dx = (-sy * f + cy * s) * sp, dz = (-cy * f - sy * s) * sp;
  if (k.Space && player.onGround && !inShip) { player.vy = 6.5; }
  if (inShip) {
    moveBody(player, dx, dz, dt, ship.walkEnv());
    if (ship.landed && G.mode === 'surface' && (Math.abs(player.x) > 11.2 || player.z > 15.6 || player.z < -17.6)) {
      const w = ship.group.localToWorld(_a.set(player.x, player.y, player.z)); player.frame = 'world'; player.x = w.x; player.y = w.y; player.z = w.z; player.yaw += ship.yaw;
    }
    if (player.y < -30) { player.x = 0; player.y = 1.4; player.z = 2; player.vy = 0; }
  } else {
    moveBody(player, dx, dz, dt, G.surface.walkEnv());
    player.x = clamp(player.x, -7600, 7600); player.z = clamp(player.z, -7600, 7600);
    if (ship.landed) {
      const l = ship.group.worldToLocal(_a.set(player.x, player.y, player.z));
      if (Math.abs(l.x) < 10.6 && l.z > -17 && l.z < 15 && l.y > -2 && l.y < 8) { player.frame = 'ship'; player.x = l.x; player.y = Math.max(0, l.y); player.z = l.z; player.yaw -= ship.yaw; }
    }
  }
  player.speed = startFrame === player.frame ? Math.hypot(player.x - startX, player.z - startZ) / Math.max(dt, 0.001) : 0;
  if (player.onGround && (dx || dz)) { player.stepAcc += Math.hypot(dx, dz); if (player.stepAcc > 2.1) { player.stepAcc = 0; audio.sfx('step'); } }
}
const eye = V(), fwd = V(), pivot = V(), desired = V(), sample = V();
function walkCamera(dt) {
  const inShip = player.frame === 'ship';
  const yaw = player.yaw, pitch = clamp(player.pitch, -0.95, 0.66);
  const body = explorer.group;
  body.position.set(player.x, player.y - (player.riding ? 0.05 : 0), player.z);
  body.quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
  if (inShip) {
    ship.group.localToWorld(body.position);
    body.quaternion.premultiply(ship.quat);
  }
  explorer.animate(dt, player.speed, player.onGround, player.riding);

  camera.quaternion.setFromEuler(_e.set(pitch, yaw, 0, 'YXZ'));
  pivot.set(player.x, player.y + 1.48, player.z);
  desired.set(inShip ? 0.48 : 0.88, 0, inShip ? 1.65 : player.riding ? 5.3 : 4.4)
    .applyQuaternion(camera.quaternion).add(pivot);
  let clear = 1;
  if (inShip) {
    clear = clipBoom(pivot, desired, ship.solids);
    camera.quaternion.premultiply(ship.quat);
    ship.group.localToWorld(pivot);
    ship.group.localToWorld(desired);
  } else {
    const surface = G.surface;
    clear = clipBoom(pivot, desired, surface.solids);
    if (ship.landed) {
      clear = clipBoom(ship.group.worldToLocal(_a.copy(pivot)), ship.group.worldToLocal(_b.copy(desired)), ship.solids, clear);
    }
    // Underground interiors use their walls and ceilings as the camera bounds.
    const terrain = surface.walkEnv().terrain;
    if (pivot.y >= terrain(pivot.x, pivot.z)) {
      for (let t = 0.05; t <= clear; t += 0.05) {
        sample.copy(pivot).lerp(desired, t);
        if (sample.y < terrain(sample.x, sample.z) + 0.15) { clear = t - 0.05; break; }
      }
    }
  }
  camera.position.copy(pivot).lerp(desired, clear);
  body.visible = camera.position.distanceToSquared(pivot) > 0.25;
  // Reach and interaction direction originate with the character.
  eye.copy(pivot).addScaledVector(_a.set(0, 1, 0).applyQuaternion(body.quaternion), 0.14);
}
function updateCamera(dt) {
  explorer.group.visible = !player.seated;
  if (player.seated) {
    if (view === 'cockpit') { camera.position.copy(ship.group.localToWorld(_a.copy(ship.seatEye))); camera.quaternion.copy(ship.quat); }
    else {
      camQ.slerp(ship.quat, 1 - Math.exp(-5 * dt)); camera.quaternion.copy(camQ);
      camera.position.copy(ship.pos).addScaledVector(ship.up(_a), 2.7).add(_b.set(0, 7, 40).applyQuaternion(camQ));
      if (G.mode === 'surface') { const g = G.surface.ground(camera.position.x, camera.position.z, camera.position.y + 50); if (camera.position.y < g + 1.5) camera.position.y = g + 1.5; }
    }
    eye.copy(camera.position);
  } else walkCamera(dt);
  fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
  if (shake > 0.001) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; camera.position.z += (Math.random() - 0.5) * shake; shake *= Math.exp(-4 * dt); }
}
const W2 = V();
function marker(list, pos, label, sub, color) {
  W2.copy(pos).project(camera); const w = innerWidth, h = innerHeight, behind = W2.z > 1;
  let x = (W2.x * 0.5 + 0.5) * w, y = (-W2.y * 0.5 + 0.5) * h, off = false;
  if (behind) { x = w - x; y = h - y; }
  if (behind || x < 60 || x > w - 60 || y < 70 || y > h - 150) {
    let dx = x - w / 2, dy = y - h / 2; if (behind && Math.hypot(dx, dy) < 1) dy = 1; const s = Math.min((w / 2 - 70) / Math.max(1, Math.abs(dx)), (dy > 0 ? h / 2 - 160 : h / 2 - 80) / Math.max(1, Math.abs(dy)));
    x = w / 2 + dx * s; y = h / 2 + dy * s; off = true;
  }
  list.push({ x, y, label, sub, color, off });
}
const km = (d) => (d >= 10000 ? (d / 1000).toFixed(0) + ' km' : d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m');

function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - (tick.last || now)) / 1000); tick.last = now;
  const passenger = multiplayer.role === 'guest';
  if (passenger) followHost(dt);
  if (!G.started) {
    multiplayer.publish(now, G);
    updateCamera(dt);
    multiplayer.renderPeer(dt, G);
    renderer.render(scene, camera);
    return;
  }
  const blocked = !!(ui.modal || ui.mapOpen);
  if (G.trans) { const T = G.trans; T.t += dt; if (!T.done && T.t >= T.half) { T.done = true; T.mid(); } const op = T.t < T.half ? T.t / T.half : 1 - (T.t - T.half - 0.15) / (T.half * 1.4); ui.fade(T.color, clamp(op, 0, 1)); if (op <= 0) G.trans = null; }
  if (G.hyper) updateHyper(dt);

  // --- ship ---
  let inp = null; const flying = !passenger && player.seated && !blocked && !G.hyper && !(G.trans && !G.trans.done);
  if (flying) {
    inp = flightInput(dt);
    if (ship.landed && inp.vert > 0 && G.mode === 'surface') {
      if (multiplayer.paired && (multiplayer.remote?.frame !== 'ship' || multiplayer.remote.z >= 6.5)) {
        inp.vert = 0;
        if (now - lastEvt > 1800) { lastEvt = now; ui.toast('Wait for your crewmate to board before takeoff.'); }
      } else {
        ship.liftOff(); audio.sfx('ramp');
        ui.toast('Lifting off. <small>W for throttle · point the nose up and climb to leave the atmosphere.</small>');
      }
    }
  }
  let env = spaceEnv; if (G.mode === 'surface') { surfEnv.solids = G.surface.solids; env = surfEnv; }
  const ev = passenger ? null : ship.update(dt, G.hyper ? null : inp, env);
  if (ev === 'land') onLanded();
  else if (ev && now - lastEvt > 700) { lastEvt = now; if (ev === 'uneven') ui.toast('Ground too uneven to set down here.'); else { shake = 0.8; audio.sfx('bump'); } }
  ship.group.updateMatrixWorld(true);
  if (!player.seated && !blocked && !G.trans) updatePlayer(dt);
  updateCamera(dt);
  multiplayer.publish(now, G);
  multiplayer.renderPeer(dt, G);
  if (sun.castShadow) {
    const shadowX = Math.round(eye.x * 4) / 4, shadowZ = Math.round(eye.z * 4) / 4;
    sun.target.position.set(shadowX, G.surface.h(shadowX, shadowZ), shadowZ);
    sun.position.set(...G.surface.env.sun).multiplyScalar(155).add(sun.target.position);
  }

  // --- world ---
  const marks = []; let hint = '', fl = null, jumpText = null, surfaceRegion = '';
  if (G.mode === 'surface') {
    const S = G.surface, e = S.env; S.update(dt, eye);
    if (S.destinations) {
      let closest = Infinity;
      for (const region of S.destinations) {
        const distance = Math.hypot(eye.x - region.x, eye.z - region.z);
        if (distance < closest) { closest = distance; surfaceRegion = region.name; }
      }
      if (surfaceTarget && !player.seated) {
        const distance = Math.hypot(eye.x - surfaceTarget.x, eye.z - surfaceTarget.z);
        if (distance > 42) marker(marks, _a.set(surfaceTarget.x, surfaceTarget.y + 7, surfaceTarget.z), surfaceTarget.field, km(distance), '#f0c070');
      }
    }
    const alt = smooth(500, 2600, eye.y - (S.pad.y || 0)); backdrop.set(e, alt); scene.fog.far = e.fogFar * (1 + alt * 3); scene.fog.color.set(e.fog).multiplyScalar(1 - alt * 0.85);
    hemi.intensity = e.hemi * (1 - alt * 0.6);
    if (!passenger && !ship.landed && ship.pos.y - (S.pad.y || 0) > 2600 && !G.trans) toSpace();
    if (!player.seated) {
      if ((poiT += dt) > 0.4) { poiT = 0; for (const p of S.pois) if (!G.save.found[p.id] && Math.hypot(eye.x - p.x, eye.z - p.z) < p.r && (p.y === null || Math.abs(eye.y - 1.6 - p.y) < 8)) { G.save.found[p.id] = 1; G.save.credits += p.reward; G.changed(); audio.sfx('found'); ui.toast(`Discovered: <b>${p.name}</b> · +${p.reward} cr<small>${p.text}</small>`, true, 8000); } }
      if (!mountedBike && player.frame === 'world') for (const bike of motorcycles) {
        const distance = Math.hypot(eye.x - bike.x, eye.z - bike.z);
        if (distance > 4 && distance < 80) marker(marks, _a.set(bike.x, bike.y + 1.7, bike.z), 'Motorcycle', km(distance), '#efbc8a');
      }
      const ds = Math.hypot(eye.x - ship.pos.x, eye.z - ship.pos.z); if (ds > 60 && eye.y > -20 && eye.y < 300) marker(marks, _a.copy(ship.pos).setY(ship.pos.y + 9), 'Your ship', km(ds), '#5fd8c8');
      if (player.frame === 'world' && ds < 40 && !G.save.found[G.sys.id + ':boarded']) hint = passenger ? 'Walk up the rear ramp to board your friend’s ship' : 'Walk up the ramp at the rear of your ship and take the pilot\'s seat';
    } else {
      G.save.found[G.sys.id + ':boarded'] = 1;
      const p = surfaceTarget || S.pad, dp = Math.hypot(ship.pos.x - p.x, ship.pos.z - p.z);
      if (!ship.landed && dp > 80) marker(marks, _a.set(p.x, (p.y || 0) + 10, p.z), p.field || 'Spaceport', km(dp), '#f0c070');
      hint = ship.landed ? '<kbd>Space</kbd>lift off &nbsp; <kbd>F</kbd>leave seat &nbsp; <kbd>M</kbd>chart' : ship.assist ? 'Landing assist flying — touch <kbd>W</kbd> or <kbd>S</kbd> to take over' : (ship.alt < 60 ? '<kbd>C</kbd>descend gently to land &nbsp; <kbd>Space</kbd>rise' : ship.pos.y > 1200 ? 'Keep climbing to reach orbit' : '<kbd>L</kbd>landing assist &nbsp; <kbd>V</kbd>view');
      fl = { spd: ship.speed(), thr: ship.throttle, alt: fmt(Math.max(0, ship.alt ?? 0)) + ' m', altl: 'ALTITUDE', mode: ship.landed ? 'LANDED' : ship.assist ? 'ASSIST' : ship.speed() < 2 ? 'HOVER' : 'FLIGHT' };
    }
  } else if (G.mode === 'space') {
    const S = G.space; S.update(dt); backdrop.set(null, 1);
    const d = ship.pos.length();
    if (!passenger && d < R + 320 && !G.trans && !G.hyper) toSurface();
    for (const b of S.bodies) { const bd = ship.pos.distanceTo(b.pos); if (!passenger && bd < b.r + 25) { _a.copy(ship.pos).sub(b.pos).normalize(); ship.pos.copy(b.pos).addScaledVector(_a, b.r + 25); ship.vel.reflect(_a).multiplyScalar(0.3); ship.throttle = 0; shake = 1; audio.sfx('bump'); } else if (bd < 60000) marker(marks, b.pos, b.name, km(bd - b.r), '#9aa4a8'); }
    if (S.station) { const sd = ship.pos.distanceTo(S.station.position); if (!passenger && sd < 235) { _a.copy(ship.pos).sub(S.station.position).normalize(); ship.pos.copy(S.station.position).addScaledVector(_a, 235); ship.vel.multiplyScalar(0.3); } marker(marks, S.station.position, S.stationName, km(sd), '#5fd8c8'); }
    marker(marks, _a.set(0, 0, 0), G.sys.name, km(d - R) + ' · fly in to land', '#f0c070');
    for (const j of G.save.jobs) if (j.type === 'survey' && j.to === G.sys.id && d < R + 9000) { G.save.jobs = G.save.jobs.filter((x) => x !== j); G.save.surveyed[G.sys.id] = 1; G.save.credits += j.reward; G.changed(); audio.sfx('coin'); ui.toast(`Survey complete: <b>${G.sys.name}</b> · +${fmt(j.reward)} cr<small>Scanner record sealed and credited.</small>`, true, 7000); }
    if (player.seated && !G.hyper) {
      fl = { spd: ship.speed(), thr: ship.throttle, alt: km(d - R), altl: G.sys.name.toUpperCase(), mode: ship.docked ? 'DOCKED' : 'SPACE' };
      const t = G.save.target && SYS[G.save.target];
      if (t && dist(t, G.sys) <= jumpRange()) {
        targetDir(_b); marker(marks, _a.copy(camera.position).addScaledVector(_b, 1e6), '◇ ' + t.name, 'jump course', '#ffffff');
        const ang = ship.forward(_c).angleTo(_b) * 57.3, clear = d - (R + 2500); let ok = false, st;
        if (clear < 0) st = `Too close to ${G.sys.name}'s mass — fly ${km(-clear)} further out`; else if (ang > 7) st = `Align with the course marker — ${ang.toFixed(0)}° off`; else { ok = true; st = charge > 0 ? 'Charging hyperdrive…' : 'Aligned — hold <b>J</b> to charge'; }
        if (ok && keys.KeyJ && !blocked) { if (charge === 0) audio.charge(true); charge += dt / 3; if (charge >= 1) { charge = 0; startJump(); } }
        else { if (charge > 0) audio.charge(false); charge = 0; }
        if (!G.hyper) jumpText = `Course: ${t.name} · ${fmt(dist(t, G.sys))} pc<br>${st}`;
      } else { hint = '<kbd>M</kbd>open the galactic chart and plot a course'; if (charge > 0) { audio.charge(false); charge = 0; } }
    }
  }
  backdrop.follow(camera);
  if (!G.hyper && camera.fov !== 70) { camera.fov = 70; camera.updateProjectionMatrix(); }

  // --- HUD ---
  current = blocked || G.hyper || G.trans ? null : findInteract(eye, fwd);
  ui.prompt(current && current.label && !current.quiet ? current.label : null);
  if (current && current.hint) hint = current.hint;
  if (mountedBike) hint = '<kbd>W</kbd>throttle · <kbd>A/D</kbd>steer · <kbd>Space</kbd>brake · <kbd>Shift</kbd>boost · ' + fmt(Math.abs(player.bikeSpeed) * 3.6) + ' km/h';
  if (surfaceRegion) hint += ' &nbsp; <kbd>N</kbd>surface atlas';
  ui.hint(G.hyper ? '' : hint); ui.markers(G.hyper || blocked ? [] : marks);
  if (fl) fl.stick = document.pointerLockElement === canvas ? [stick.x, stick.y] : null;
  ui.flight(G.hyper ? null : fl); ui.jump(jumpText, charge);
  const h = G.sys.hand;
  ui.loc(G.mode === 'hyper' ? 'Hyperspace' : G.sys.name, G.mode === 'hyper' ? 'between the stars' : G.mode === 'surface' ? (h === 'terminus' ? 'Terminus City' : h === 'anacreon' ? 'Royal capital' : h === 'trantor' ? (eye.y < -20 ? 'The Concourse · sub-level' : eye.y > 300 ? 'Observation Tower' : 'Sector Dock 12') : h === 'korell' ? 'Middle-earth · ' + surfaceRegion : 'Landing field') : 'In orbit');
  ui.status();
  // --- audio ---
  const inAir = !ship.landed && !ship.docked, thr = player.seated || inAir ? clamp(Math.abs(ship.throttle) + (inp ? Math.abs(inp.vert) * 0.4 : 0) + (G.hyper ? 1 : 0), 0.06, 1.4) : 0;
  const hall = G.mode === 'surface' && h === 'trantor' && eye.y < -20;
  audio.mix(player.seated || inAir ? thr : 0, inp && inp.boost ? 1 : 0, G.mode !== 'surface' ? 0.04 : hall ? 0.8 : player.seated ? 0.3 + Math.min(0.6, ship.speed() / 200) : player.frame === 'ship' ? 0.3 : 0.9, hall ? 1100 : 420);
  if ((saveT += dt) > 15 && !G.hyper && !G.trans) { saveT = 0; persist(); }
  renderer.render(scene, camera);
}

// ---------- boot ----------
function boot() {
  ui.init(); backdrop.setSystem(G.sys);
  const s = G.save;
  if (s.where === 'landed') { ensureSurface(); setMode('surface'); placeLanded(s.shipPos || G.surface.pad); standBesideShip(); }
  else { ensureSpace(); setMode('space'); const d = G.space.launchDir; ship.landed = false; ship.setRamp(1); ship.rampTarget = 1; ship.pos.copy(d).multiplyScalar(R + 3000); ship.quat.setFromUnitVectors(_a.set(0, 0, -1), d); sit(); }
  G.changed(); updateCamera(0.016);
  if (saved && !multiplayer.roomParam) { $('reset').style.display = 'inline-block'; $('start').textContent = 'Continue'; }
  $('reset').onclick = () => { if (confirm('Erase your saved journey and start again on Terminus?')) { localStorage.removeItem(SAVE_KEY); location.reload(); } };
  $('start').onclick = () => {
    if (multiplayer.roomParam && !passengerReady) return;
    audio.init(); G.started = true; $('title').style.display = 'none'; G.relock();
    if (multiplayer.role === 'guest') ui.toast('You joined as passenger. Your friend pilots the ship.');
    else if (!saved) { ui.toast('<b>Terminus City Spaceport, Bay 3</b><small>Your ship is in front of you. Press H at any time for the controls.</small>', false, 9000); }
    else ui.toast(`<b>${G.sys.name}</b><small>Welcome back, spacer.</small>`);
  };
  addEventListener('beforeunload', () => { if (G.started && !G.hyper) persist(); });
  requestAnimationFrame(tick);
}
window.G = G; G.dbg = { sit, stand, toSpace, toSurface, keys, startJump, persist };
boot();

import * as THREE from 'three';
import { Batch, MAT, clamp, lerp } from './util.js';

const HULL = 0xd8d0bc, STRIPE = 0xc4532a, DARK = 0x33363b, FLOOR = 0x4d5157, PANEL = 0x7d8a84, BRASS = 0xb08d4a, SEAT = 0x7a3b2a;
const RAMP_LEN = 6.3, RAMP_A = Math.asin(1.4 / RAMP_LEN);
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _f = new THREE.Vector3(), _u = new THREE.Vector3();

export class Ship {
  constructor() {
    this.group = new THREE.Group();
    this.pos = this.group.position; this.quat = this.group.quaternion;
    this.vel = new THREE.Vector3(); this.av = new THREE.Vector3();
    this.throttle = 0; this.landed = true; this.yaw = 0;
    this.ramp = 0; this.rampTarget = 0;          // 0 = down/open, 1 = stowed/closed
    this.solids = []; this.rampSurf = { x0: -2, x1: 2, z0: 7, z1: 7 + RAMP_LEN * Math.cos(RAMP_A), yA: 1.4, yB: 0, ax: 'z' };
    this.seatEye = new THREE.Vector3(0, 2.86, -9.5);
    this.assist = null; this.settle = 0; this.engineMult = 1; this.docked = false;
    this.build();
  }

  build() {
    const B = { solid: new Batch(), glow: new Batch(), glass: new Batch() };
    const bx = (x0, x1, y0, y1, z0, z1, col, o = {}) => {
      B[o.k || 'solid'].box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, col);
      if (o.c !== 0 && !o.k) { const s = { x0, x1, z0, z1, y0, y1, nb: o.nb }; this.solids.push(s); return s; }
    };
    const col = (x0, x1, y0, y1, z0, z1) => { const s = { x0, x1, z0, z1, y0, y1 }; this.solids.push(s); return s; };
    // floors, belly, ceilings
    bx(-3.5, 3.5, 1.0, 1.4, -7, 7, FLOOR); bx(-2.2, 2.2, 1.0, 1.4, -11.5, -7, FLOOR);
    bx(-2.8, 2.8, 0.55, 1.0, -9.5, 6.5, DARK, { c: 0 });
    bx(-3.5, 3.5, 4.0, 4.4, -7, 7, HULL, { nb: 1 }); bx(-2.2, 2.2, 3.8, 4.1, -11.5, -7, HULL, { nb: 1 });
    // hull sides
    bx(-3.5, -3.2, 1.4, 4.0, -7, 7, HULL); bx(3.2, 3.5, 1.4, 4.0, -7, 7, HULL);
    bx(-3.56, -3.5, 2.2, 2.7, -7, 7, STRIPE, { c: 0 }); bx(3.5, 3.56, 2.2, 2.7, -7, 7, STRIPE, { c: 0 });
    // rear frame
    bx(-3.5, -2, 1.4, 4.0, 6.7, 7, HULL); bx(2, 3.5, 1.4, 4.0, 6.7, 7, HULL); bx(-2, 2, 3.7, 4.0, 6.7, 7, STRIPE, { c: 0 });
    bx(-4.2, -3.5, 1.2, 4.2, 5.4, 7.05, HULL, { c: 0 }); bx(3.5, 4.2, 1.2, 4.2, 5.4, 7.05, HULL, { c: 0 });
    // bulkheads
    for (const z of [-1, -7]) {
      bx(-3.2, -0.75, 1.4, 4.0, z - 0.12, z + 0.12, PANEL); bx(0.75, 3.2, 1.4, 4.0, z - 0.12, z + 0.12, PANEL);
      bx(-0.75, 0.75, 3.55, 4.0, z - 0.12, z + 0.12, BRASS, { c: 0 });
    }
    bx(-3.5, -2.2, 1.4, 4.0, -7.3, -7, HULL, { c: 0 }); bx(2.2, 3.5, 1.4, 4.0, -7.3, -7, HULL, { c: 0 });
    // cockpit: low walls, glass, pillars
    bx(-2.2, -1.95, 1.4, 2.05, -11.5, -7, HULL, { c: 0 }); bx(1.95, 2.2, 1.4, 2.05, -11.5, -7, HULL, { c: 0 });
    bx(-2.2, 2.2, 1.4, 2.05, -11.5, -11.25, HULL, { c: 0 });
    col(-2.2, -1.95, 1.4, 3.8, -11.5, -7); col(1.95, 2.2, 1.4, 3.8, -11.5, -7); col(-2.2, 2.2, 1.4, 3.8, -11.5, -11.25);
    bx(-2.15, -2.05, 2.05, 3.8, -11.4, -7, 0, { k: 'glass' }); bx(2.05, 2.15, 2.05, 3.8, -11.4, -7, 0, { k: 'glass' });
    bx(-2.1, 2.1, 2.05, 3.8, -11.45, -11.35, 0, { k: 'glass' });
    for (const [x, z] of [[-2.08, -11.38], [2.08, -11.38], [-2.08, -9.2], [2.08, -9.2]])
      bx(x - 0.07, x + 0.07, 2.05, 3.8, z - 0.07, z + 0.07, BRASS, { c: 0 });
    // console + seats
    bx(-1.7, 1.7, 1.4, 1.9, -11.25, -10.5, DARK);
    for (let i = 0; i < 4; i++) { bx(-1.5 + i * 0.3, -1.28 + i * 0.3, 1.9, 1.93, -11.05, -10.8, i % 2 ? 0xffb347 : 0xd98a2a, { k: 'glow' }); bx(0.42 + i * 0.3, 0.64 + i * 0.3, 1.9, 1.93, -11.05, -10.8, i % 2 ? 0x4fd6c8 : 0x2f9a90, { k: 'glow' }); }
    bx(-0.1, 0.1, 1.9, 1.94, -10.95, -10.8, 0xff5a3c, { k: 'glow' });
    for (const x of [0, 1.25]) {
      bx(x - 0.33, x + 0.33, 1.4, 1.88, -9.95, -9.25, SEAT, { c: 0 }); bx(x - 0.33, x + 0.33, 1.88, 2.95, -9.3, -9.15, SEAT, { c: 0 });
    }
    bx(-0.05, 0.05, 1.4, 2.05, -10.45, -10.35, BRASS, { c: 0 }); bx(-0.25, 0.25, 2.02, 2.1, -10.45, -10.35, DARK, { c: 0 });
    // cabin: bunks, table, chart console, locker
    bx(-3.2, -2.2, 1.4, 1.95, -6.7, -4.5, PANEL); bx(-3.2, -2.25, 1.95, 2.08, -6.65, -4.55, 0x9a4a3a, { c: 0 });
    bx(-3.2, -2.2, 2.95, 3.08, -6.7, -4.5, PANEL, { c: 0 }); bx(-3.2, -2.25, 3.08, 3.2, -6.65, -4.55, 0x3f5f7a, { c: 0 });
    bx(1.7, 3.2, 2.1, 2.2, -5.6, -3.9, BRASS, { c: 0 }); bx(2.3, 2.6, 1.4, 2.1, -4.9, -4.6, DARK, { c: 0 }); col(1.7, 3.2, 1.4, 2.2, -5.6, -3.9);
    bx(1.1, 1.5, 1.4, 1.85, -5.0, -4.5, SEAT, { c: 0 });
    bx(-3.2, -2.6, 1.4, 2.5, -3.7, -1.5, DARK); bx(-2.62, -2.58, 2.55, 3.4, -3.5, -1.7, 0x4fd6c8, { k: 'glow' });
    bx(-2.8, -2.6, 2.5, 2.56, -3.6, -1.6, 0xffb347, { k: 'glow' });
    bx(2.6, 3.2, 1.4, 3.8, -3.2, -1.3, 0x5f6b66);
    bx(-0.5, 0.5, 3.96, 4.0, -5, -3, 0xfff1cf, { k: 'glow' }); bx(-0.5, 0.5, 3.96, 4.0, 1.5, 4.5, 0xfff1cf, { k: 'glow' });
    // cargo racks
    bx(-3.2, -2.05, 1.4, 1.5, -0.6, 5.2, DARK, { c: 0 }); bx(2.05, 3.2, 1.4, 1.5, -0.6, 5.2, DARK, { c: 0 });
    col(-3.2, -2.05, 1.4, 3.6, -0.6, 5.2); col(2.05, 3.2, 1.4, 3.6, -0.6, 5.2);
    for (const z of [-0.6, 2.3, 5.2]) for (const x of [-2.1, 2.1]) bx(x - 0.05, x + 0.05, 1.4, 3.9, z - 0.05, z + 0.05, BRASS, { c: 0 });
    bx(2.9, 3.2, 2.5, 3.0, 5.9, 6.4, 0x4fd6c8, { k: 'glow' });
    // exterior: nose, hump, fin, nacelles, wings, gear
    B.solid.geo(new THREE.CylinderGeometry(0.2, 2.6, 5.2, 4, 1), 0, 1.5, -14.05, HULL, { rx: -Math.PI / 2, sz: 0.32 });
    bx(-1.5, 1.5, 4.4, 4.95, -5.5, 5.5, HULL, { c: 0 }); bx(-1.0, 1.0, 4.95, 5.2, -3, 4, STRIPE, { c: 0 });
    bx(-0.14, 0.14, 4.4, 7.6, 2.5, 7.4, STRIPE, { c: 0 }); bx(-0.16, 0.16, 7.0, 7.6, 1.6, 7.6, HULL, { c: 0 });
    const cyl = new THREE.CylinderGeometry(1.25, 1.25, 9.2, 14), cone = new THREE.ConeGeometry(1.25, 2.4, 14), noz = new THREE.CylinderGeometry(1.0, 1.35, 0.9, 14);
    for (const sx of [-1, 1]) {
      B.solid.geo(cyl, sx * 4.75, 2.7, 3.6, HULL, { rx: Math.PI / 2 });
      B.solid.geo(cone, sx * 4.75, 2.7, -2.2, STRIPE, { rx: -Math.PI / 2 });
      B.solid.geo(noz, sx * 4.75, 2.7, 8.6, DARK, { rx: Math.PI / 2 });
      col(sx > 0 ? 3.5 : -6, sx > 0 ? 6 : -3.5, 1.4, 4.0, -3.4, 9);
      bx(sx > 0 ? 5.9 : -9.6, sx > 0 ? 9.6 : -5.9, 2.5, 2.72, 1.5, 7.2, HULL, { c: 0 });
      bx(sx > 0 ? 9.6 : -9.9, sx > 0 ? 9.9 : -9.6, 2.2, 3.4, 2.5, 7.8, STRIPE, { c: 0 });
      for (const [gx, gz] of [[2.6, -8.3], [2.9, 4.6]]) {
        B.solid.geo(new THREE.CylinderGeometry(0.16, 0.2, 1.05, 8), sx * gx, 0.52, gz, BRASS);
        bx(sx * gx - 0.45, sx * gx + 0.45, 0, 0.1, gz - 0.45, gz + 0.45, DARK, { c: 0 });
      }
    }
    this.group.add(B.solid.mesh(MAT.solid), B.glow.mesh(MAT.glow), B.glass.mesh(MAT.glass));
    // engine glow
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0xff9a4a });
    this.plumeMat = new THREE.MeshBasicMaterial({ color: 0xa8d4ff, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false });
    this.plumes = [];
    for (const sx of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.95, 16), this.glowMat); d.position.set(sx * 4.75, 2.7, 9.06); this.group.add(d);
      const p = new THREE.Mesh(new THREE.ConeGeometry(0.75, 7, 12, 1, true), this.plumeMat); p.rotation.x = Math.PI / 2; p.position.set(sx * 4.75, 2.7, 12.5); this.group.add(p); this.plumes.push(p);
    }
    // ramp + doors (animated)
    const dark = new THREE.MeshLambertMaterial({ color: DARK }), hull = new THREE.MeshLambertMaterial({ color: HULL });
    this.rampPivot = new THREE.Group(); this.rampPivot.position.set(0, 1.39, 7);
    const rg = new THREE.BoxGeometry(4, 0.16, RAMP_LEN); rg.translate(0, -0.08, RAMP_LEN / 2);
    this.rampPivot.add(new THREE.Mesh(rg, dark)); this.group.add(this.rampPivot);
    this.doors = [-1, 1].map((s) => { const d = new THREE.Mesh(new THREE.BoxGeometry(2, 2.3, 0.12), hull); d.position.set(s, 2.55, 6.85); this.group.add(d); return d; });
    this.doorSolid = col(-2, 2, 1.4, 3.7, 6.7, 7.0); this.doorSolid.off = true;
    // crates
    this.crates = [];
    const cg = new THREE.BoxGeometry(1, 0.95, 1.05);
    for (let lvl = 0; lvl < 2; lvl++) for (const x of [-2.62, 2.62]) for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ color: [0x8a6a3a, 0x5a6f7a, 0x7a5a4a, 0x66704a][(i + lvl) % 4] }));
      m.position.set(x, 1.98 + lvl * 0.97, 0.2 + i * 1.25); m.visible = false; this.group.add(m); this.crates.push(m);
    }
    // interior lights
    for (const [z, c, i] of [[2.5, 0xfff0d8, 14], [-4, 0xfff0d8, 12], [-9.6, 0xffc890, 5]]) {
      const l = new THREE.PointLight(c, i, 14, 1.6); l.position.set(0, 3.5, z); this.group.add(l);
    }
    this.setRamp(0);
  }

  setCargo(n, cap) { this.crates.forEach((c, i) => (c.visible = i < Math.ceil(n / Math.max(1, cap) * 16))); }

  setRamp(t) {
    this.ramp = t;
    this.rampPivot.rotation.x = RAMP_A * (1 - Math.min(1, t * 2));
    this.rampPivot.position.z = 7 - (RAMP_LEN + 0.1) * Math.max(0, t * 2 - 1);
    const d = clamp(t * 2 - 0.6, 0, 1);
    this.doors[0].position.x = -3 + 2 * d; this.doors[1].position.x = 3 - 2 * d;
    this.doorSolid.off = t < 0.5;
  }
  walkEnv() {
    return { solids: this.solids, ramps: this.ramp < 0.02 ? [this.rampSurf] : [], terrain: this.landed ? () => 0 : null };
  }
  forward(out) { return out.set(0, 0, -1).applyQuaternion(this.quat); }
  up(out) { return out.set(0, 1, 0).applyQuaternion(this.quat); }
  speed() { return this.vel.length(); }
  setYaw(y) { this.yaw = y; this.quat.setFromEuler(_e.set(0, y, 0)); }

  land(groundY) {
    this.landed = true; this.vel.set(0, 0, 0); this.throttle = 0; this.av.set(0, 0, 0); this.assist = null;
    this.forward(_f); this.yaw = Math.atan2(-_f.x, -_f.z);
    this.settleFrom = this.quat.clone(); this.settle = 0.001; this.pos.y = groundY; this.rampTarget = 0;
  }
  liftOff() { this.landed = false; this.rampTarget = 1; this.vel.set(0, 6, 0); this.pos.y += 0.3; this.grace = 1.2; }

  // inp: {pitch,yaw,roll,thr,boost,vert,stop}; env: {atmo, vmax, ground(x,z,y)|null, solids|null, flat(x,z,yaw)}
  updateEffects(inp = null) {
    const thr = Math.abs(this.throttle) + (inp ? Math.abs(inp.vert) * 0.3 : 0);
    this.glowMat.color.setRGB(0.25 + thr * 1.1, 0.12 + thr * 0.6, 0.06 + thr * 0.3);
    for (const p of this.plumes) { p.scale.set(1, 0.12 + thr * (inp && inp.boost ? 1.5 : 0.7), 1); p.position.z = 9.1 + 3.5 * p.scale.y; p.visible = !this.landed && thr > 0.03; }
  }

  update(dt, inp, env) {
    // ramp + settle animation always
    if (this.ramp !== this.rampTarget) this.setRamp(clamp(this.ramp + Math.sign(this.rampTarget - this.ramp) * dt / 2.2, 0, 1));
    if (this.settle > 0) {
      this.settle = Math.min(1, this.settle + dt * 1.8);
      _q.setFromEuler(_e.set(0, this.yaw, 0)); this.quat.copy(this.settleFrom).slerp(_q, this.settle);
      if (this.settle >= 1) this.settle = 0;
    }
    this.updateEffects(inp);
    if (this.landed || this.docked) return null;
    let event = null; this.grace = Math.max(0, (this.grace || 0) - dt);
    if (this.assist && env.atmo) { this.runAssist(dt, env); inp = null; }
    if (inp) {
      this.throttle = inp.stop ? 0 : clamp(this.throttle + inp.thr * dt * 0.7, -0.25, 1);
      const k = 1 - Math.exp(-7 * dt);
      this.av.x = lerp(this.av.x, inp.pitch * 1.05, k); this.av.y = lerp(this.av.y, inp.yaw * 0.95, k); this.av.z = lerp(this.av.z, inp.roll * 1.7, k);
    } else if (!this.assist) { this.av.multiplyScalar(Math.exp(-5 * dt)); }
    if (!this.assist) {
      _q.setFromEuler(_e.set(this.av.x * dt, this.av.y * dt, this.av.z * dt, 'YXZ')); this.quat.multiply(_q);
      if (env.atmo && Math.abs(this.av.z) < 0.15) { _v.set(1, 0, 0).applyQuaternion(this.quat); _q.setFromEuler(_e.set(0, 0, -_v.y * 1.6 * dt)); this.quat.multiply(_q); }
      this.quat.normalize();
      const vmax = env.vmax * this.engineMult * (inp && inp.boost ? env.boost : 1);
      this.forward(_f).multiplyScalar(this.throttle * vmax);
      if (inp && inp.vert) _f.addScaledVector(this.up(_u), inp.vert * (env.atmo ? 26 : 60));
      this.vel.lerp(_f, 1 - Math.exp(-(inp && inp.stop ? 2.5 : 1.3) * dt));
    }
    this.pos.addScaledVector(this.vel, dt);
    if (env.atmo) event = this.collide(env);
    return event;
  }

  collide(env) {
    let event = null;
    // buildings: sphere vs boxes
    const cy = this.pos.y + 2.6, R = 6.5, S = env.solids;
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      if (this.pos.x < s.x0 - R || this.pos.x > s.x1 + R || this.pos.z < s.z0 - R || this.pos.z > s.z1 + R) continue;
      if (cy - R > s.y1 - 2.4 || cy + R < s.y0) continue; // tops are handled as ground
      const cx = clamp(this.pos.x, s.x0, s.x1), cz = clamp(this.pos.z, s.z0, s.z1);
      const dx = this.pos.x - cx, dz = this.pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      if (d2 > 1e-6) { const d = Math.sqrt(d2); this.pos.x = cx + dx / d * R; this.pos.z = cz + dz / d * R; }
      else this.pos.y = s.y1 + 0.2;
      this.vel.multiplyScalar(0.5); this.throttle *= 0.5; event = 'bump';
    }
    const g = env.ground(this.pos.x, this.pos.z, this.pos.y);
    this.alt = this.pos.y - g;
    if (this.alt <= 0.12) {
      const sp = this.vel.length(), upY = this.up(_u).y;
      if (this.grace > 0) { this.pos.y = g + 0.13; this.vel.y = Math.max(this.vel.y, 0); return event; }
      if (sp < 16 && upY > 0.85 && env.flat(this.pos.x, this.pos.z, this.quat)) { this.land(g); return 'land'; }
      this.pos.y = g + 0.12;
      if (this.vel.y < 0) this.vel.y = Math.min(6, -this.vel.y * 0.3);
      if (sp >= 16) { this.vel.multiplyScalar(0.92); event = 'scrape'; } else event = upY > 0.85 ? 'uneven' : 'scrape';
    }
    return event;
  }

  startAssist(pad) { this.assist = { pad, phase: 0 }; }
  runAssist(dt, env) {
    const a = this.assist, p = a.pad;
    const tx = p.x - this.pos.x, tz = p.z - this.pos.z, d = Math.hypot(tx, tz);
    const hoverY = p.y + 70;
    if (a.phase === 0) {
      const cruiseY = p.cruiseY && d > 55 ? p.cruiseY : hoverY;
      const ty = cruiseY - this.pos.y;
      const sp = p.cruiseY && d > 55 && this.pos.y < p.cruiseY - 55 ? 0 : clamp(d * 0.45, 2.5, 170);
      _f.set(tx, 0, tz).normalize().multiplyScalar(sp); _f.y = clamp(ty * 0.6, -75, 60);
      this.vel.lerp(_f, 1 - Math.exp(-1.6 * dt));
      const yaw = d > 25 ? Math.atan2(-tx, -tz) : p.yaw;
      _q.setFromEuler(_e.set(clamp(this.vel.y / 300, -0.3, 0.3), yaw, 0, 'YXZ')); this.quat.slerp(_q, 1 - Math.exp(-1.5 * dt));
      if (d < 5 && Math.abs(ty) < 8) a.phase = 1;
    } else {
      const alt = this.pos.y - env.ground(this.pos.x, this.pos.z, this.pos.y);
      _f.set(tx * 1.2, -clamp(alt * 0.35, 1.6, 12), tz * 1.2);
      this.vel.lerp(_f, 1 - Math.exp(-3 * dt));
      _q.setFromEuler(_e.set(0, p.yaw, 0)); this.quat.slerp(_q, 1 - Math.exp(-2.5 * dt));
    }
    this.throttle = 0;
  }
}

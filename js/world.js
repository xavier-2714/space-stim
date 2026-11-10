import * as THREE from 'three';
import { G, Batch, MAT, makeWindowMats, signMesh, canvasTex, rng, hashStr, fbm2, noise2, smooth, clamp, lerp } from './util.js';
import { NPCS } from './data.js';

// sky / light / terrain settings per planet type
export const ENV = {
  terminus: { zen: 0x2f5a8c, hor: 0xe6c79c, fog: 0xcdb9a0, fogFar: 6500, sun: [-0.6, 0.33, 0.5], sunCol: 0xffd6a0, sunI: 2.3, hemi: 1.0, winI: 0.9, stars: 0.0, lens: 1,
    amp: 230, water: -6, waterCol: 0x35607a, pal: [0x5f7558, 0x7a8460, 0x8b8578, 0xe2e6e8], town: 0x7d7a70, trees: 0x3f5f4a, flatR: 430 },
  anacreon: { zen: 0x2a66b8, hor: 0xbfd8ea, fog: 0xb9cfdc, fogFar: 7500, sun: [0.4, 0.75, 0.35], sunCol: 0xfff3da, sunI: 2.8, hemi: 1.1, winI: 0.15, stars: 0,
    amp: 300, water: -14, waterCol: 0x2f6f9a, pal: [0x8c9a4c, 0xb09a5a, 0x9a6a48, 0xc9b8a0], town: 0x9a8a6c, trees: 0x4a6b33, flatR: 560 },
  trantor: { zen: 0x4d6a8c, hor: 0xc4ccd4, fog: 0xb4bdc6, fogFar: 9000, sun: [0.3, 0.55, 0.6], sunCol: 0xfff6ea, sunI: 2.2, hemi: 1.2, winI: 0.55, stars: 0,
    amp: 0, pal: [0x777c84, 0x777c84, 0x777c84, 0x777c84], town: 0x777c84, flatR: 99999, plate: 1 },
  cold: { zen: 0x3d6a96, hor: 0xd6dfe6, fog: 0xc4d0d8, fogFar: 6500, sun: [0.5, 0.35, -0.5], sunCol: 0xfff0dc, sunI: 2.2, hemi: 1.0, winI: 0.6, stars: 0,
    amp: 260, water: -8, waterCol: 0x3a6078, pal: [0x66785a, 0x7c8468, 0x858078, 0xe6eaec], town: 0x7c7a72, trees: 0x3f5f4a, flatR: 260 },
  warm: { zen: 0x2f6cc0, hor: 0xc4dcec, fog: 0xbdd2de, fogFar: 7000, sun: [-0.4, 0.7, 0.4], sunCol: 0xfff3da, sunI: 2.7, hemi: 1.1, winI: 0.2, stars: 0,
    amp: 240, water: -10, waterCol: 0x2f6f9a, pal: [0x7f9a4c, 0xa39a5a, 0x8f7a58, 0xc9c0a8], town: 0x8f866c, trees: 0x44702f, flatR: 260 },
  arid: { zen: 0x6a7fa8, hor: 0xf0c890, fog: 0xe6c69a, fogFar: 6000, sun: [0.55, 0.5, 0.3], sunCol: 0xffe2b0, sunI: 2.9, hemi: 0.9, winI: 0.2, stars: 0,
    amp: 320, pal: [0xcda66c, 0xc0905a, 0x9c6842, 0xd9bc90], town: 0xb89a70, flatR: 260 },
  ice: { zen: 0x5b86b4, hor: 0xe8f0f6, fog: 0xdce6ee, fogFar: 5500, sun: [-0.5, 0.25, 0.6], sunCol: 0xf0f4ff, sunI: 2.2, hemi: 1.2, winI: 0.8, stars: 0,
    amp: 280, pal: [0xdfe8ee, 0xc4d4de, 0x7f8c98, 0xf4f8fa], town: 0xb0bcc6, flatR: 260 },
  jungle: { zen: 0x3f7f8f, hor: 0xcfe2c4, fog: 0xb9d2b4, fogFar: 4500, sun: [0.3, 0.8, -0.3], sunCol: 0xfff6d0, sunI: 2.5, hemi: 1.1, winI: 0.3, stars: 0,
    amp: 220, water: -8, waterCol: 0x2f6a5a, pal: [0x2f6b3a, 0x4d7a3a, 0x5a5a48, 0x8a9a70], town: 0x6a6a50, trees: 0x1f5a2a, flatR: 260 },
  rock: { zen: 0x14182c, hor: 0x8a6a80, fog: 0x6a5870, fogFar: 7000, sun: [0.7, 0.2, 0.2], sunCol: 0xffc8a0, sunI: 2.0, hemi: 0.7, winI: 1.3, stars: 0.8,
    amp: 380, pal: [0x6e6860, 0x857a6c, 0x4a4642, 0x9a9088], town: 0x6a665e, flatR: 260 },
  ocean: { zen: 0x2a72c8, hor: 0xcfe6f2, fog: 0xc2dcea, fogFar: 7500, sun: [-0.3, 0.8, -0.4], sunCol: 0xffffff, sunI: 2.8, hemi: 1.2, winI: 0.2, stars: 0,
    amp: 150, water: 14, waterCol: 0x1f6fae, pal: [0xd8cba0, 0x6a9a5a, 0x7a8a60, 0xa0a890], town: 0xc0b48c, trees: 0x3a7a3a, flatR: 300, lift: 30 },
};

const GEO = {
  robe: new THREE.CylinderGeometry(0.17, 0.32, 1.35, 8).translate(0, 0.675, 0),
  head: new THREE.SphereGeometry(0.16, 10, 8).translate(0, 1.53, 0),
  hat: new THREE.CylinderGeometry(0.17, 0.19, 0.12, 8).translate(0, 1.67, 0),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16), cone: new THREE.ConeGeometry(1, 1, 8),
  dome: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), rock: new THREE.DodecahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
};
const SKIN = [0xd9a57a, 0xb07a52, 0xe8c0a0, 0x8a5a3a];
let grainTex, plateTex;

export class Surface {
  constructor(sys) {
    this.sys = sys; this.key = sys.hand || sys.type; this.env = ENV[this.key];
    this.group = new THREE.Group(); this.seed = hashStr(sys.id);
    this.solids = []; this.ramps = []; this.npcs = []; this.interacts = []; this.pois = []; this.updaters = []; this.paths = []; this.rects = [];
    this.b = { solid: new Batch(), win: new Batch(), glow: new Batch(), glass: new Batch() };
    this.pad = { x: 0, y: 0, z: 200, yaw: 0 };
    this.makeTerrain();
    if (sys.hand === 'terminus') this.buildTerminus();
    else if (sys.hand === 'anacreon') this.buildAnacreon();
    else if (sys.hand === 'trantor') this.buildTrantor();
    else this.buildOutpost();
    this.scatter();
    this.finalize();
  }

  // ---------- terrain ----------
  rawH(x, z) {
    const e = this.env; if (!e.amp) return 0;
    const d = Math.hypot(x, z), f = smooth(e.flatR, e.flatR + 700, d);
    const base = e.lift || 0;
    let v = (fbm2(x / 900 + 31, z / 900 + 17, this.seed & 1023, 5) - 0.43) * e.amp;
    v += smooth(2600, 7500, d) * fbm2(x / 2600, z / 2600, 91, 4) * e.amp * 1.6;
    return base + f * (v - (e.lift ? base * 0.9 : 0));
  }
  makeTerrain() {
    const size = 16000, n = 256, cell = size / n, e = this.env;
    this.tSize = size; this.tN = n; this.tCell = cell;
    const H = this.heights = new Float32Array((n + 1) * (n + 1));
    const pos = new Float32Array((n + 1) * (n + 1) * 3), uv = new Float32Array((n + 1) * (n + 1) * 2), idx = [];
    for (let iz = 0; iz <= n; iz++) for (let ix = 0; ix <= n; ix++) {
      const x = -size / 2 + ix * cell, z = -size / 2 + iz * cell, i = iz * (n + 1) + ix;
      const h = this.rawH(x, z); H[i] = h; pos.set([x, h, z], i * 3); uv.set([x / (e.plate ? 60 : 22), z / (e.plate ? 60 : 22)], i * 2);
    }
    for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
      const a = iz * (n + 1) + ix, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals();
    const col = new Float32Array((n + 1) * (n + 1) * 3), nor = g.attributes.normal, c = new THREE.Color(), c2 = new THREE.Color();
    const P = e.pal, wl = e.water ?? -1e9;
    for (let i = 0; i < H.length; i++) {
      const h = H[i] - (e.lift || 0), x = pos[i * 3], z = pos[i * 3 + 2], ny = nor.getY(i), d = Math.hypot(x, z);
      const t = clamp(h / (e.amp || 1) * 1.6 + (noise2(x / 300, z / 300, 5) - 0.5) * 0.3, 0, 1);
      c.set(P[0]).lerp(c2.set(P[1]), smooth(0.05, 0.4, t));
      if (ny < 0.9) c.lerp(c2.set(P[2]), smooth(0.9, 0.75, ny));
      c.lerp(c2.set(P[3]), smooth(0.62, 0.85, t));
      if (H[i] < wl + 2) c.lerp(c2.set(0x9a9070), 0.6);
      c.lerp(c2.set(e.town), 1 - smooth(e.flatR * 0.55, e.flatR + 150, d));
      c.multiplyScalar(0.9 + noise2(x / 60, z / 60, 9) * 0.2);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    grainTex ||= canvasTex(128, 128, (x) => { const r = rng(3); for (let i = 0; i < 128; i++) for (let j = 0; j < 128; j++) { const v = 205 + (r() * 50) | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, j, 1, 1); } }, true);
    plateTex ||= canvasTex(256, 256, (x) => {
      x.fillStyle = '#e4e4e4'; x.fillRect(0, 0, 256, 256); const r = rng(8);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 205 + (r() * 45) | 0; x.fillStyle = `rgb(${v},${v},${v + 4})`; x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
      x.fillStyle = '#8a8f96'; for (let i = 0; i < 4; i++) { x.fillRect(i * 64, 0, 2, 256); x.fillRect(0, i * 64, 256, 2); }
    }, true);
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, map: e.plate ? plateTex : grainTex }));
    m.frustumCulled = false; this.group.add(m);
    // far skirt
    const edge = this.rawH(size / 2, 0);
    const sk = new THREE.Mesh(new THREE.PlaneGeometry(400000, 400000), new THREE.MeshLambertMaterial({ color: e.water !== undefined ? e.waterCol : P[1] }));
    sk.rotation.x = -Math.PI / 2; sk.position.y = (e.water ?? Math.min(edge, 0)) - 0.5; this.group.add(sk);
    if (e.water !== undefined) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ color: e.waterCol, transparent: true, opacity: 0.82 }));
      w.rotation.x = -Math.PI / 2; w.position.y = e.water; this.group.add(w);
    }
  }
  h(x, z) {
    const n = this.tN, c = this.tCell, s = this.tSize / 2;
    const gx = clamp((x + s) / c, 0, n - 0.0001), gz = clamp((z + s) / c, 0, n - 0.0001);
    const ix = gx | 0, iz = gz | 0, fx = gx - ix, fz = gz - iz, H = this.heights, a = iz * (n + 1) + ix;
    const ha = H[a], hb = H[a + 1], hc = H[a + n + 1], hd = H[a + n + 2];
    return fx + fz <= 1 ? ha + (hb - ha) * fx + (hc - ha) * fz : hd + (hc - hd) * (1 - fx) + (hb - hd) * (1 - fz);
  }
  walkEnv() {
    const w = this.env.water;
    this._we ||= { solids: this.solids, ramps: this.ramps, terrain: w === undefined ? (x, z) => this.h(x, z) : (x, z) => Math.max(this.h(x, z), w - 1.2) };
    return this._we;
  }
  ground(x, z, y) {
    let g = Math.max(this.h(x, z), this.env.water ?? -1e9);
    for (const s of this.solids) {
      if (x < s.x0 - 2 || x > s.x1 + 2 || z < s.z0 - 2 || z > s.z1 + 2) continue;
      if (s.x1 - s.x0 < 6 || s.z1 - s.z0 < 6) continue;
      if (s.y1 <= y + 1.5 && s.y1 > g) g = s.y1;
    }
    return g;
  }
  flat(x, z, quat, y) {
    const f = new THREE.Vector3(0, 0, -9).applyQuaternion(quat), r = new THREE.Vector3(4, 0, 0).applyQuaternion(quat);
    let lo = 1e9, hi = -1e9;
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const g = this.ground(x + f.x * a + r.x * b, z + f.z * a + r.z * b, y + 1); lo = Math.min(lo, g); hi = Math.max(hi, g); }
    return hi - lo < 2.2;
  }

  // ---------- builders ----------
  box(x, y0, z, sx, sy, sz, col, o = {}) {
    const k = o.k || 'solid';
    this.b[k].box(x, y0 + sy / 2, z, sx, sy, sz, col, o.rot || 0);
    if (o.c !== 0 && k !== 'glow' && !o.rot) this.solids.push({ x0: x - sx / 2, x1: x + sx / 2, z0: z - sz / 2, z1: z + sz / 2, y0, y1: y0 + sy, nb: o.nb });
  }
  slab(x, z, sx, sz, col, y = 0.04) { this.b.solid.box(x, y, z, sx, 0.08, sz, col); }
  cyl(x, y0, z, r, h, col, o = {}) {
    this.b[o.k || 'solid'].geo(GEO.cyl, x, y0 + h / 2, z, col, { sx: r, sy: h, sz: r });
    if (o.c !== 0) this.solids.push({ x0: x - r * 0.8, x1: x + r * 0.8, z0: z - r * 0.8, z1: z + r * 0.8, y0, y1: y0 + h });
  }
  dome(x, y, z, r, col, sy = 1) { this.b.solid.geo(GEO.dome, x, y, z, col, { sx: r, sy: r * sy, sz: r }); }
  house(x, z, sx, sz, h, col, o = {}) {
    const t = 0.4, y = o.y || 0, k = o.k || 'win', dw = o.dw || 2.4, dh = o.dh || 2.8, door = o.door || 's';
    const x0 = x - sx / 2, x1 = x + sx / 2, z0 = z - sz / 2, z1 = z + sz / 2;
    const wall = (ax, p, a0, a1, hasDoor) => {
      const seg = (s0, s1, yb, yt) => { if (s1 - s0 < 0.05) return; if (ax === 'x') this.box((s0 + s1) / 2, yb, p, s1 - s0, yt - yb, t, col, { k }); else this.box(p, yb, (s0 + s1) / 2, t, yt - yb, s1 - s0, col, { k }); };
      if (!hasDoor) return seg(a0, a1, y, y + h);
      const c = (a0 + a1) / 2; seg(a0, c - dw / 2, y, y + h); seg(c + dw / 2, a1, y, y + h); seg(c - dw / 2, c + dw / 2, y + dh, y + h);
    };
    wall('x', z0 + t / 2, x0, x1, door === 'n'); wall('x', z1 - t / 2, x0, x1, door === 's');
    wall('z', x0 + t / 2, z0 + t, z1 - t, door === 'w'); wall('z', x1 - t / 2, z0 + t, z1 - t, door === 'e');
    this.box(x, y + h, z, sx + 0.8, 0.4, sz + 0.8, o.roof || 0x4a4f55, { nb: 1 });
    this.b.solid.box(x, y + 0.03, z, sx - 0.2, 0.06, sz - 0.2, o.floor || 0x6f6f6c);
    this.b.glow.box(x, y + h - 0.06, z, Math.min(sx * 0.4, 6), 0.08, Math.min(sz * 0.4, 6), 0xfff0d0);
  }
  rampV(x0, x1, z0, z1, yA, yB, ax, col) {
    this.ramps.push({ x0, x1, z0, z1, yA, yB, ax });
    const len = ax === 'x' ? x1 - x0 : z1 - z0, a = Math.atan2(yB - yA, len), L = Math.hypot(len, yB - yA);
    const o = ax === 'x' ? { sx: L, sy: 0.3, sz: z1 - z0, rz: a } : { sx: x1 - x0, sy: 0.3, sz: L, rx: -a };
    this.b.solid.geo(GEO.box, (x0 + x1) / 2, (yA + yB) / 2 - 0.15, (z0 + z1) / 2, col, o);
  }
  sign(text, x, y, z, ry, w, h, o) { const m = signMesh(text, w, h, o); m.position.set(x, y, z); m.rotation.y = ry; this.group.add(m); return m; }
  lamp(x, z, h, col = 0xfff0c8, y = 0) { this.b.solid.box(x, y + h / 2, z, 0.25, h, 0.25, 0x44484c); this.b.glow.box(x, y + h + 0.25, z, 0.9, 0.5, 0.9, col); }
  reserve(x0, x1, z0, z1) { this.rects.push([x0, x1, z0, z1]); }
  isFree(x, z, r) { return !this.rects.some((q) => x + r > q[0] && x - r < q[1] && z + r > q[2] && z - r < q[3]); }
  poi(id, name, x, z, r, reward, text, y = null) { this.pois.push({ id: this.sys.id + ':' + id, name, x, z, r, reward, text, y }); }
  crowd(pts, n, y = 0, speed = 1.3) { this.paths.push({ pts, n, y, speed }); }
  npc(id, x, z, o = {}) {
    const def = NPCS[id], g = new THREE.Group(), r = rng(hashStr(id + this.sys.id));
    g.add(new THREE.Mesh(GEO.robe, new THREE.MeshLambertMaterial({ color: def.col })));
    g.add(new THREE.Mesh(GEO.head, new THREE.MeshLambertMaterial({ color: SKIN[(r() * 4) | 0] })));
    g.add(new THREE.Mesh(GEO.hat, new THREE.MeshLambertMaterial({ color: 0x2a2a2e })));
    g.scale.setScalar(1.08); g.position.set(x, o.y || 0, z); this.group.add(g); this.npcs.push(g);
    const name = o.name || def.name;
    this.interacts.push({ pos: new THREE.Vector3(x, (o.y || 0) + 1.3, z), r: 3.2, label: 'Talk to ' + name, act: () => G.ui.dialog({ ...def, name }, id) });
  }
  lift(x, y, z, label, dest) {
    this.box(x, y, z, 3, 3.4, 3, 0x3a4048); this.b.glow.box(x, y + 3.5, z, 3.2, 0.25, 3.2, 0x4fd6c8);
    for (const [dx, dz] of [[1.55, 0], [-1.55, 0], [0, 1.55], [0, -1.55]]) this.b.glow.box(x + dx, y + 1.6, z + dz, dx ? 0.06 : 1.4, 2.4, dz ? 0.06 : 1.4, 0xffcf8a);
    this.interacts.push({ pos: new THREE.Vector3(x, y + 1.5, z), r: 4.5, label, act: () => G.teleport(dest) });
  }
  decoShip(x, z, yaw, s, col, y = 0) {
    const B = this.b.solid, c = Math.cos(yaw), sn = Math.sin(yaw), P = (lx, lz) => [x + lx * c + lz * sn, z - lx * sn + lz * c];
    B.box(x, y + 2.8 * s, z, 7 * s, 3.4 * s, 20 * s, col, yaw);
    let p = P(0, -12 * s); B.box(p[0], y + 2.4 * s, p[1], 4.5 * s, 2.2 * s, 5 * s, col, yaw);
    for (const sx of [-1, 1]) { p = P(sx * 4.6 * s, 4 * s); B.box(p[0], y + 2.8 * s, p[1], 2.4 * s, 2.4 * s, 9 * s, 0x5a5f66, yaw); p = P(sx * 3 * s, -5 * s); B.box(p[0], y + 0.55 * s, p[1], 0.4 * s, 1.1 * s, 0.4 * s, 0x3a3a3a, yaw); p = P(sx * 3 * s, 6 * s); B.box(p[0], y + 0.55 * s, p[1], 0.4 * s, 1.1 * s, 0.4 * s, 0x3a3a3a, yaw); }
    p = P(0, 7 * s); B.box(p[0], y + 6 * s, p[1], 0.3 * s, 3.4 * s, 5 * s, 0x9a4a2a, yaw);
    this.solids.push({ x0: x - 9 * s, x1: x + 9 * s, z0: z - 9 * s, z1: z + 9 * s, y0: y + 1, y1: y + 5 * s });
  }
  padMark(x, z, label) {
    this.slab(x, z, 46, 46, 0x6f7275, 0.05); this.slab(x, z, 40, 40, 0x7f8284, 0.07);
    for (const [dx, dz] of [[-21, -21], [21, -21], [-21, 21], [21, 21]]) this.b.glow.box(x + dx, 0.2, z + dz, 0.6, 0.3, 0.6, 0xffb347);
    if (label) { const m = signMesh(label, 8, 8, { bg: '#7f8284', fg: '#e9e2c8' }); m.rotation.x = -Math.PI / 2; m.position.set(x + 15, 0.13, z + 15); this.group.add(m); }
  }
  stall(x, z, col) {
    this.box(x, 0, z, 4, 1, 1.4, 0x6a5038);
    for (const [dx, dz] of [[-2.2, -1.6], [2.2, -1.6], [-2.2, 1.6], [2.2, 1.6]]) this.b.solid.box(x + dx, 1.5, z + dz, 0.14, 3, 0.14, 0x4a4038);
    this.b.solid.box(x, 3.1, z, 5.2, 0.14, 4, col);
    for (let i = 0; i < 3; i++) this.b.solid.box(x - 1.2 + i * 1.2, 1.2, z, 0.7, 0.4, 0.7, [0xa86a3a, 0x6a8a4a, 0x8a8a9a][i]);
  }
  town(x0, x1, z0, z1, step, pal, hmin, hmax, k = 'win', roof = 0x4a4f55) {
    const r = rng(this.seed + x0 * 7 + z0 * 13);
    for (let x = x0; x <= x1; x += step) for (let z = z0; z <= z1; z += step) {
      const sx = step * (0.5 + r() * 0.28), sz = step * (0.5 + r() * 0.28), h = hmin + r() * (hmax - hmin), col = pal[(r() * pal.length) | 0];
      const px = x + (r() - 0.5) * step * 0.15, pz = z + (r() - 0.5) * step * 0.15;
      if (!this.isFree(px, pz, Math.max(sx, sz) / 2 + 1)) continue;
      this.box(px, 0, pz, sx, h, sz, col, { k }); this.b.solid.box(px, h + 0.25, pz, sx + 0.7, 0.5, sz + 0.7, roof);
      if (r() < 0.3) this.b.solid.box(px + sx * 0.2, h + 1.2, pz, 0.8, 1.6, 0.8, 0x55504a);
    }
  }

  // ---------- TERMINUS ----------
  buildTerminus() {
    const S = this; S.pad = { x: 0, y: 0, z: 200, yaw: 0 };
    S.slab(0, 235, 360, 230, 0x86877f);
    let n = 2; for (const pz of [200, 290]) for (const px of [-115, 0, 115]) S.padMark(px, pz, 'BAY ' + n++);
    S.decoShip(-115, 200, 0.35, 1, 0x9aa3a8); S.decoShip(115, 290, -2.5, 1.35, 0xa89878);
    for (const x of [-170, -57, 57, 170]) for (const z of [140, 245, 335]) S.lamp(x, z, 13);
    S.box(165, 0, 135, 10, 26, 10, 0xb9b4a6, { k: 'win' }); S.box(165, 26, 135, 16, 5, 16, 0x39424a); S.b.glow.box(165, 28.5, 135, 16.2, 1.6, 16.2, 0x9fe8ff);
    S.b.solid.box(165, 37, 135, 0.5, 12, 0.5, 0x888888); S.b.glow.box(165, 43.3, 135, 1, 1, 1, 0xff4a3a);
    for (let i = 0; i < 9; i++) S.box(-150 + (i % 3) * 5, 0, 330 + ((i / 3) | 0) * 5, 4, 3 + (i % 2), 4, [0x8a6a3a, 0x5a6f7a, 0x7a5a4a][i % 3]);
    for (const x of [-185, -197]) S.cyl(x, 0, 160, 5, 9, 0xc8c8c0);
    // port office + shipwright
    S.house(-60, 112, 20, 14, 5, 0xc4bca8, { door: 's' }); S.sign('PORT OFFICE\nTERMINUS CITY', -60, 4.1, 119.3, 0, 7, 1.7);
    S.box(-64, 0, 108, 6, 1.05, 1.2, 0x6a5038); S.npc('t_dock', -64, 106.3);
    S.house(78, 110, 28, 18, 9, 0x9a9c98, { door: 's', dw: 15, dh: 7, k: 'solid' }); S.sign('BRILL & DAUGHTER · SHIPWRIGHTS', 78, 8, 119.3, 0, 16, 1.5);
    S.decoShip(78, 108, 0, 0.55, 0x8f8a80); S.npc('t_wright', 72, 123);
    // streets
    S.slab(0, -92, 11, 384, 0x5a5b5e); S.slab(0, -62, 330, 7, 0x5a5b5e); S.slab(0, -175, 330, 7, 0x5a5b5e);
    for (let z = 80; z > -280; z -= 30) { S.lamp(-7, z, 6); S.lamp(7, z, 6); }
    S.reserve(-8, 8, -290, 130); S.reserve(-170, 170, -67, -57); S.reserve(-170, 170, -180, -170); S.reserve(-200, 200, 85, 400);
    // market
    S.slab(0, 45, 96, 54, 0xa39c8c, 0.06); S.reserve(-50, 50, 15, 75);
    [[-30, 30, 0xc4532a], [-14, 32, 0x3f7a8a], [18, 30, 0xd9a441], [34, 34, 0x6a8a4a], [-32, 58, 0x8a5a8a], [-12, 60, 0xc4532a], [16, 60, 0x3f7a8a], [34, 60, 0xd9a441]].forEach(([x, z, c]) => S.stall(x, z, c));
    S.npc('t_trader', -14, 33.6); S.npc('t_farmer', 18, 31.6);
    S.sign('MARKET SQUARE', 0, 5.5, 72, 0, 12, 1.6); S.b.solid.box(-6.5, 2.5, 72, 0.3, 5, 0.3, 0x4a4038); S.b.solid.box(6.5, 2.5, 72, 0.3, 5, 0.3, 0x4a4038);
    // tavern + journal
    S.house(-34, -12, 18, 14, 5.5, 0xa89a84, { door: 'e' }); S.reserve(-45, -23, -21, -3); S.sign('THE RIM LIGHT', -24.7, 4.5, -12, Math.PI / 2, 7, 1.4, { bg: '#3a1c1c' });
    S.box(-39, 0, -12, 1.1, 1.1, 8, 0x5a4030); S.npc('t_barkeep', -40.6, -12); S.npc('t_spacer', -31, -16.5);
    for (const [x, z] of [[-31, -8], [-35, -15.5], [-30, -13]]) { S.cyl(x, 0, z, 0.6, 0.8, 0x6a5038); }
    S.box(34, 0, -12, 16, 7, 12, 0xb4ac9c, { k: 'win' }); S.reserve(25, 43, -19, -5); S.sign('TERMINUS CITY JOURNAL', 25.9, 5.6, -12, -Math.PI / 2, 9, 1.3);
    // city hall
    S.house(-72, -140, 26, 18, 8, 0xcac2ae, { door: 'e', dw: 3.2 }); S.reserve(-88, -55, -152, -128); S.sign('CITY HALL', -58.7, 6.3, -140, Math.PI / 2, 8, 1.5);
    S.box(-76, 0, -140, 1.2, 1.05, 6, 0x6a5038); S.npc('t_clerk', -77.6, -140); S.slab(-32, -140, 54, 5, 0x5a5b5e);
    // Encyclopedia Hall
    S.house(0, -330, 90, 40, 16, 0xd8d2c2, { door: 's', dw: 8, dh: 6, floor: 0x8a8478 }); S.reserve(-85, 85, -360, -292);
    for (const x of [-40, -30, -20, -8, 8, 20, 30, 40]) S.cyl(x, 0, -305, 1.1, 14, 0xe6e0d0);
    S.box(0, 14, -305.5, 96, 2.2, 9, 0xd0cabb, { nb: 1 }); S.slab(0, -300, 96, 14, 0xb9b3a4, 0.08);
    S.sign('ENCYCLOPEDIA GALACTICA FOUNDATION Nº 1', 0, 15.1, -300.9, 0, 44, 1.8, { bg: '#d0cabb', fg: '#3a3428' });
    for (const sx of [-1, 1]) { S.box(sx * 62, 0, -330, 30, 11, 30, 0xcfc9b9, { k: 'win' }); for (let x = 10; x <= 38; x += 7) for (const z of [-342, -334, -326]) S.box(sx * x, 0, z, 4.5, 4.5, 1.2, 0x5f4a38); }
    for (const x of [-3, 3]) S.box(x * 1.8, 0, -320, 2.4, 1, 1.2, 0x6a5038);
    S.b.glow.box(0, 15.7, -330, 60, 0.1, 3, 0xfff0d0); S.npc('t_archivist', 5.4, -318.5);
    S.crowd([[-38, -316], [38, -316]], 5, 0, 0.8); S.crowd([[-36, -346], [36, -346]], 4, 0, 0.7);
    // The Vault
    S.box(72, 0, -292, 10, 8, 8, 0x8f9498); S.b.solid.box(72, 8, -292, 11, 0.5, 9, 0x70757a); S.sign('THE VAULT\nSEALED UNTIL THE ANNIVERSARY', 72, 3, -287.9, 0, 6, 1.6, { bg: '#2a2d30' }); S.reserve(64, 80, -298, -284);
    // observatory
    S.cyl(190, 0, -130, 13, 9, 0xd0d0c8); S.dome(190, 9, -130, 13, 0xe4e4dc); S.b.solid.box(190, 15, -122, 3, 9, 14, 0x2a2e33, 0); S.reserve(172, 208, -148, -112);
    S.house(168, -108, 10, 8, 4, 0xbfb8a8, { door: 'w' }); S.reserve(160, 176, -114, -102); S.npc('t_astro', 172, -124); S.sign('RIM OBSERVATORY', 176.5, 3, -130.4, -Math.PI / 2, 6, 1.1);
    S.slab(95, -128, 164, 4, 0x5a5b5e);
    // power station
    S.box(-200, 0, -100, 40, 12, 26, 0xb0b4b2, { k: 'win' }); S.dome(-232, 0, -100, 11, 0xd8dcda); S.dome(-176, 0, -124, 9, 0xd8dcda);
    S.solids.push({ x0: -241, x1: -223, z0: -109, z1: -91, y0: 0, y1: 9 }, { x0: -183, x1: -169, z0: -131, z1: -117, y0: 0, y1: 7 });
    S.b.glow.box(-200, 6, -86.9, 30, 0.5, 0.1, 0x9fe8ff); S.b.glow.box(-200, 12.3, -100, 4, 0.5, 4, 0x9fe8ff); S.slab(-200, -82, 44, 0.5, 0xe0c020, 0.07);
    S.reserve(-245, -165, -135, -78); S.npc('t_engineer', -188, -80); S.sign('MUNICIPAL POWER STATION', -200, 9.5, -86.9, 0, 16, 1.4); S.slab(-95, -62, 190, 5, 0x5a5b5e);
    // hydroponics
    for (let i = 0; i < 3; i++) { const z = 20 + i * 16; S.box(150, 0, z, 44, 4.5, 9, 0, { k: 'glass' }); S.b.solid.box(150, 0.5, z, 42, 1, 7, 0x3f7a3f); S.b.solid.box(150, 4.6, z, 45, 0.2, 10, 0x9aa0a0); }
    S.reserve(125, 175, 10, 62);
    S.b.solid.box(120, 30, -250, 0.8, 60, 0.8, 0x70757a); S.b.glow.box(120, 60.5, -250, 1.4, 1.4, 1.4, 0xff4a3a);
    // housing
    const pal = [0xbdb5a2, 0xa8a090, 0xc9c0aa, 0x9c9a8e, 0xb0a48e];
    S.town(-160, -22, -50, 70, 24, pal, 4, 9); S.town(22, 110, -50, 5, 24, pal, 4, 9); S.town(-160, 160, -120, -80, 26, pal, 4, 10); S.town(-160, 160, -260, -195, 26, pal, 4, 9);
    S.town(60, 130, -165, -140, 24, pal, 4, 8);
    // people
    S.crowd([[2.5, 92], [2.5, -280]], 9); S.crowd([[-2.5, -280], [-2.5, 92]], 8); S.crowd([[-40, 46], [40, 46], [40, 22], [-40, 22], [-40, 46]], 9, 0, 1.0);
    S.crowd([[-150, -60], [150, -60]], 6); S.crowd([[-40, 150], [-60, 122], [60, 130], [100, 180]], 4);
    // discoveries
    S.poi('port', 'Terminus City Spaceport', 0, 190, 70, 20, 'Six bays, two of them occupied. The edge of the Galaxy keeps a quiet port.');
    S.poi('market', 'Market Square', 0, 45, 22, 25, 'Everything on Terminus that is not an encyclopedia changes hands here.');
    S.poi('hall', 'Encyclopedia Hall', 0, -300, 26, 40, 'Fifty years of scholarship behind one portico. Volume One is still to come.');
    S.poi('vault', 'The Vault', 72, -284, 9, 40, 'A sealed chamber left by the founders, to be opened on the fiftieth anniversary. No one alive knows what is inside.');
    S.poi('obs', 'Rim Observatory', 180, -125, 20, 30, 'Half of its sky is the whole Galaxy. The other half is empty.');
    S.poi('power', 'Municipal Power Station', -195, -78, 16, 30, 'Small, clean atomic power — a craft the neighbours are said to be forgetting.');
    const bx = -1150, bz = -900, by = S.h(bx, bz);
    S.b.solid.box(bx, by + 6, bz, 2, 12, 2, 0x8a8f96); S.b.glow.box(bx, by + 12.6, bz, 1.2, 1.2, 1.2, 0xffb347);
    S.poi('beacon', 'Imperial Survey Marker', bx, bz, 30, 150, 'Planted by the first Imperial survey, centuries before anyone thought to live here. Its lamp still burns.');
    const mx = 1250, mz = 700, my = S.h(mx, mz); S.decoShip(mx, mz, 0.9, 2.2, 0x7a7870, my - 2);
    S.poi('wreck', 'The First Lander', mx, mz, 45, 150, 'One of the transports that carried the Encyclopedists out from Trantor, left where it set down.');
  }

  // ---------- ANACREON ----------
  buildAnacreon() {
    const S = this; S.pad = { x: 0, y: 0, z: 290, yaw: 0 };
    const STONE = 0xa89a80, DSTONE = 0x8a7c66, RED = 0x9a1f1f, GOLD = 0xd9a441;
    S.slab(0, 320, 460, 260, 0x8f897c); S.reserve(-240, 240, 150, 460);
    S.padMark(0, 290, 'ROYAL\nPORT'); S.padMark(-70, 380, '2'); S.padMark(70, 380, '3'); S.decoShip(70, 380, 2.2, 1.2, 0x8a8478);
    // old cruisers on cradles
    for (const sx of [-1, 1]) {
      const x = sx * 165, z = 320;
      S.box(x, 6, z, 22, 16, 150, 0x7f8388); S.box(x, 22, z + 20, 12, 8, 60, 0x70757a); S.box(x, 30, z + 30, 5, 6, 20, 0x5f6368);
      S.b.solid.geo(GEO.cone, x, 14, z - 87, 0x7f8388, { rx: -Math.PI / 2, sx: 11, sy: 26, sz: 8 });
      for (const dz of [-50, 0, 50]) { S.b.solid.box(x - 9, 3, z + dz, 3, 6, 6, 0x4a4038); S.b.solid.box(x + 9, 3, z + dz, 3, 6, 6, 0x4a4038); }
      for (let i = 0; i < 6; i++) S.b.solid.box(x + sx * -11.2, 9 + (i % 3) * 3.5, z - 55 + i * 21, 0.3, 3 + (i % 2) * 2, 7, 0x8a4a2a);
      S.b.solid.box(x - sx * 14, 8, z - 20, 0.4, 16, 0.4, 0x5a4a38); S.b.solid.box(x - sx * 14, 12, z - 20, 6, 0.3, 30, 0x5a4a38);
      S.b.solid.box(x, 16.5, z - 40, 22.3, 2.5, 1.2, RED); S.b.solid.box(x, 16.5, z - 37, 22.3, 2.5, 0.6, GOLD);
    }
    for (const x of [-230, -80, 80, 230]) for (const z of [200, 320, 440]) S.lamp(x, z, 12, 0xffe0a0);
    // customs house + yards
    S.house(-50, 180, 22, 16, 6.5, STONE, { door: 's', k: 'solid', roof: 0x6a2a22 }); S.sign('ROYAL PORT CAPTAIN', -50, 5.4, 188.3, 0, 9, 1.4, { bg: '#5a1414' });
    S.box(-54, 0, 176, 6, 1.05, 1.2, 0x5a4030); S.npc('a_port', -54, 174.3);
    S.house(70, 182, 30, 20, 10, DSTONE, { door: 's', dw: 14, dh: 7.5, k: 'solid', roof: 0x4a4038 }); S.sign('THE ROYAL YARDS', 70, 9, 192.3, 0, 12, 1.4, { bg: '#5a1414' }); S.npc('a_wright', 62, 196);
    // walls
    const wallSeg = (x, z, sx, sz) => { S.box(x, 0, z, sx, 10, sz, STONE); const n = Math.floor(Math.max(sx, sz) / 6); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n - 0.5; S.b.solid.box(x + (sx > sz ? t * sx : 0), 10.6, z + (sx > sz ? 0 : t * sz), sx > sz ? 3 : sx + 0.2, 1.2, sx > sz ? sz + 0.2 : 3, DSTONE); } };
    wallSeg(-172, 130, 320, 4); wallSeg(172, 130, 320, 4); wallSeg(0, -440, 668, 4); wallSeg(-332, -155, 4, 574); wallSeg(332, -155, 4, 574);
    const tower = (x, z, h = 17) => { S.box(x, 0, z, 9, h, 9, DSTONE); S.b.solid.box(x, h + 0.6, z, 10.5, 1.2, 10.5, STONE); S.b.solid.geo(GEO.cone, x, h + 4.2, z, 0x6a2a22, { sx: 6, sy: 6, sz: 6 }); S.b.solid.box(x, h + 10, z, 0.2, 6, 0.2, 0x3a3a3a); S.b.solid.box(x + 1.6, h + 11.6, z, 3, 1.8, 0.1, RED); };
    for (const [x, z] of [[-14, 130], [14, 130], [-332, 130], [332, 130], [-332, -440], [332, -440], [0, -440], [-332, -155], [332, -155]]) tower(x, z, z === 130 && Math.abs(x) < 20 ? 20 : 16);
    S.box(0, 11, 130, 20, 6, 5, STONE, { nb: 1 }); S.sign('ANACREON', 0, 14, 132.6, 0, 14, 2.4, { bg: '#5a1414', fg: '#e8c27a' });
    S.npc('a_soldier', 6.5, 137);
    S.reserve(-340, 340, 120, 140); S.reserve(-340, -324, -450, 140); S.reserve(324, 340, -450, 140); S.reserve(-340, 340, -448, -432);
    // avenue + cross streets
    S.slab(0, -60, 14, 380, 0x7a7266); S.slab(0, 20, 600, 8, 0x7a7266); S.slab(0, -130, 600, 8, 0x7a7266); S.slab(0, 150, 14, 44, 0x7a7266);
    S.reserve(-10, 10, -260, 130); S.reserve(-320, 320, 14, 26); S.reserve(-320, 320, -136, -124);
    for (let z = 110; z > -240; z -= 28) for (const x of [-9, 9]) { S.b.solid.box(x, 4, z, 0.3, 8, 0.3, 0x3a3a3a); S.b.solid.box(x + (x > 0 ? 1.1 : -1.1), 6.6, z, 2, 2.6, 0.1, z % 56 ? RED : GOLD); }
    // bazaar
    S.slab(0, 70, 110, 56, 0xb0a084, 0.06); S.reserve(-58, 58, 40, 100);
    [[-40, 54, RED], [-22, 56, GOLD], [22, 54, 0x3f6a8a], [40, 56, RED], [-40, 84, 0x6a8a4a], [-22, 86, RED], [22, 86, GOLD], [40, 84, 0x8a5a8a]].forEach(([x, z, c]) => S.stall(x, z, c));
    S.npc('a_trader', -22, 57.6); S.npc('a_farmer', 22, 87.6); S.sign('GRAND BAZAAR', 0, 6, 99, 0, 12, 1.6, { bg: '#5a1414' });
    S.b.solid.box(-6.5, 3, 99, 0.3, 6, 0.3, 0x4a4038); S.b.solid.box(6.5, 3, 99, 0.3, 6, 0.3, 0x4a4038);
    // inn
    S.house(40, -6, 20, 14, 6, DSTONE, { door: 'w', k: 'solid', roof: 0x6a2a22 }); S.reserve(28, 52, -15, 3); S.sign('THE NYAK & LANCE', 29.7, 4.8, -6, -Math.PI / 2, 8, 1.3, { bg: '#3a1c1c' });
    S.box(46, 0, -6, 1.1, 1.1, 8, 0x5a4030); S.npc('a_inn', 47.6, -6); for (const [x, z] of [[36, -10], [38, -2], [42, -10.5]]) S.cyl(x, 0, z, 0.6, 0.8, 0x6a5038);
    // smoke quarter (east)
    S.smoke = [];
    for (const [x, z, h] of [[190, -40, 34], [240, -70, 42], [215, 60, 30], [270, 50, 38]]) {
      S.box(x, 0, z, 36, 12, 28, 0x5a534c); S.b.solid.box(x, 12.4, z, 37, 0.8, 29, 0x3a3632); S.cyl(x + 9, 0, z + 4, 2.4, h, 0x4a3f38); S.b.solid.geo(GEO.cyl, x + 9, h + 0.5, z + 4, 0x2a2624, { sx: 2.8, sy: 1, sz: 2.8 });
      S.smoke.push([x + 9, h + 2, z + 4]); S.b.glow.box(x - 10, 3, z + 14.1, 5, 3, 0.1, 0xff7a2a);
    }
    S.reserve(165, 300, -95, 82); S.box(232, 0, -8, 30, 5, 14, 0x2a2826); // coal heap
    // sealed atomic plant (west)
    S.cyl(-230, 0, -60, 24, 12, 0xb8bcc0); S.dome(-230, 12, -60, 24, 0xc8ccd0, 0.7); S.box(-196, 0, -60, 20, 9, 18, 0xa8acb0);
    for (const dz of [-6, 0, 6]) S.b.solid.box(-185.8, 3, -60 + dz, 0.3, 6, 3.2, 0x5a4a38); S.b.solid.box(-185.6, 3, -60, 0.2, 0.6, 16, RED);
    S.sign('PREFECTURAL POWER STATION IV\nCLOSED BY ROYAL ORDER', -185.5, 7, -60, Math.PI / 2, 12, 2, { bg: '#2a2d30', fg: '#b0b4b8' });
    S.reserve(-262, -180, -92, -28); S.npc('a_engineer', -178, -52);
    // barracks + parade
    S.slab(-150, 68, 90, 60, 0x9a8f78, 0.06); S.box(-150, 0, 108, 80, 8, 12, DSTONE); S.box(-200, 0, 68, 12, 8, 60, DSTONE); S.reserve(-212, -100, 34, 118);
    S.crowd([[-180, 50], [-115, 50], [-115, 90], [-180, 90], [-180, 50]], 12, 0, 1.5);
    // palace
    S.box(0, 0, -350, 190, 4, 110, STONE); S.reserve(-100, 100, -410, -262);
    S.rampV(-16, 16, -295, -267, 4, 0, 'z', DSTONE);
    S.box(0, 4, -372, 130, 30, 50, 0xc9bca0, { k: 'win' }); S.b.solid.box(0, 34, -372, 134, 2, 54, DSTONE);
    for (let x = -60; x <= 60; x += 12) if (x !== 0) S.cyl(x, 4, -342, 1.6, 22, 0xd9ccb0);
    S.box(0, 26, -342, 136, 4, 8, 0xc9bca0, { nb: 1 }); S.box(0, 4, -346.6, 9, 14, 1, 0x4a3020); S.b.solid.box(0, 18.4, -346.5, 12, 1, 1.2, GOLD);
    for (const sx of [-1, 1]) { S.box(sx * 78, 4, -372, 22, 44, 22, 0xb8ab90, { k: 'win' }); S.dome(sx * 78, 48, -372, 12.5, GOLD, 1.2); S.b.solid.box(sx * 78, 68, -372, 0.3, 12, 0.3, 0x3a3a3a); S.b.solid.box(sx * 78 + 2.6, 72, -372, 5, 3, 0.1, RED); }
    S.dome(0, 36, -372, 20, GOLD, 0.9); S.sign('PALACE OF THE KINGS OF ANACREON', 0, 28, -337.8, 0, 50, 2.2, { bg: '#c9bca0', fg: '#5a1414' });
    S.npc('a_steward', 9, -318, { y: 4 }); S.npc('a_soldier', -6.5, -343, { y: 4, name: 'Palace Guard' }); S.npc('a_soldier', 6.5, -343, { y: 4, name: 'Palace Guard' });
    S.slab(0, -250, 60, 30, 0xb0a084, 0.06);
    // city fill
    const pal = [0xb0a288, 0x9c8e74, 0xbcae92, 0x8f826c, 0xa39478];
    S.town(-310, -20, -420, 110, 26, pal, 5, 12, 'solid', 0x6a2a22); S.town(20, 310, -420, 110, 26, pal, 5, 12, 'solid', 0x6a2a22);
    // people
    S.crowd([[3, 128], [3, -262]], 14); S.crowd([[-3, -262], [-3, 128]], 12); S.crowd([[-50, 70], [50, 70]], 10, 0, 1.0); S.crowd([[-300, 20], [300, 20]], 12); S.crowd([[-300, -130], [300, -130]], 10);
    S.crowd([[-30, 210], [30, 250], [-40, 330]], 5); S.crowd([[-12, -300], [12, -300]], 3, 4, 0.8);
    // fields + outlying
    const r = rng(77);
    for (let i = 0; i < 40; i++) { const x = -1400 + r() * 2800, z = 520 + r() * 1300, y = S.h(x, z); if (y > -10 && Math.abs(S.h(x + 40, z) - y) < 6) S.b.solid.box(x, y + 0.6, z, 70 + r() * 60, 1.2, 50 + r() * 50, [0xb8a84a, 0x7a9a3a, 0xa08a3a, 0x5a8a3a][i % 4], r() * 3); }
    S.poi('port', 'Royal Port of Anacreon', 0, 300, 80, 20, 'Two Imperial cruisers stand in their cradles, magnificent and motionless.');
    S.poi('gate', 'The King\'s Gate', 0, 130, 16, 25, 'The Imperial eagle-and-sun was chiselled off the keystone. The new arms are carved a little too large.');
    S.poi('bazaar', 'Grand Bazaar', 0, 70, 24, 25, 'Grain, hides and cloth in abundance. Not one working instrument for sale.');
    S.poi('plant', 'Prefectural Power Station IV', -182, -56, 16, 60, 'An atomic plant, sealed. The people who understood it are gone, and the city burns coal instead.');
    S.poi('smoke', 'The Smoke Quarter', 200, -10, 40, 30, 'Chimneys and coal dust — the sound of a world going backwards with great energy.');
    S.poi('palace', 'Palace of the Kings', 0, -300, 30, 50, 'Built for an Emperor\'s Prefect. Occupied by a King. Same chair.');
    const lx = 1300, lz = -900, ly = S.h(lx, lz); S.box(lx, ly - 1, lz, 22, 8, 16, DSTONE); S.b.solid.geo(GEO.cone, lx, ly + 10.5, lz, 0x6a2a22, { sx: 15, sy: 7, sz: 12 }); S.box(lx + 16, ly - 1, lz, 6, 14, 6, STONE);
    S.poi('lodge', 'Royal Hunting Lodge', lx, lz + 20, 40, 150, 'Where the court rides out after Nyak. Trophies on every wall; nobody home until the season.');
    const rx = -1500, rz = 300, ry = S.h(rx, rz); S.box(rx, ry - 1, rz, 8, 38, 8, 0x8a8f96); S.b.solid.box(rx + 5, ry + 20, rz + 3, 14, 1, 1, 0x70757a, 0.5); S.b.solid.geo(GEO.dome, rx, ry + 37, rz, 0x9a9fa6, { sx: 9, sy: -4, sz: 9 });
    S.poi('relay', 'Dead Imperial Relay', rx, rz, 35, 150, 'A hyperwave relay tower that once tied this province to Trantor. Silent for a generation.');
    // smoke puffs
    const puffs = [];
    const pm = new THREE.MeshBasicMaterial({ color: 0x3a3632, transparent: true, opacity: 0.55, depthWrite: false });
    for (const s of S.smoke) for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 6), pm); m.userData = { s, t: i / 6 }; S.group.add(m); puffs.push(m); }
    S.updaters.push((dt) => { for (const m of puffs) { const u = m.userData; u.t = (u.t + dt * 0.06) % 1; m.position.set(u.s[0] + u.t * 60, u.s[1] + u.t * 70, u.s[2] + u.t * 14); m.scale.setScalar(3 + u.t * 16); } });
  }

  // ---------- TRANTOR ----------
  buildTrantor() {
    const S = this; S.pad = { x: 0, y: 0, z: 130, yaw: 0 };
    const M1 = 0x8f959c, M2 = 0x767c84, M3 = 0xa3a8ae, BRZ = 0x9a7a4a, DK = 0x3a3f46;
    S.reserve(-380, 380, -130, 340);
    for (const pz of [130, 240]) for (let px = -280; px <= 280; px += 80) S.padMark(px, pz, px === 0 && pz === 130 ? 'CRADLE\n12-A' : null);
    S.decoShip(-160, 130, 0.2, 1.5, 0xa0a4a8); S.decoShip(160, 240, 2.8, 1.2, 0x9a9488); S.decoShip(-240, 240, 1.4, 1.8, 0x8f9498); S.decoShip(240, 130, -0.4, 1, 0xb0a890); S.decoShip(80, 240, 0.1, 1.1, 0x8a9098);
    for (let z = 60; z >= -5; z -= 13) for (const x of [-12, 12]) { S.box(x, 0, z, 1.6, 9, 1.6, DK); S.b.glow.box(x, 9.4, z, 2, 0.8, 2, 0xffcf8a); }
    S.slab(0, 30, 20, 80, 0x9aa0a6, 0.05);
    // arrivals hall
    S.house(0, -40, 150, 60, 26, M3, { door: 's', dw: 18, dh: 10, floor: 0x9aa0a6, roof: M2 });
    S.sign('IMPERIAL PORT OF ENTRY\nSECTOR DOCK 12 · TRANTOR', 0, 18, -9.6, 0, 60, 7, { bg: '#20262c', fg: '#e8c27a' });
    for (const sx of [-1, 1]) { S.box(sx * 84, 0, -40, 14, 60, 30, M2, { k: 'win' }); S.b.glow.box(sx * 84, 60.5, -40, 3, 1, 3, 0xff4a3a); }
    // spaceship-and-sun emblem
    const em = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ transparent: true, map: canvasTex(256, 256, (g) => {
      g.strokeStyle = g.fillStyle = '#e8c27a'; g.lineWidth = 5; g.translate(128, 128);
      for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.beginPath(); g.moveTo(52, 0); g.lineTo(i % 2 ? 92 : 116, 0); g.stroke(); }
      g.beginPath(); g.arc(0, 0, 44, 0, 7); g.stroke(); g.beginPath(); g.moveTo(0, -34); g.lineTo(11, 16); g.lineTo(22, 30); g.lineTo(-22, 30); g.lineTo(-11, 16); g.closePath(); g.fill();
    }) }));
    em.position.set(0, -60 + 17, -40.9 + 0.3); S.emblem = em;
    S.box(0, 0, -34, 10, 1.1, 1.6, DK); S.npc('r_entry', 0, -36.2); S.box(40, 0, -52, 9, 1.1, 1.4, DK); S.npc('r_wright', 40, -54); S.sign('IMPERIAL DOCKYARD SERVICES', 40, 6, -69.4, 0, 14, 1.4);
    S.npc('r_guide', 14, 52);
    for (const x of [-30, -20, 20, 30]) for (const z of [-24, -46]) S.box(x, 0, z, 6, 0.5, 1.2, BRZ);
    S.lift(-55, 0, -60, 'Lift One — descend to the Concourse', { x: 0, y: -60, z: -22, yaw: 0 });
    S.lift(55, 0, -60, 'Lift Two — ascend the Observation Tower', { x: -300, y: 400, z: -252, yaw: Math.PI });
    S.sign('LIFT ONE\nCONCOURSE', -55, 5.4, -58, 0, 5, 1.6); S.sign('LIFT TWO\nOBSERVATION TOWER', 55, 5.4, -58, 0, 5, 1.6);
    S.crowd([[-4, 60], [-4, -30], [-50, -52]], 10); S.crowd([[4, -30], [4, 60]], 8); S.crowd([[-60, -20], [60, -20]], 8);
    // --- Concourse (sub-level, y = -60) ---
    const Y = -60, cz = -40;
    S.box(0, Y - 1, cz, 300, 1, 80, 0x8a9098); S.box(0, Y + 30, cz, 300, 1, 80, M2, { nb: 1 });
    S.box(0, Y, cz - 40.5, 302, 30, 1, M3, { k: 'win' }); S.box(0, Y, cz + 40.5, 302, 30, 1, M3, { k: 'win' }); S.box(-150.5, Y, cz, 1, 30, 80, M3, { k: 'win' }); S.box(150.5, Y, cz, 1, 30, 80, M3, { k: 'win' });
    for (let x = -130; x <= 130; x += 26) S.b.glow.box(x, Y + 29.9, cz, 14, 0.15, 36, 0xfff4dc);
    for (let x = -140; x <= 140; x += 20) for (const z of [cz - 28, cz + 28]) { S.box(x, Y, z, 1.6, 30, 1.6, M2); S.b.solid.box(x, Y + 7.3, z, 2.2, 0.5, 2.2, BRZ); }
    // galleries + ramps
    for (const sgn of [-1, 1]) {
      const zc = cz + sgn * 34;
      S.box(0, Y + 7.6, zc, 300, 0.4, 12, 0x9aa0a6);
      const ze = cz + sgn * 28; S.box(10, Y + 8, ze, 280, 1.1, 0.25, BRZ);
      const za = sgn < 0 ? cz - 28 : cz + 22, zb = za + 6;
      S.rampV(-140, -110, za, zb, Y + 8, Y, 'x', 0x9aa0a6); S.box(-145, Y + 7.6, (za + zb) / 2, 10, 0.4, 6, 0x9aa0a6);
      S.crowd([[-130, zc], [140, zc]], 9, Y + 8, 1.1);
      const names = sgn < 0 ? ['SECTOR TRAVEL OFFICE', 'LUXOR HOTEL · ANNEX DESK', 'BUREAU OF WEIGHTS', 'TOBACCONIST · VEGAN LEAF', 'PUBLIC NEWS TAPES'] : ['AGRICULTURAL IMPORTS', 'OUTWORLD OUTFITTERS', 'REQUISITIONS · WINDOW 9', 'TAILOR TO THE CIVIL SERVICE', 'SEALS & STAMPS'];
      names.forEach((nm, i) => { const x = -100 + i * 50; S.sign(nm, x, Y + 5.6, cz + sgn * 39.8, sgn < 0 ? 0 : Math.PI, 18, 1.5); S.box(x, Y, cz + sgn * 37.5, 16, 1.1, 1.2, DK); S.b.glow.box(x, Y + 4.2, cz + sgn * 39.7, 16, 0.3, 0.1, 0xffcf8a); });
    }
    // centre monument, lifts, benches
    S.box(0, Y, cz, 8, 2, 8, DK); S.box(0, Y + 2, cz, 3, 13, 3, BRZ); em.position.set(0, Y + 21, cz); em.rotation.y = 0; S.group.add(em);
    const em2 = em.clone(); em2.rotation.y = Math.PI; S.group.add(em2); S.b.glow.box(0, Y + 15.2, cz, 3.4, 0.3, 3.4, 0xffcf8a);
    S.lift(0, Y, -16, 'Lift One — ascend to the landing deck', { x: -55, y: 0, z: -54, yaw: Math.PI });
    for (let x = -90; x <= 90; x += 45) if (x) for (const z of [cz - 8, cz + 8]) S.box(x, Y, z, 7, 0.5, 1.2, BRZ);
    S.npc('r_trader', -100, cz + 38.9, { y: Y }); S.npc('r_foreman', 52, cz - 24, { y: Y }); S.b.glow.box(56, Y + 3, cz - 39.7, 3, 3, 0.1, 0xff5a3c); S.box(56, Y, cz - 37, 4, 1.4, 3, 0x5a4a38);
    S.house(127, cz, 36, 30, 9, M1, { door: 'w', y: Y, dw: 3.4, k: 'solid', floor: 0x70767c }); S.sign('BUREAU OF PROVINCIAL CORRESPONDENCE', 108.7, Y + 6.6, cz, -Math.PI / 2, 20, 1.5);
    S.box(124, Y, cz, 1.4, 1.1, 10, DK); S.npc('r_bureau', 126, cz, { y: Y }); for (let i = 0; i < 5; i++) S.box(138, Y, cz - 10 + i * 5, 5, 3.4, 1.2, 0x5f5648);
    S.house(-127, cz, 36, 30, 9, M1, { door: 'e', y: Y, dw: 3.4, k: 'solid', floor: 0x70767c }); S.sign('IMPERIAL LIBRARY · PUBLIC ANNEX', -108.7, Y + 6.6, cz, Math.PI / 2, 20, 1.5);
    for (let i = 0; i < 5; i++) S.box(-138, Y, cz - 10 + i * 5, 5, 3.4, 1.2, 0x5f4a38); S.npc('r_library', -120, cz + 4, { y: Y });
    S.crowd([[-100, cz - 14], [100, cz - 14]], 22, Y, 1.3); S.crowd([[100, cz + 14], [-100, cz + 14]], 22, Y, 1.3); S.crowd([[-104, cz - 21], [104, cz - 21]], 12, Y, 1.5); S.crowd([[104, cz + 21], [-104, cz + 21]], 12, Y, 1.5);
    S.crowd([[-95, cz + 33], [95, cz + 33]], 8, Y, 0.9); S.crowd([[-95, cz - 33], [95, cz - 33]], 8, Y, 0.9);
    // --- Observation tower ---
    S.box(-300, 0, -260, 60, 400, 60, M2, { k: 'win' }); S.reserve(-340, -260, -300, -220);
    for (const [x, z, sx, sz] of [[-300, -289.6, 60, 0.4], [-300, -230.4, 60, 0.4], [-329.6, -260, 0.4, 60], [-270.4, -260, 0.4, 60]]) S.box(x, 400, z, sx, 1.2, sz, BRZ);
    S.lift(-300, 400, -260, 'Lift Two — descend to the landing deck', { x: 55, y: 0, z: -54, yaw: Math.PI });
    S.npc('r_tourist', -290, -236, { y: 400 }); S.box(-310, 400, -233, 0.5, 1.5, 0.5, DK); S.b.solid.box(-310, 401.7, -233, 0.5, 0.5, 1.4, BRZ);
    // --- the endless city ---
    const r = rng(1201), pal = [M1, M2, M3, 0x858d98, 0x9c9488, 0x7d868f];
    for (let gx = -7400; gx <= 7400; gx += 185) for (let gz = -7400; gz <= 7400; gz += 185) {
      const x = gx + (r() - 0.5) * 60, z = gz + (r() - 0.5) * 60, d = Math.hypot(x, z);
      const sx = 70 + r() * 90, sz = 70 + r() * 90, q = r();
      let h = 60 + q * q * 420 + (q > 0.96 ? 500 : 0); if (d < 900) h = Math.min(h, 60 + d * 0.5);
      if (!S.isFree(x, z, Math.max(sx, sz) / 2 + 12)) { r(); continue; }
      const dark = r() < 0.14;
      S.box(x, 0, z, sx, h, sz, dark ? 0x4a4f56 : pal[(q * 97 | 0) % pal.length], { k: dark ? 'solid' : 'win' });
      if (q > 0.6) S.b.win.box(x, h + h * 0.12, z, sx * 0.5, h * 0.24, sz * 0.5, pal[(q * 31 | 0) % pal.length]);
      if (q > 0.9) { S.b.solid.box(x, h * 1.24 + 40, z, 3, 80, 3, DK); S.b.glow.box(x, h * 1.24 + 81, z, 5, 3, 5, 0xff4a3a); }
    }
    // air traffic
    const N = 500, tp = new Float32Array(N * 3), lanes = [];
    for (let i = 0; i < N; i++) { const lane = i % 10; lanes.push({ ax: lane % 2, off: (lane - 5) * 520 + 200, y: 220 + lane * 55, t: r() * 14000 - 7000, v: (lane % 4 < 2 ? 1 : -1) * (90 + r() * 60) }); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tp, 3));
    const pts = new THREE.Points(tg, new THREE.PointsMaterial({ color: 0xffe2a8, size: 2.2, sizeAttenuation: false })); pts.frustumCulled = false; S.group.add(pts);
    S.updaters.push((dt) => { for (let i = 0; i < N; i++) { const l = lanes[i]; l.t += l.v * dt; if (l.t > 7000) l.t -= 14000; if (l.t < -7000) l.t += 14000; tp[i * 3] = l.ax ? l.off : l.t; tp[i * 3 + 1] = l.y; tp[i * 3 + 2] = l.ax ? l.t : l.off; } tg.attributes.position.needsUpdate = true; });
    S.poi('deck', 'Sector Dock 12', 0, 120, 60, 20, 'One landing deck among tens of thousands. The towers begin where the pads end and do not stop.');
    S.poi('hall', 'Imperial Port of Entry', 0, -40, 28, 30, 'Every arrival on Trantor is received, recorded and filed. Yours now is too.', 0);
    S.poi('conc', 'The Concourse', 0, -40, 30, 50, 'A single hall on a single level of a single sector. There are said to be hundreds of thousands like it.', -60);
    S.poi('tower', 'Observation Tower', -300, -260, 30, 80, 'Metal to the horizon in every direction. Somewhere beyond it, a hundred square miles of open ground around the Imperial Palace — the only soil on the planet.', 400);
  }

  // ---------- procedural outpost ----------
  buildOutpost() {
    const S = this, r = rng(S.seed), e = S.env; S.pad = { x: 0, y: e.lift || 0, z: 120, yaw: 0 };
    const y0 = e.lift || 0;
    const base = new THREE.Color(e.town).multiplyScalar(1.25).getHex();
    const pal = [base, new THREE.Color(base).multiplyScalar(0.85).getHex(), 0xb0a898, 0x8f9498];
    S.b.solid.box(0, y0 + 0.05, 120, 46, 0.1, 46, 0x77797a); S.b.solid.box(0, y0 + 0.07, 120, 40, 0.06, 40, 0x86888a);
    for (const [dx, dz] of [[-21, -21], [21, -21], [-21, 21], [21, 21]]) S.b.glow.box(dx, y0 + 0.2, 120 + dz, 0.6, 0.3, 0.6, 0xffb347);
    S.reserve(-30, 30, 60, 150); S.reserve(-5, 5, -120, 60);
    S.b.solid.box(0, y0 + 0.04, -20, 8, 0.08, 170, 0x5f5f5c);
    // field office (enterable): reuse house with y offset
    const hy = y0; S.house(-22, 62, 14, 10, 4.5, pal[0], { door: 'e', y: hy, k: 'solid' });
    S.sign(S.sys.name.toUpperCase() + '\nLANDING FIELD OFFICE', -14.7, hy + 3.6, 62, Math.PI / 2, 6, 1.5);
    S.npc('g_factor', -25, 62, { y: hy, name: 'Factor of ' + S.sys.name });
    const n = 7 + (r() * 8) | 0;
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, x = side * (16 + r() * 50), z = 30 - i * (150 / n) - r() * 6, sx = 9 + r() * 10, sz = 8 + r() * 8, h = 4 + r() * 6;
      if (!S.isFree(x, z, Math.max(sx, sz) / 2)) continue;
      S.box(x, y0, z, sx, h, sz, pal[(r() * pal.length) | 0], { k: 'win' }); S.b.solid.box(x, y0 + h + 0.2, z, sx + 0.6, 0.4, sz + 0.6, 0x4a4f55);
      S.reserve(x - sx / 2 - 2, x + sx / 2 + 2, z - sz / 2 - 2, z + sz / 2 + 2);
    }
    S.box(26, y0, 70, 4, 16, 4, 0x8a8f96); S.b.glow.box(26, y0 + 16.6, 70, 1.2, 1.2, 1.2, 0xff4a3a);
    for (const z of [40, 0, -40, -80]) S.lamp(5.5, z, 5, 0xfff0c8, y0);
    S.npc('g_local', 3, -30 - r() * 30, { y: y0 });
    S.crowd([[2, 50], [2, -100]], 4, y0); S.crowd([[-2, -100], [-2, 50]], 3, y0);
    S.poi('field', S.sys.name + ' Landing Field', 0, 110, 50, 20, 'A cleared field, a lamp, and an office that still keeps Imperial hours.');
    const kinds = [['Abandoned Survey Camp', 'Tents of metal sheeting, long since stripped. Somebody scratched a tally of days on the door.'], ['Standing Stones', 'Not ruins — a boundary marker from the first land grants, each stone stamped with a faded Imperial seal.'], ['Old Relay Mast', 'A mast for the hyperwave that no longer carries anything. It hums in the wind.'], ['Crashed Freight Pod', 'An automated cargo pod that never reached the field. Its seals are intact; its contents are dust.']];
    for (let i = 0; i < 2; i++) {
      let x, z, y, tries = 0; do { const a = r() * 6.28, d = 600 + r() * 1100; x = Math.cos(a) * d; z = Math.sin(a) * d; y = S.h(x, z); } while ((y < (e.water ?? -1e9) + 2) && ++tries < 30);
      const k = kinds[(r() * kinds.length) | 0];
      if (k[0].includes('Mast')) { S.b.solid.box(x, y + 15, z, 1, 30, 1, 0x8a8f96); S.b.glow.box(x, y + 30.5, z, 1.2, 1.2, 1.2, 0xffb347); }
      else if (k[0].includes('Stones')) for (let j = 0; j < 7; j++) S.b.solid.box(x + Math.cos(j * 0.9) * 9, y + 2, z + Math.sin(j * 0.9) * 9, 1.6, 5 + (j % 3), 1.2, 0x8a857a, j);
      else if (k[0].includes('Pod')) { S.b.solid.box(x, y + 1.5, z, 5, 4, 9, 0x8a6a3a, 0.6); S.b.solid.box(x + 4, y + 0.6, z + 3, 2, 1.2, 2, 0x5a6f7a, 1.1); }
      else for (let j = 0; j < 4; j++) S.b.solid.box(x + (j % 2) * 9, y + 1.3, z + ((j / 2) | 0) * 8, 6, 2.6, 5, 0x8a8f96, j * 0.3);
      S.poi('x' + i, k[0], x, z, 32, 120, k[1]);
    }
  }

  scatter() {
    const e = this.env, r = rng(this.seed + 5);
    if (!e.amp) return;
    const wl = (e.water ?? -1e9) + 1.5;
    if (e.trees) for (let i = 0; i < 700; i++) {
      const a = r() * 6.28, d = e.flatR + 40 + r() * r() * 3200, x = Math.cos(a) * d, z = Math.sin(a) * d, y = this.h(x, z);
      if (y < wl || noise2(x / 400, z / 400, 3) < 0.45 || !this.isFree(x, z, 4)) continue;
      const s = 3 + r() * 5;
      this.b.solid.geo(GEO.cyl, x, y + s * 0.3, z, 0x4a3a2a, { sx: s * 0.07, sy: s * 0.7, sz: s * 0.07 });
      this.b.solid.geo(GEO.cone, x, y + s * 1.1, z, e.trees, { sx: s * 0.38, sy: s * 1.5, sz: s * 0.38 });
    }
    for (let i = 0; i < 220; i++) {
      const a = r() * 6.28, d = e.flatR + 20 + r() * 3500, x = Math.cos(a) * d, z = Math.sin(a) * d, y = this.h(x, z);
      if (y < wl) continue; const s = 1 + r() * r() * 9;
      this.b.solid.geo(GEO.rock, x, y + s * 0.2, z, e.pal[2], { sx: s, sy: s * (0.5 + r() * 0.6), sz: s * (0.7 + r() * 0.6), ry: r() * 6 });
    }
  }

  finalize() {
    const e = this.env;
    const add = (m) => m && this.group.add(m);
    add(this.b.solid.mesh(MAT.solid)); add(this.b.win.mesh(makeWindowMats(e.winI, this.key === 'trantor' ? 0.55 : 0.4)));
    add(this.b.glow.mesh(MAT.glow)); add(this.b.glass.mesh(MAT.glass));
    // crowd
    const r = rng(this.seed + 9); this.walkers = [];
    for (const p of this.paths) {
      const segs = []; let L = 0;
      for (let i = 0; i < p.pts.length - 1; i++) { const a = p.pts[i], b = p.pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push({ a, b, l, s: L }); L += l; }
      for (let i = 0; i < p.n; i++) this.walkers.push({ segs, L, y: p.y, s: r() * L, dir: r() < 0.5 ? 1 : -1, v: p.speed * (0.75 + r() * 0.5), off: (r() - 0.5) * 3, ph: r() * 6 });
    }
    const n = this.walkers.length;
    if (n) {
      this.wBody = new THREE.InstancedMesh(GEO.robe, new THREE.MeshLambertMaterial(), n);
      this.wHead = new THREE.InstancedMesh(GEO.head, new THREE.MeshLambertMaterial(), n);
      const c = new THREE.Color(), cols = this.key === 'anacreon' ? [0x8a3a2a, 0x6a5a3a, 0x9a8a5a, 0x4a5a3a, 0x7a1f1f, 0x5a4a6a] : this.key === 'trantor' ? [0x4a5a7a, 0x6a6f78, 0x7a6a8a, 0x3a4a5a, 0x8a8478, 0x5a6a6a, 0x9a7a4a] : [0x5a6a7a, 0x7a6a5a, 0x4a6a5a, 0x8a7a6a, 0x6a4c7a, 0x55606a];
      for (let i = 0; i < n; i++) { this.wBody.setColorAt(i, c.set(cols[(r() * cols.length) | 0])); this.wHead.setColorAt(i, c.set(SKIN[(r() * 4) | 0])); }
      this.wBody.frustumCulled = this.wHead.frustumCulled = false; this.group.add(this.wBody, this.wHead);
    }
    this.b = null;
  }

  update(dt, eye) {
    for (const u of this.updaters) u(dt);
    for (const g of this.npcs) { const dx = eye.x - g.position.x, dz = eye.z - g.position.z; if (dx * dx + dz * dz < 400) g.rotation.y = Math.atan2(dx, dz); }
    if (this.wBody) {
      const m = _m, W = this.walkers;
      for (let i = 0; i < W.length; i++) {
        const w = W[i]; w.s += w.dir * w.v * dt;
        if (w.s > w.L) { w.s = w.L; w.dir = -1; } else if (w.s < 0) { w.s = 0; w.dir = 1; }
        let sg = w.segs[0]; for (let k = w.segs.length - 1; k >= 0; k--) if (w.s >= w.segs[k].s) { sg = w.segs[k]; break; }
        const t = (w.s - sg.s) / sg.l, dx = (sg.b[0] - sg.a[0]) / sg.l, dz = (sg.b[1] - sg.a[1]) / sg.l;
        const x = lerp(sg.a[0], sg.b[0], t) - dz * w.off, z = lerp(sg.a[1], sg.b[1], t) + dx * w.off;
        _e.set(0, Math.atan2(dx * w.dir, dz * w.dir), 0); _q.setFromEuler(_e);
        w.ph += dt * 8; m.compose(_p.set(x, w.y + Math.abs(Math.sin(w.ph)) * 0.04, z), _q, _s1);
        this.wBody.setMatrixAt(i, m); this.wHead.setMatrixAt(i, m);
      }
      this.wBody.instanceMatrix.needsUpdate = true; this.wHead.instanceMatrix.needsUpdate = true;
    }
  }
  dispose() { this.group.traverse((o) => { if (o.geometry && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose(); }); }
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s1 = new THREE.Vector3(1, 1, 1);

import * as THREE from 'three';

export const G = {}; // shared game state (filled in by main.js)

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function h3(x, y, z, s) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683) ^ Math.imul(s, 2246822519);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function noise2(x, z, s = 0) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = h3(ix, 0, iz, s), b = h3(ix + 1, 0, iz, s), c = h3(ix, 0, iz + 1, s), d = h3(ix + 1, 0, iz + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm2(x, z, s = 0, o = 5) {
  let a = 0, amp = 0.5, f = 1;
  for (let i = 0; i < o; i++) { a += amp * noise2(x * f, z * f, s + i * 17); amp *= 0.5; f *= 2; }
  return a;
}
export function noise3(x, y, z, s = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(
    L(L(h3(ix, iy, iz, s), h3(ix + 1, iy, iz, s), fx), L(h3(ix, iy + 1, iz, s), h3(ix + 1, iy + 1, iz, s), fx), fy),
    L(L(h3(ix, iy, iz + 1, s), h3(ix + 1, iy, iz + 1, s), fx), L(h3(ix, iy + 1, iz + 1, s), h3(ix + 1, iy + 1, iz + 1, s), fx), fy),
    fz);
}
export function fbm3(x, y, z, s = 0, o = 5) {
  let a = 0, amp = 0.5, f = 1;
  for (let i = 0; i < o; i++) { a += amp * noise3(x * f, y * f, z * f, s + i * 13); amp *= 0.5; f *= 2; }
  return a;
}

// ---------- merged-geometry batch ----------
const _v = new THREE.Vector3(), _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(),
  _p = new THREE.Vector3(), _s = new THREE.Vector3(), _nm = new THREE.Matrix3(), _Y = new THREE.Vector3(0, 1, 0);
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

export class Batch {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.i = []; this.count = 0; }
  add(geo, matrix, color, uvFn) {
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv, base = this.count;
    _nm.getNormalMatrix(matrix); _c.set(color);
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(matrix); this.p.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize(); this.n.push(_v.x, _v.y, _v.z);
      this.c.push(_c.r, _c.g, _c.b);
      let uu = uv ? uv.getX(i) : 0, vv = uv ? uv.getY(i) : 0;
      if (uvFn) { const r = uvFn(i, uu, vv); uu = r[0]; vv = r[1]; }
      this.u.push(uu, vv);
    }
    if (geo.index) { const ix = geo.index; for (let i = 0; i < ix.count; i++) this.i.push(base + ix.getX(i)); }
    else for (let i = 0; i < pos.count; i++) this.i.push(base + i);
    this.count += pos.count;
  }
  // centre-anchored box
  box(x, y, z, sx, sy, sz, color, rotY = 0) {
    _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(_Y, rotY), _s.set(sx, sy, sz));
    this.add(UNIT_BOX, _m, color, (i, u, v) => {
      const f = i >> 2;
      if (f === 2 || f === 3) return [0.008, 0.992]; // roofs: plain wall texel, no windows
      return [u * (f < 2 ? sz : sx) / 32, v * sy / 28];
    });
  }
  geo(geometry, x, y, z, color, o = {}) {
    _q.setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0));
    _m.compose(_p.set(x, y, z), _q, _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1));
    this.add(geometry, _m, color);
  }
  mesh(material) {
    if (!this.count) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.i);
    const m = new THREE.Mesh(g, material);
    m.frustumCulled = false;
    return m;
  }
}

export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function makeWindowMats(intensity, lit = 0.45, warm = '#ffd9a0', seed = 7) {
  const r1 = rng(seed), r2 = rng(seed);
  const map = canvasTex(128, 128, (g) => {
    g.fillStyle = '#f1f1f1'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(0,0,0,0.10)'; for (let i = 0; i <= 8; i++) { g.strokeRect(0, i * 16, 128, 0.5); }
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { r1(); g.fillStyle = '#59636e'; g.fillRect(x * 16 + 4, y * 16 + 3, 8, 9); }
  }, true);
  const em = canvasTex(128, 128, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { if (r2() < lit) { g.fillStyle = warm; g.fillRect(x * 16 + 4, y * 16 + 3, 8, 9); } }
  }, true);
  map.magFilter = em.magFilter = THREE.NearestFilter;
  return new THREE.MeshLambertMaterial({ vertexColors: true, map, emissive: 0xffffff, emissiveMap: em, emissiveIntensity: intensity });
}

export const MAT = {
  solid: new THREE.MeshLambertMaterial({ vertexColors: true }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  glass: new THREE.MeshLambertMaterial({ color: 0x9fd0de, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
};

export function signMesh(text, w, h, o = {}) {
  const pw = 1024, ph = Math.max(40, Math.round(1024 * h / w));
  const tex = canvasTex(pw, ph, (g) => {
    const lw = Math.max(3, ph * 0.05), fg = o.fg || '#e8c27a', F = (n) => `600 ${n}px "Futura","Gill Sans","Trebuchet MS",sans-serif`;
    g.fillStyle = o.bg || '#1b2228'; g.fillRect(0, 0, pw, ph);
    g.strokeStyle = fg; g.lineWidth = lw; g.strokeRect(lw, lw, pw - lw * 2, ph - lw * 2);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = text.split('\n');
    let fs = Math.floor((ph - lw * 5) / lines.length * 0.82);
    g.font = F(fs);
    const mw = Math.max(...lines.map((l) => g.measureText(l).width));
    if (mw > pw - lw * 8) { fs = Math.floor(fs * (pw - lw * 8) / mw); g.font = F(fs); }
    lines.forEach((l, i) => g.fillText(l, pw / 2, ph / 2 + (i - (lines.length - 1) / 2) * fs * 1.12 + fs * 0.04));
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
}

// ---------- walking physics shared by world + ship interior ----------
// body: {x,y,z,vy,onGround}; env: {solids, ramps, terrain(x,z)|null}
// solid: {x0,x1,z0,z1,y0,y1, nb (never blocks), off}
export function moveBody(b, dx, dz, dt, env) {
  const R = 0.35, H = 1.7, STEP = 0.5;
  let nx = b.x + dx, nz = b.z + dz;
  const S = env.solids;
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      if (nx < s.x0 - R || nx > s.x1 + R || nz < s.z0 - R || nz > s.z1 + R) continue;
      if (s.off || s.nb) continue;
      if (b.y >= s.y1 - STEP || b.y + H <= s.y0) continue;
      const cx = clamp(nx, s.x0, s.x1), cz = clamp(nz, s.z0, s.z1);
      const ddx = nx - cx, ddz = nz - cz, d2 = ddx * ddx + ddz * ddz;
      if (d2 >= R * R) continue;
      if (d2 > 1e-9) { const d = Math.sqrt(d2); nx = cx + ddx / d * R; nz = cz + ddz / d * R; }
      else {
        const l = nx - s.x0, r = s.x1 - nx, n = nz - s.z0, f = s.z1 - nz, m = Math.min(l, r, n, f);
        if (m === l) nx = s.x0 - R; else if (m === r) nx = s.x1 + R; else if (m === n) nz = s.z0 - R; else nz = s.z1 + R;
      }
    }
  }
  let g = -Infinity;
  const th = env.terrain ? env.terrain(nx, nz) : null;
  if (th !== null && th <= b.y + 1.5) g = th;
  for (let i = 0; i < S.length; i++) {
    const s = S[i];
    if (nx < s.x0 || nx > s.x1 || nz < s.z0 || nz > s.z1 || s.off) continue;
    if (s.y1 <= b.y + STEP && s.y1 > g) g = s.y1;
  }
  const Rm = env.ramps;
  for (let i = 0; i < Rm.length; i++) {
    const r = Rm[i];
    if (nx < r.x0 || nx > r.x1 || nz < r.z0 || nz > r.z1) continue;
    const t = r.ax === 'x' ? (nx - r.x0) / (r.x1 - r.x0) : (nz - r.z0) / (r.z1 - r.z0);
    const h = r.yA + (r.yB - r.yA) * t;
    if (h <= b.y + STEP && h > g) g = h;
  }
  if (g === -Infinity && th !== null) g = th;
  b.x = nx; b.z = nz;
  const stick = b.onGround && b.vy <= 0;
  b.vy -= 22 * dt; b.y += b.vy * dt;
  if (g !== -Infinity && (b.y <= g || (stick && b.y - g < 0.6))) { b.y = g; b.vy = 0; b.onGround = true; }
  else b.onGround = g !== -Infinity && b.y - g < 0.06;
  return g;
}

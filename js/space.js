import * as THREE from 'three';
import { Batch, MAT, canvasTex, rng, hashStr, fbm2, fbm3, smooth, clamp } from './util.js';

export const PLANET_R = 4000;
const _v = new THREE.Vector3(), _c = new THREE.Color(), _c2 = new THREE.Color(), _m4 = new THREE.Matrix4(), _o = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

// ---------- sky dome, stars, galactic lens (shared by surface + space) ----------
export class Backdrop {
  constructor(scene) {
    this.root = new THREE.Group(); scene.add(this.root);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sp: { value: 0 }, clouds: { value: 0 }, cloudMap: { value: null }, cloudTime: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 zen; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sp; uniform float clouds; uniform sampler2D cloudMap; uniform float cloudTime; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = max(d.y, 0.0); vec3 c = mix(hor, zen, pow(h, 0.5));
          if (d.y < 0.0) c = mix(hor, hor * 0.55, min(1.0, -d.y * 4.0));
          float s = max(dot(d, sunDir), 0.0); c += sunCol * (pow(s, 12.0) * 0.22 + pow(s, 90.0) * 0.4);
          if (clouds > 0.0 && d.y > 0.025) {
            vec2 uv = d.xz / (d.y + 0.24) * 0.23 + vec2(cloudTime * 0.002, 0.0);
            float vapor = texture2D(cloudMap, uv).r;
            float cloud = smoothstep(0.41, 0.69, vapor) * smoothstep(0.025, 0.24, d.y);
            vec3 cloudColor = mix(vec3(0.50, 0.54, 0.55), vec3(0.92, 0.86, 0.74), smoothstep(0.46, 0.76, vapor) + s * 0.13);
            c = mix(c, cloudColor, cloud * clouds);
          }
          c *= (1.0 - sp); c += sunCol * (pow(s, 700.0) * 4.0 + pow(s, 60.0) * 0.15 * sp);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide, depthTest: false, depthWrite: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat); this.sky.renderOrder = -10; this.sky.frustumCulled = false; this.root.add(this.sky);
    this.starMat = new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false });
    this.stars = new THREE.Points(new THREE.BufferGeometry(), this.starMat); this.stars.renderOrder = -9; this.stars.frustumCulled = false; this.root.add(this.stars);
    const lt = canvasTex(256, 64, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, 256, 64);
      const gr = g.createRadialGradient(128, 32, 0, 128, 32, 128); gr.addColorStop(0, 'rgba(255,240,215,0.95)'); gr.addColorStop(0.15, 'rgba(230,220,255,0.45)'); gr.addColorStop(0.5, 'rgba(150,170,230,0.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.translate(0, 32); g.scale(1, 0.25); g.translate(0, -32); g.fillStyle = gr; g.fillRect(0, -96, 256, 256); g.restore();
    });
    this.lens = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: lt, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false }));
    this.lens.renderOrder = -8; this.lens.frustumCulled = false; this.root.add(this.lens);
    this.lensDir = new THREE.Vector3(); this.rim = 0; this.surfStars = 0;
  }
  setSystem(sys) {
    const r = rng(hashStr(sys.id) + 1), cd = Math.hypot(sys.x, sys.y);
    const rim = this.rim = smooth(9000, 14500, cd), toC = _v.set(-sys.x, 0, -sys.y).normalize().clone();
    const N = Math.round(2200 + 5200 * (1 - clamp(cd / 15000, 0, 1))), pos = [], col = [];
    let guard = 0;
    while (pos.length < N * 3 && guard++ < N * 30) {
      let x = r() * 2 - 1, y = (r() * 2 - 1) * (r() < 0.55 ? 0.22 : 1), z = r() * 2 - 1; const l = Math.hypot(x, y, z); if (l > 1.2 || l < 0.05) continue; x /= l; y /= l; z /= l;
      if (rim > 0 && r() < rim * 0.985 * (1 - smooth(-0.25, 0.6, x * toC.x + z * toC.z))) continue;
      pos.push(x * 880, y * 880, z * 880);
      const b = 0.25 + Math.pow(r(), 3) * 0.75, t = r(); col.push(b * (0.8 + t * 0.2), b * 0.88, b * (1 - t * 0.25));
    }
    const g = this.stars.geometry; g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.lensDir.copy(toC);
  }
  // surface: env + altitude mix (0 ground .. 1 space);  space: env = null
  set(env, alt) {
    const sp = env ? alt : 1;
    this.sky.visible = !!env;
    if (env) { const u = this.skyMat.uniforms; u.zen.value.set(env.zen); u.hor.value.set(env.hor); u.sunDir.value.set(...env.sun).normalize(); u.sunCol.value.set(env.sunCol); u.sp.value = alt;
      u.clouds.value = env.clouds ? 1 - alt : 0;
      if (env.clouds && !u.cloudMap.value) {
        u.cloudMap.value = canvasTex(256, 256, (ctx, w, h) => {
          const pixels = ctx.createImageData(w, h);
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const u = x / w, v = y / h, k = (x + y * w) * 4;
            const a = u * 6, b = v * 6;
            const top = fbm2(a, b, 70) * (1 - u) + fbm2(a - 6, b, 70) * u;
            const bottom = fbm2(a, b - 6, 70) * (1 - u) + fbm2(a - 6, b - 6, 70) * u;
            const value = 255 * (top * (1 - v) + bottom * v);
            pixels.data[k] = pixels.data[k + 1] = pixels.data[k + 2] = value;
            pixels.data[k + 3] = 255;
          }
          ctx.putImageData(pixels, 0, 0);
        }, true);
        u.cloudMap.value.colorSpace = THREE.NoColorSpace;
      }
      u.cloudTime.value = performance.now() / 1000;
    }
    const so = env ? Math.max(env.stars, sp) : 1; this.starMat.color.setScalar(so); this.stars.visible = so > 0.02;
    const lo = this.rim * (env ? Math.max(env.lens ? 0.35 : 0, sp) : 1);
    this.lens.visible = lo > 0.02; this.lens.material.color.setScalar(lo * 0.8);
    _v.copy(this.lensDir); if (env) { _v.y += 0.3; _v.normalize(); }
    this.lens.position.copy(_v).multiplyScalar(860); this.lens.scale.set(900, 300, 1);
    this.lens.quaternion.setFromRotationMatrix(_m4.lookAt(_o, this.lens.position, _up));
  }
  follow(cam) { this.root.position.copy(cam.position); }
}

// ---------- planet textures ----------
const PT = {
  cold: { sea: 0.5, ocean: [0x16324f, 0x2a5a80], land: [0x4f6b4a, 0x8a8468, 0x9a9488], ice: 0.6, cloud: 0.5, atmo: '150,190,255' },
  warm: { sea: 0.48, ocean: [0x12406e, 0x2a6aa0], land: [0x6f8f45, 0xa98b55, 0x8a6a4a], ice: 0.9, cloud: 0.45, atmo: '140,190,255' },
  arid: { sea: 0.22, ocean: [0x6a4a30, 0x805c3a], land: [0xc9a36a, 0xb07a4a, 0x8a5a3a], ice: 0.97, cloud: 0.15, atmo: '255,200,150' },
  ice: { sea: 0.36, ocean: [0x3a5a78, 0x5a84a4], land: [0xdfe8ee, 0xb9ccd8, 0x8fa4b4], ice: 0.5, cloud: 0.4, atmo: '190,220,255' },
  jungle: { sea: 0.42, ocean: [0x10403f, 0x1f6a5a], land: [0x2f6b3a, 0x4d7a3a, 0x6a7a48], ice: 0.98, cloud: 0.6, atmo: '150,230,200' },
  rock: { sea: 0, ocean: [0, 0], land: [0x6e6860, 0x857a6c, 0x4a4642], ice: 2, cloud: 0, atmo: '200,170,190' },
  ocean: { sea: 0.63, ocean: [0x0f3f7a, 0x1f6fae], land: [0xd6c9a0, 0x5f9a5a, 0x7a8a60], ice: 0.92, cloud: 0.5, atmo: '140,200,255' },
  city: { atmo: '190,205,225', cloud: 0.2 },
};
function sphereTex(w, h, fn) {
  return canvasTex(w, h, (g) => {
    const im = g.createImageData(w, h), d = im.data;
    for (let j = 0; j < h; j++) { const lat = (0.5 - (j + 0.5) / h) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
      for (let i = 0; i < w; i++) { const lon = (i / w) * Math.PI * 2, o = (j * w + i) * 4; fn(Math.cos(lon) * cl, sl, Math.sin(lon) * cl, d, o); } }
    g.putImageData(im, 0, 0);
  });
}
function planetTextures(sys) {
  const seed = hashStr(sys.id) & 255, P = PT[sys.type];
  let map, emissive = null;
  if (sys.type === 'city') {
    const r = rng(12);
    map = canvasTex(1024, 512, (g) => {
      g.fillStyle = '#7c828a'; g.fillRect(0, 0, 1024, 512);
      for (let i = 0; i < 5000; i++) { const v = 95 + (r() * 70) | 0; g.fillStyle = `rgb(${v},${v + 4},${v + 10})`; g.fillRect(r() * 1024, r() * 512, 4 + r() * 26, 3 + r() * 16); }
      g.strokeStyle = 'rgba(200,205,215,0.35)'; g.lineWidth = 1; for (let i = 0; i < 64; i++) { g.strokeRect(i * 16, -1, 0.5, 514); if (i < 32) g.strokeRect(-1, i * 16, 1026, 0.5); }
      g.fillStyle = '#4f7a4a'; g.fillRect(500, 250, 5, 3); // the palace grounds
    });
    emissive = canvasTex(1024, 512, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 512);
      for (let i = 0; i < 9000; i++) { g.fillStyle = r() < 0.8 ? '#ffd9a0' : '#bfe0ff'; g.fillRect(r() * 1024, 30 + r() * 452, 1, 1); }
      g.fillStyle = 'rgba(255,217,160,0.5)'; for (let i = 0; i < 64; i += 2) g.fillRect(i * 16, 40, 1, 432);
    });
  } else {
    map = sphereTex(1024, 512, (x, y, z, d, o) => {
      const n = fbm3(x * 1.9 + 7, y * 1.9, z * 1.9, seed, 5), n2 = fbm3(x * 6, y * 6, z * 6, seed + 40, 3);
      if (n < P.sea) _c.set(P.ocean[0]).lerp(_c2.set(P.ocean[1]), smooth(P.sea - 0.18, P.sea, n));
      else { const t = (n - P.sea) / (1 - P.sea) * 2.4 + (n2 - 0.5) * 0.3; _c.set(P.land[0]).lerp(_c2.set(P.land[1]), smooth(0.05, 0.5, t)).lerp(_c2.set(P.land[2]), smooth(0.5, 1, t)); }
      _c.lerp(_c2.set(0xeef2f5), smooth(P.ice - 0.02, P.ice + 0.03, Math.abs(y) + (n2 - 0.5) * 0.25));
      _c.convertLinearToSRGB(); d[o] = _c.r * 255; d[o + 1] = _c.g * 255; d[o + 2] = _c.b * 255; d[o + 3] = 255;
    });
  }
  const clouds = P.cloud ? sphereTex(512, 256, (x, y, z, d, o) => {
    const n = fbm3(x * 2.6 + 3, y * 4.2, z * 2.6, seed + 99, 5); d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = smooth(0.62 - P.cloud * 0.25, 0.75, n) * 235;
  }) : null;
  return { map, emissive, clouds, atmo: P.atmo };
}
function glowTex(stops) {
  return canvasTex(256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); stops.forEach(([p, c]) => gr.addColorStop(p, c)); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); });
}
let rockTex;

// ---------- a star system seen from space ----------
export class SpaceScene {
  constructor(sys) {
    this.sys = sys; this.group = new THREE.Group(); const r = rng(hashStr(sys.id) + 3), R = PLANET_R;
    this.sunDir = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.5, r() - 0.5).normalize();
    this.launchDir = this.sunDir.clone().add(new THREE.Vector3(0.25, 0.35, -0.2)).normalize();
    const T = planetTextures(sys);
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 44), new THREE.MeshLambertMaterial({ map: T.map, emissiveMap: T.emissive, emissive: T.emissive ? 0xffffff : 0, emissiveIntensity: 0.9 }));
    this.group.add(this.planet);
    if (T.clouds) { this.clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 48, 32), new THREE.MeshLambertMaterial({ map: T.clouds, transparent: true, depthWrite: false })); this.group.add(this.clouds); }
    const a = T.atmo;
    const at = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex([[0, `rgba(${a},0)`], [0.66, `rgba(${a},0)`], [0.72, `rgba(${a},0.75)`], [0.78, `rgba(${a},0.22)`], [0.9, `rgba(${a},0)`], [1, `rgba(${a},0)`]]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    at.scale.setScalar(R * 2 / 0.725); this.group.add(at);
    // sun
    const sc = new THREE.Color(sys.star);
    this.sunPos = this.sunDir.clone().multiplyScalar(700000);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(26000, 24, 16), new THREE.MeshBasicMaterial({ color: sc.clone().lerp(new THREE.Color(0xffffff), 0.6) })); sun.position.copy(this.sunPos); this.group.add(sun);
    const cs = `${(sc.r ** 0.45 * 255) | 0},${(sc.g ** 0.45 * 255) | 0},${(sc.b ** 0.45 * 255) | 0}`;
    const sg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex([[0, `rgba(255,255,255,1)`], [0.08, `rgba(${cs},0.9)`], [0.25, `rgba(${cs},0.25)`], [1, `rgba(${cs},0)`]]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sg.scale.setScalar(420000); sg.position.copy(this.sunPos); this.group.add(sg);
    // moons
    this.bodies = [];
    rockTex ||= sphereTex(256, 128, (x, y, z, d, o) => { const n = fbm3(x * 3, y * 3, z * 3, 5, 5), v = 90 + n * 150; d[o] = v; d[o + 1] = v * 0.97; d[o + 2] = v * 0.93; d[o + 3] = 255; });
    for (let i = 0; i < (sys.moons || 0); i++) {
      const rad = 600 + r() * 800, d = 19000 + i * 15000 + r() * 6000, a2 = r() * 6.28;
      const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 32, 20), new THREE.MeshLambertMaterial({ map: rockTex, color: [0xffffff, 0xd8c8b0, 0xb8c4d0][(r() * 3) | 0] }));
      m.position.set(Math.cos(a2) * d, (r() - 0.5) * 6000, Math.sin(a2) * d); this.group.add(m);
      this.bodies.push({ pos: m.position, r: rad, name: sys.name + (sys.moons > 1 ? ' — moon ' + 'ab'[i] : ' — moon') });
    }
    // station
    if (sys.station) {
      const sd = this.launchDir.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9)).normalize();
      const B = { solid: new Batch(), glow: new Batch() }, G1 = 0xb8bcc0, G2 = 0x7f858c;
      B.solid.geo(new THREE.TorusGeometry(170, 20, 10, 44), 0, 0, 0, G1);
      B.solid.geo(new THREE.CylinderGeometry(34, 34, 210, 18), 0, 0, 0, G2, { rx: Math.PI / 2 });
      B.solid.geo(new THREE.CylinderGeometry(52, 34, 40, 18), 0, 0, 120, G1, { rx: Math.PI / 2 });
      for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2; B.solid.box(Math.cos(an) * 95, Math.sin(an) * 95, 0, i % 2 ? 10 : 150, i % 2 ? 150 : 10, 10, G2); }
      for (let i = 0; i < 28; i++) { const an = i / 28 * 6.283; B.glow.box(Math.cos(an) * 191, Math.sin(an) * 191, 0, 5, 5, 9, i % 7 ? 0xffe2a8 : 0x4fd6c8); }
      B.solid.box(0, 0, -150, 4, 4, 110, G2); B.solid.box(0, 0, -190, 150, 2, 46, 0x24427a); B.solid.box(0, 0, -190, 2, 150, 46, 0x24427a);
      B.glow.box(0, 0, 141, 30, 30, 2, 0xffb347); B.glow.box(60, 0, 130, 4, 4, 4, 0x4fff7a); B.glow.box(-60, 0, 130, 4, 4, 4, 0xff4a3a);
      this.station = new THREE.Group(); this.station.add(B.solid.mesh(MAT.solid), B.glow.mesh(MAT.glow));
      this.station.position.copy(sd).multiplyScalar(R + 2600); this.station.lookAt(0, 0, 0); this.group.add(this.station);
      this.stationName = sys.hand === 'trantor' ? 'Imperial Orbital Dock' : sys.hand === 'anacreon' ? 'Royal Naval Station' : sys.hand === 'terminus' ? 'Terminus Relay Station' : sys.name + ' Orbital';
    }
    // traffic
    const sb = new Batch();
    sb.box(0, 0, 0, 5, 4, 16, 0xc8c2b0); sb.box(0, 0, 10, 3, 2.5, 5, 0xc8c2b0); sb.box(-4.5, 0, -3, 2.4, 2.4, 9, 0x70757a); sb.box(4.5, 0, -3, 2.4, 2.4, 9, 0x70757a); sb.box(0, 4, -5, 0.4, 4, 5, 0xc4532a);
    const sgeo = sb.mesh(MAT.solid).geometry, eg = new THREE.MeshBasicMaterial({ color: 0xffa860 });
    this.traffic = [];
    const nT = sys.hand === 'trantor' ? 14 : sys.hand ? 6 : 2 + ((r() * 3) | 0);
    for (let i = 0; i < nT; i++) {
      const m = new THREE.Mesh(sgeo, MAT.solid); m.scale.setScalar(2.5 + r() * 3);
      const e = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 5), eg); e.position.set(0, 0, -9); m.add(e);
      const ax = new THREE.Vector3(r() - 0.5, r() - 0.5 + 0.8, r() - 0.5).normalize(), u = new THREE.Vector3(1, 0, 0).cross(ax).normalize(), w = ax.clone().cross(u);
      this.traffic.push({ m, u, w, rad: R + 900 + r() * 5200, a: r() * 6.28, v: (r() < 0.5 ? 1 : -1) * (90 + r() * 110) }); this.group.add(m);
    }
  }
  update(dt) {
    if (this.clouds) this.clouds.rotation.y += dt * 0.004;
    if (this.station) this.station.rotateZ(dt * 0.07);
    for (const t of this.traffic) {
      t.a += t.v / t.rad * dt;
      const p = (a) => _v.copy(t.u).multiplyScalar(Math.cos(a) * t.rad).addScaledVector(t.w, Math.sin(a) * t.rad);
      t.m.position.copy(p(t.a)); t.m.lookAt(p(t.a + Math.sign(t.v) * 0.01));
    }
  }
  dispose() { this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && o.material.map !== rockTex) o.material.map.dispose(); }); }
}

// ---------- hyperspace streaks (parented to the ship) ----------
export class Tunnel {
  constructor() {
    const N = this.N = 1100, r = rng(5);
    this.d = []; for (let i = 0; i < N; i++) this.d.push({ a: r() * 6.283, r: 14 + r() * r() * 420, z: -1500 + r() * 1800, c: r() });
    this.pos = new Float32Array(N * 6); const col = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) { const c = this.d[i].c; col.set([0.5 + c * 0.5, 0.6 + c * 0.3, 1, 0.1, 0.12, 0.3], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.mesh = new THREE.LineSegments(g, this.mat); this.mesh.frustumCulled = false; this.mesh.visible = false;
  }
  update(dt, k) {
    this.mesh.visible = k > 0.01; if (!this.mesh.visible) return;
    const sp = 150 + 3200 * k, len = 3 + 420 * k * k; this.mat.opacity = Math.min(1, k * 1.6);
    for (let i = 0; i < this.N; i++) {
      const d = this.d[i]; d.z += sp * dt; if (d.z > 300) d.z -= 1800;
      const x = Math.cos(d.a) * d.r, y = Math.sin(d.a) * d.r + 2.7;
      this.pos.set([x, y, d.z, x, y, d.z - len], i * 6);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

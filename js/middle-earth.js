import * as THREE from 'three';
import { fbm2, lerp, rng, smooth } from './util.js';

export const REGIONS = [
  { name: 'The Shire', field: 'Shire Landing Field', x: 0, z: 120, y: 0, detail: 'Hobbiton, Bag End, and the Old Forest' },
  { name: 'Lindon', field: 'Grey Havens', x: -1940, z: -720, y: 8, detail: 'Elven quays on the western shore' },
  { name: 'Bree-land', field: 'Bree', x: 1010, z: -410, y: 16, detail: 'A walled crossroads and the Prancing Pony' },
  { name: 'The Trollshaws', field: 'Rivendell', x: 1740, z: -1660, y: 30, detail: 'Elven halls beneath the Misty Mountains' },
  { name: 'Rohan', field: 'Edoras', x: 2840, z: 1070, y: 26, detail: 'The Golden Hall above the grasslands' },
  { name: 'Westfold', field: 'Helm’s Deep', x: 2200, z: 1970, y: 24, detail: 'The Hornburg and its wall across the valley' },
  { name: 'Gondor', field: 'Pelennor Landing Field', x: 4030, z: 2940, y: 18, detail: 'Minas Tirith, the seven-tier White City' },
  { name: 'Mordor', field: 'Gorgoroth Survey Field', x: 5680, z: 2390, y: 20, detail: 'Mount Doom beyond the ash plain' },
].map(region => ({ ...region, yaw: 0 }));

export function middleEarthHeight(x, z) {
  const river = -64 + 65 * Math.sin(x / 290) ** 3;
  const bank = smooth(16, 60, Math.abs(z - river));
  const shire = 1 - smooth(450, 850, Math.hypot(x, z));
  const hills = fbm2(x / 270, z / 270, 21, 4) * 100;
  const local = smooth(185, 470, Math.hypot(x, z));
  const misty = Math.exp(-(((x - 2210) / 550) ** 2)) * (1 - smooth(-700, 500, z));
  const white = Math.exp(-(((z - 2240 + 0.16 * (x - 3350)) / 340) ** 2)) * smooth(2350, 2900, x) * (1 - smooth(3950, 4610, x));
  const peaks = fbm2(x / 410, z / 530, 18, 5);
  const plain = hills * local + peaks * (misty * 1050 + white * 1060);
  let height = lerp(plain, -8 * (1 - bank) + bank * hills * local, shire);
  height -= 112 * (1 - smooth(-2700, -2070, x + 95 * Math.sin(z / 470)));
  const volcano = Math.hypot(x - 6000, z - 1920);
  height += (1 - smooth(76, 550, volcano)) * 375 - (1 - smooth(26, 100, volcano)) * 78;
  const anduin = Math.abs(x - (4770 + 120 * Math.sin(z / 520)));
  height = lerp(height, -8, (1 - smooth(25, 105, anduin)) * smooth(1000, 1750, z));
  for (let i = 1; i < REGIONS.length; i++) {
    const region = REGIONS[i];
    const distance = Math.hypot(x - region.x, z - (region.z - (region.name === 'Gondor' ? 100 : 0)));
    height = lerp(height, region.y, 1 - smooth(region.name === 'Gondor' ? 342 : 165, region.name === 'Gondor' ? 435 : 280, distance));
  }
  return height;
}

const stone = 0xb8ad98, chalk = 0xd7ccba, timber = 0x51392a, slate = 0x545a60, gold = 0xb99348;
const roof = new THREE.CylinderGeometry(0.3, 1, 1, 4, 1, false, Math.PI / 4);
const rock = new THREE.DodecahedronGeometry(1);
const leaf = new THREE.IcosahedronGeometry(1, 1);
const arch = new THREE.TorusGeometry(1, 0.13, 7, 18, Math.PI);

function road(S, points, width, color) {
  const positions = [], indices = [];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const length = Math.hypot(bx - ax, bz - az), steps = Math.ceil(length / 7);
    const ox = (bz - az) * width / (2 * length), oz = (ax - bx) * width / (2 * length);
    const first = positions.length / 3;
    for (let j = 0; j <= steps; j++) {
      const x = lerp(ax, bx, j / steps), z = lerp(az, bz, j / steps);
      for (const side of [-1, 1]) {
        const px = x + side * ox, pz = z + side * oz;
        positions.push(px, S.h(px, pz) + 0.12, pz);
      }
      if (j) {
        const a = first + j * 2;
        const height = n => positions[n * 3 + 1];
        const rise = Math.max(Math.abs(height(a) - height(a - 2)), Math.abs(height(a + 1) - height(a - 1)));
        if (rise < 4.5) indices.push(a - 2, a, a - 1, a - 1, a, a + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  S.b.solid.geo(g, 0, 0, 0, color);
  g.dispose();
}

function roofedHall(S, x, y, z, w, d, h, wall, tile, doorWidth = 3) {
  S.house(x, z, w, d, h, wall, { y, k: 'solid', dw: doorWidth, dh: h * 0.65, roof: tile, floor: stone });
  S.b.solid.geo(roof, x, y + h + 2.3, z, tile, { sx: w * 0.77, sy: 5, sz: d * 0.77 });
  for (const side of [-1, 1]) {
    S.box(x + side * (doorWidth / 2 + 0.4), y, z + d / 2, 0.45, h * 0.72, 0.55, timber);
    S.b.glow.box(x + side * w * 0.33, y + h * 0.59, z + d / 2 + 0.025, 0.65, 1.1, 0.09, 0xb98c51);
  }
}

function bastion(S, x, z, y, size, height, color) {
  S.box(x, y, z, size, height, size, color);
  S.box(x, y + height - 0.45, z, size + 0.75, 0.62, size + 0.75, chalk);
  for (const face of [-1, 1]) for (const off of [-0.35, 0, 0.35]) {
    S.b.solid.box(x + size * off, y + height + 0.6, z + face * size * 0.48, size * 0.19, 1.3, 0.54, color);
    S.b.solid.box(x + face * size * 0.48, y + height + 0.6, z + size * off, 0.54, 1.3, size * 0.19, color);
  }
}

function minasTirith(S, region) {
  const { x, y, z } = region, B = S.b.solid;
  const front = z - 166, tierHeight = 9, tierDepth = 28;
  const gateX = (tier) => x + (tier === 0 ? 0 : tier % 2 ? -13 : 13);
  for (let tier = 0; tier < 7; tier++) {
    const level = y + tier * tierHeight, face = front - tier * tierDepth;
    const half = 106 - tier * 12, rear = front - 223, centerZ = (face + rear) / 2;
    const gate = gateX(tier), gap = tier === 0 ? 7 : 4.7;
    const wall = tier === 0 ? 0x606063 : chalk;
    if (tier) S.box(x, y - 0.15, centerZ, half * 2, level - y + 0.15, face - rear, stone);
    else S.slab(x, centerZ, half * 2, face - rear, 0xa9a08c, level + 0.06);
    for (const [a, b] of [[x - half, gate - gap], [gate + gap, x + half]]) {
      S.box((a + b) / 2, level, face, b - a, 4.5, 1.8, wall);
      S.box((a + b) / 2, level + 4.5, face, b - a, 0.38, 2.05, chalk);
      for (let col = a + 1.1; col < b - 0.8; col += 2.6) B.box(col, level + 5.36, face, 0.95, 1, 1.25, wall);
      for (let col = a + 2; col < b - 1; col += 3.2) B.box(col, level + 2.1, face + 0.92, 0.038, 3.9, 0.025, 0xa39a88);
    }
    for (const side of [-1, 1]) {
      S.box(x + side * half, level, centerZ, 1.8, 4.3, face - rear, wall);
      bastion(S, x + side * (half - 4), face - 2, level, tier ? 6 : 9, tier ? 7 : 12, wall);
      if (tier < 6) roofedHall(S, x + side * (half - 16), level, face - 16, 12, 12, 5.6, chalk, slate);
      if (tier < 6) S.lamp(x + side * 24, face - 7, 3.2, 0xffc884, level);
    }
    S.box(x, level, rear, half * 2, 4.3, 1.8, wall);
    B.geo(arch, gate, level + 2.7, face + 1.04, chalk, { sx: gap, sy: 2.2, sz: 3.4 });
    if (tier === 0) {
      for (const side of [-1, 1]) bastion(S, gate + side * 10.4, face, level, 5, 11, wall);
      S.sign('MINAS TIRITH · GREAT GATE', x, level + 7.2, face + 2.8, 0, 12, 1.4);
      S.poi('great-gate', 'Great Gate of Minas Tirith', x, face + 6, 16, 60, 'The dark outer wall shelters six pale circles rising toward the Citadel.', level);
    }
    if (tier < 6) {
      const next = gateX(tier + 1), top = face - tierDepth;
      S.rampV(next - 4.2, next + 4.2, top - 0.25, face - 5, level + tierHeight, level, 'z', 0xbdb09c);
      for (const side of [-1, 1]) for (let i = 1; i < 6; i++) {
        const t = i / 6;
        B.box(next + side * 4.05, level + tierHeight * t + 0.48, lerp(face - 5, top, t), 0.25, 0.95, 0.25, chalk);
      }
    }
  }
  const top = y + 6 * tierHeight, courtZ = front - 186;
  S.slab(x, courtZ, 31, 22, 0xdbd2bc, top + 0.07);
  S.cyl(x - 12, top, courtZ - 4, 3.1, 0.48, 0xc2baad);
  S.cyl(x - 12, top + 0.46, courtZ - 4, 2.56, 0.06, 0x659294);
  S.cyl(x + 10, top, courtZ - 4, 0.44, 6.6, 0xd5d1bd);
  const branch = new THREE.CylinderGeometry(0.09, 0.29, 1, 7);
  for (let i = 0; i < 9; i++) {
    const angle = i * 2.4, spread = 1.2 + (i % 3) * 0.55;
    B.geo(branch, x + 10 + Math.cos(angle) * spread * 0.55, top + 4.2 + i % 3 * 0.43,
      courtZ - 4 + Math.sin(angle) * spread * 0.55, chalk, { sy: 3.5, ry: -angle, rz: -0.68 });
  }
  const towerZ = front - 207;
  roofedHall(S, x, top, towerZ, 21, 18, 9, chalk, slate, 5);
  bastion(S, x, towerZ - 2.4, top + 9, 8.2, 31, chalk);
  S.cyl(x, top + 39, towerZ - 2.4, 2.5, 8, chalk);
  B.geo(roof, x, top + 51, towerZ - 2.4, slate, { sx: 3.5, sy: 8, sz: 3.5 });
  S.poi('citadel', 'Citadel and White Tree', x + 7, courtZ, 14, 120, 'The White Tree stands beside the fountain below the Tower of Ecthelion. The Pelennor spreads out below.', top);
  S.npc('g_local', x - 15, courtZ + 3, { y: top, name: 'Guard of the Citadel' });
  S.npc('g_local', x + 18, front - 7, { y, name: 'Keeper of the Great Gate' });
  road(S, [[x, z - 26], [x, front + 2]], 13, 0xaaa08a);
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const px = x + side * (32 + i * 19), pz = front + 28 + (i % 2) * 35;
    S.slab(px, pz, 15, 25, i % 2 ? 0x858851 : 0x9b9356, y + 0.045);
    for (let row = -2; row <= 2; row++) B.box(px + row * 2.6, y + 0.11, pz, 1.2, 0.18, 24, 0x747a45);
  }
  branch.dispose();
}

export function buildMiddleEarth(S) {
  const B = S.b.solid, r = rng(S.seed + 284);
  S.destinations = REGIONS;
  for (const region of REGIONS.slice(1)) {
    const { x, y, z, field, detail } = region;
    S.slab(x, z, 44, 44, 0x79786a, y + 0.07);
    for (const dx of [-20, 20]) for (const dz of [-20, 20]) S.b.glow.box(x + dx, y + 0.24, z + dz, 0.65, 0.26, 0.65, 0xffb36a);
    S.sign(field.toUpperCase(), x + 16, y + 2.6, z - 23, 0, 11, 1.35, { bg: '#474335' });
    S.poi(field.toLowerCase().replace(/[^a-z]+/g, '-'), field, x, z - 36, 52, 35, detail + '.', y);
    if (region.name !== 'Gondor' && region.name !== 'Mordor') road(S, [[x, z - 20], [x, z - 135]], 6, 0x988970);
  }

  const [, havens, bree, rivendell, rohan, westfold, gondor, mordor] = REGIONS;
  road(S, [[27, -136], [300, -192], [665, -291], [1010, -440], [1340, -810], [1740, -1690]], 4.5, 0x9c8a65);
  road(S, [[2200, 1940], [2470, 1710], [2840, 1040], [3240, 1420], [4210, 1450], [4490, 1690], [4500, 2680], [4300, 2890], [4030, 2914]], 6, 0xa09373);
  for (const side of [-1, 1]) {
    roofedHall(S, havens.x + side * 25, havens.y, havens.z - 67, 20, 20, 8, chalk, 0x52716b, 4);
    bastion(S, havens.x + side * 49, havens.z - 91, havens.y, 7, 18, chalk);
    S.box(havens.x - 83, havens.y - 4, havens.z + side * 32, 88, 4, 6, timber);
    for (let i = 0; i < 7; i++) S.cyl(havens.x - 45 - i * 12, havens.y - 11, havens.z + side * 32, 0.55, 12, timber);
  }
  S.poi('quays', 'Quays of Mithlond', havens.x - 49, havens.z + 28, 18, 45, 'The western light falls across the Grey Havens.', havens.y);

  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    roofedHall(S, bree.x + side * (13 + i % 2 * 16), bree.y, bree.z - 45 - i * 19, 12, 11, 5.5, i % 2 ? stone : 0xac936b, timber);
  }
  S.sign('THE PRANCING PONY', bree.x + 13, bree.y + 4.9, bree.z - 39.35, 0, 8, 1.1);
  S.npc('g_factor', bree.x + 13, bree.z - 43, { y: bree.y, name: 'Innkeeper of Bree' });
  for (const side of [-1, 1]) S.box(bree.x + side * 21, bree.y, bree.z - 30, 29, 2.4, 0.8, timber);

  for (let i = -1; i <= 1; i++) {
    roofedHall(S, rivendell.x + i * 26, rivendell.y, rivendell.z - 82 - Math.abs(i) * 10, 21, 24, 8, chalk, 0x56756d, 4);
    B.geo(arch, rivendell.x + i * 26, rivendell.y + 4, rivendell.z - 69 - Math.abs(i) * 10, gold, { sx: 4.5, sy: 4.4, sz: 1.6 });
  }
  for (const side of [-1, 1]) for (let i = 0; i < 10; i++) {
    const px = rivendell.x + side * (53 + r() * 30), pz = rivendell.z - 78 + (r() - 0.5) * 88;
    B.geo(rock, px, rivendell.y - 4, pz, 0x737d76, { sx: 9 + r() * 12, sy: 12 + r() * 25, sz: 12, ry: r() * 6 });
  }

  const hallZ = rohan.z - 101;
  S.box(rohan.x, rohan.y, hallZ, 45, 6, 33, stone);
  S.rampV(rohan.x - 4, rohan.x + 4, hallZ + 16, hallZ + 47, rohan.y + 6, rohan.y, 'z', stone);
  roofedHall(S, rohan.x, rohan.y + 6, hallZ, 28, 25, 10, timber, gold, 5);
  S.sign('MEDUSELD', rohan.x, rohan.y + 14, hallZ + 12.7, 0, 8, 1);
  S.poi('golden-hall', 'Golden Hall of Meduseld', rohan.x, hallZ + 11, 13, 55, 'A gilded roof crowns the timber hall of Edoras.', rohan.y + 6);
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) roofedHall(S, rohan.x + side * (18 + i * 8), rohan.y, rohan.z - 42 - i * 10, 9, 9, 4, timber, 0x928054);

  const wallZ = westfold.z - 95;
  for (const side of [-1, 1]) {
    S.box(westfold.x + side * 34, westfold.y, wallZ, 57, 8, 4, stone);
    bastion(S, westfold.x + side * 11, wallZ, westfold.y, 8, 15, stone);
    bastion(S, westfold.x + side * 61, wallZ - 5, westfold.y, 11, 14, stone);
    for (let i = 0; i < 15; i++) B.box(westfold.x + side * (7 + i * 3.7), westfold.y + 8.6, wallZ + 1.7, 1.4, 1.2, 0.7, stone);
  }
  roofedHall(S, westfold.x, westfold.y, wallZ - 32, 26, 21, 10, stone, slate, 5);
  S.poi('hornburg', 'The Hornburg', westfold.x, wallZ - 16, 20, 55, 'The fortress guards a narrow approach into Helm’s Deep.', westfold.y);
  minasTirith(S, gondor);

  const craterX = 6000, craterZ = 1920, craterY = S.h(craterX, craterZ);
  for (let i = 0; i < 42; i++) {
    const angle = r() * Math.PI * 2, d = r() * 74;
    const x = craterX + Math.cos(angle) * d, z = craterZ + Math.sin(angle) * d;
    S.b.glow.box(x, Math.max(craterY, S.h(x, z)) + 0.11, z, 1 + r() * 5, 0.1, 3 + r() * 8, i % 3 ? 0xe46124 : 0xffa33a, angle);
  }
  S.poi('mount-doom', 'Mount Doom', craterX, craterZ, 100, 85, 'Glowing fissures cut across the crater above the plain of Gorgoroth.');
  for (let i = 0; i < 360; i++) {
    const x = mordor.x + (r() - 0.4) * 1550, z = mordor.z + (r() - 0.6) * 1600;
    if (Math.hypot(x - mordor.x, z - mordor.z) < 44) continue;
    const s = 1 + r() ** 2 * 9;
    B.geo(rock, x, S.h(x, z) + s * 0.12, z, 0x49423f, { sx: s, sy: s * 0.46, sz: s * 0.7, ry: r() * 6 });
  }
  for (const region of [havens, bree, rivendell, rohan, westfold, gondor]) {
    for (let i = 0; i < 95; i++) {
      const angle = r() * Math.PI * 2, d = 185 + r() * 490;
      const x = region.x + Math.cos(angle) * d, z = region.z + Math.sin(angle) * d, y = S.h(x, z);
      if (y < 0 || (region === gondor && Math.abs(x - gondor.x) < 120 && z < gondor.z)) continue;
      const h = 4 + r() * 11;
      B.box(x, y + h * 0.38, z, h * 0.1, h * 0.8, h * 0.09, timber, angle);
      for (let j = 0; j < 3; j++) B.geo(leaf, x + (j - 1) * h * 0.15, y + h * (0.7 + r() * 0.23), z, [0x465d35, 0x586b3c, 0x68774a][j],
        { sx: h * 0.25, sy: h * 0.32, sz: h * 0.23, ry: angle + j });
    }
  }
}

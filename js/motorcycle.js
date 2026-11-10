import * as THREE from 'three';
import { clamp, moveBody } from './util.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const tire = new THREE.TorusGeometry(0.37, 0.105, 10, 26);
const rim = new THREE.CylinderGeometry(0.31, 0.31, 0.11, 18).rotateZ(Math.PI / 2);
const frame = new THREE.CylinderGeometry(1, 1, 1, 10);
const rubber = new THREE.MeshStandardMaterial({ color: 0x222529, roughness: 0.94 });
const metal = new THREE.MeshStandardMaterial({ color: 0x777f81, metalness: 0.55, roughness: 0.38 });
const paint = new THREE.MeshStandardMaterial({ color: 0x8d4939, metalness: 0.28, roughness: 0.34 });
const seat = new THREE.MeshStandardMaterial({ color: 0x332722, roughness: 0.85 });
const headlight = new THREE.MeshBasicMaterial({ color: 0xffdf98 });
const taillight = new THREE.MeshBasicMaterial({ color: 0xbd402c });

export function motorcycleModel() {
  const group = new THREE.Group(), wheels = [];
  const part = (geo, mat, parent, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  for (const z of [-0.84, 0.79]) {
    const wheel = new THREE.Group();
    wheel.position.set(0, 0.475, z);
    group.add(wheel);
    wheels.push(wheel);
    part(tire, rubber, wheel, 0, 0, 0).rotation.y = Math.PI / 2;
    part(rim, metal, wheel, 0, 0, 0);
    part(box, seat, wheel, 0, 0, 0, 0.16, 0.055, 0.54);
  }
  part(box, metal, group, 0, 0.60, 0.08, 0.47, 0.38, 0.81);
  part(box, paint, group, 0, 0.96, -0.26, 0.46, 0.31, 0.65).rotation.x = 0.14;
  part(box, seat, group, 0, 0.98, 0.34, 0.39, 0.15, 0.63);
  part(box, paint, group, 0, 0.86, 0.78, 0.43, 0.16, 0.49);
  part(box, headlight, group, 0, 1.06, -0.88, 0.32, 0.21, 0.13);
  part(box, taillight, group, 0, 0.88, 1.04, 0.23, 0.08, 0.07);
  part(box, metal, group, 0, 1.25, -0.60, 0.85, 0.055, 0.065);
  for (const side of [-1, 1]) {
    part(frame, metal, group, side * 0.16, 0.82, -0.77, 0.039, 0.77, 0.039).rotation.x = -0.26;
    part(box, rubber, group, side * 0.39, 1.25, -0.60, 0.15, 0.08, 0.09);
  }
  group.userData.wheels = wheels;
  return group;
}

export function poseMotorcycle(model, player, dt) {
  model.position.set(player.x, player.y, player.z);
  model.rotation.set(0, player.yaw, player.bikeLean || 0, 'YXZ');
  for (const wheel of model.userData.wheels) wheel.rotation.x -= (player.bikeSpeed || 0) * dt / 0.475;
}

export function parkMotorcycles(surface, group, guest) {
  group.clear();
  return (surface.destinations || [surface.pad]).map(pad => {
    const side = guest ? -1 : 1;
    let x, z, y;
    for (const [dx, dz] of [[29, 25], [36, 20], [28, 42], [42, 40], [55, 42]]) {
      x = pad.x + dx * side;
      z = pad.z + dz;
      y = surface.walkEnv().terrain(x, z);
      if (!surface.solids.some(s => x > s.x0 - 2 && x < s.x1 + 2 && z > s.z0 - 2 && z < s.z1 + 2 && y < s.y1 && y + 2 > s.y0)) break;
    }
    const model = motorcycleModel();
    const bike = { x, y, z, yaw: pad.yaw || 0, model };
    poseMotorcycle(model, bike, 0);
    group.add(model);
    return bike;
  });
}

export function rideMotorcycle(player, keys, dt, env) {
  const throttle = Number(Boolean(keys.KeyW)) - Number(Boolean(keys.KeyS));
  const turn = Number(Boolean(keys.KeyA || keys.ArrowLeft)) - Number(Boolean(keys.KeyD || keys.ArrowRight));
  const target = keys.Space ? 0 : throttle > 0 ? (keys.ShiftLeft || keys.ShiftRight ? 43 : 32) : throttle < 0 ? -6 : 0;
  player.bikeSpeed += (target - player.bikeSpeed) * (1 - Math.exp(-(keys.Space ? 10 : 2.5) * dt));
  player.yaw += turn * 1.8 * dt * (player.bikeSpeed < -0.4 ? -1 : 1);
  player.bikeLean += (-turn * clamp(Math.abs(player.bikeSpeed) / 70, 0, 0.32) - player.bikeLean) * (1 - Math.exp(-8 * dt));
  const x = player.x, z = player.z;
  const distance = player.bikeSpeed * dt, steps = Math.max(1, Math.ceil(Math.abs(distance) / 0.24));
  const dx = -Math.sin(player.yaw) * distance / steps, dz = -Math.cos(player.yaw) * distance / steps;
  for (let i = 0; i < steps; i++) moveBody(player, dx, dz, dt / steps, env);
  player.x = clamp(player.x, -7600, 7600);
  player.z = clamp(player.z, -7600, 7600);
  if (Math.hypot(player.x - x, player.z - z) < Math.abs(distance) * 0.45) player.bikeSpeed *= 0.45;
  player.speed = Math.abs(player.bikeSpeed);
}

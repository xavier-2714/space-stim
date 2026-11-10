import * as THREE from 'three';

export class Explorer {
  constructor(jacket = 0x64746a) {
    this.group = new THREE.Group();
    this.phase = 0;
    const fabric = new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.94 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x30312e, roughness: 0.86 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xaa7945, roughness: 0.68 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb98464, roughness: 0.85 });
    const ellipsoid = new THREE.SphereGeometry(1, 16, 12);
    const shape = (parent, material, x, y, z, sx, sy, sz) => {
      const mesh = new THREE.Mesh(ellipsoid, material);
      mesh.castShadow = true;
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      parent.add(mesh);
    };
    shape(this.group, fabric, 0, 1.15, 0, 0.26, 0.36, 0.16);
    shape(this.group, leather, 0, 0.93, 0, 0.23, 0.1, 0.16);
    shape(this.group, skin, 0, 1.61, 0, 0.117, 0.145, 0.113);
    shape(this.group, leather, 0, 1.67, 0.025, 0.123, 0.104, 0.111);
    shape(this.group, leather, 0, 1.19, 0.16, 0.19, 0.24, 0.12);
    shape(this.group, trim, 0, 1.26, 0.246, 0.15, 0.11, 0.045);
    this.legs = [];
    this.arms = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(), arm = new THREE.Group();
      leg.position.set(side * 0.116, 0.92, 0);
      arm.position.set(side * 0.249, 1.36, 0);
      arm.rotation.z = side * 0.12;
      shape(leg, leather, 0, -0.23, 0, 0.098, 0.275, 0.105);
      shape(leg, fabric, 0, -0.57, 0.02, 0.077, 0.24, 0.08);
      shape(leg, leather, 0, -0.81, -0.053, 0.088, 0.105, 0.143);
      shape(arm, fabric, 0, -0.24, 0, 0.079, 0.28, 0.085);
      shape(arm, leather, 0, -0.5, 0, 0.06, 0.095, 0.065);
      this.group.add(leg, arm);
      this.legs.push(leg);
      this.arms.push(arm);
    }
  }

  animate(dt, speed, grounded) {
    this.phase += dt * speed * 1.65;
    const swing = grounded ? Math.sin(this.phase) * Math.min(speed / 8, 0.85) : 0;
    const blend = 1 - Math.exp(-16 * dt);
    this.legs.forEach((leg, i) => {
      const angle = i ? swing : -swing;
      leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, angle, blend);
      const arm = this.arms[i];
      arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, -angle * 0.65, blend);
    });
  }
}

const ray = new THREE.Ray(), box = new THREE.Box3(), hit = new THREE.Vector3(), delta = new THREE.Vector3();

export function clipBoom(start, end, solids, fraction = 1) {
  delta.subVectors(end, start);
  const distance = delta.length();
  ray.set(start, delta.divideScalar(distance));
  for (const s of solids) {
    if (s.off) continue;
    const margin = 0.09;
    box.min.set(s.x0 - margin, s.y0 - margin, s.z0 - margin);
    box.max.set(s.x1 + margin, s.y1 + margin, s.z1 + margin);
    if (box.distanceToPoint(start) > distance * fraction || box.containsPoint(start)) continue;
    if (ray.intersectBox(box, hit)) fraction = Math.min(fraction, hit.distanceTo(start) / distance);
  }
  return fraction;
}

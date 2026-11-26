/**
 * 3D creatures built from primitives with a code-driven skeleton (joints are
 * Object3D pivots animated every frame). Original geometry, no assets.
 *
 *   assignment → Zombie   (hunched, reaching, dragging a leg)
 *   minion     → Skeleton (brisk bony walk, clattering jaw)
 *   quiz       → Page     (a cursed folded page flapping)
 *   exam       → Wraith   (crowned shroud with rippling hem, the boss)
 *   project    → Golem    (lumbering stone with ember cracks)
 *
 * Each creature has glowing eyes (bloom), a course-tinted rim, and hooks
 * for hit flash, enrage and a dissolve death.
 */
import * as THREE from 'three';
import type { ItemType } from '../core/types';

export interface Creature {
  root: THREE.Group;
  /** Height in world units (for label placement). */
  height: number;
  update(t: number, dt: number, speed: number): void;
  flash(): void;
  setEnraged(on: boolean): void;
  materials: THREE.Material[];
}

const shared = {
  bone: new THREE.MeshStandardMaterial({ color: 0xcfc6b0, roughness: 0.75, metalness: 0 }),
  flesh: new THREE.MeshStandardMaterial({ color: 0x8f9a7f, roughness: 0.85 }),
  rag: new THREE.MeshStandardMaterial({ color: 0x4a4050, roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x4a4458, roughness: 0.95, flatShading: true }),
};

function eyeMat(color: number) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false });
}

function cap(r: number, len: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat);
  m.castShadow = true;
  return m;
}

/** A joint: pivot at the origin, child hangs down along -Y by `len`. */
function bone(r: number, len: number, mat: THREE.Material) {
  const pivot = new THREE.Group();
  const m = cap(r, len, mat);
  m.position.y = -len / 2;
  pivot.add(m);
  const end = new THREE.Group();
  end.position.y = -len;
  pivot.add(end);
  return { pivot, end };
}

function cloneMats(root: THREE.Object3D): THREE.Material[] {
  const mats: THREE.Material[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      const src = mesh.material as THREE.Material;
      const c = src.clone();
      (c as THREE.MeshStandardMaterial).transparent = true;
      mesh.material = c;
      mats.push(c);
    }
  });
  return mats;
}

function withFlash(root: THREE.Group, mats: THREE.Material[], rim: number) {
  const std = mats.filter((m) => (m as THREE.MeshStandardMaterial).isMeshStandardMaterial) as THREE.MeshStandardMaterial[];
  for (const m of std) {
    m.emissive = new THREE.Color(rim);
    m.emissiveIntensity = 0.05;
  }
  let flashUntil = 0;
  let enraged = false;
  return {
    flash() {
      flashUntil = performance.now() + 80;
      for (const m of std) m.emissiveIntensity = 1.4;
    },
    tickFlash() {
      if (flashUntil && performance.now() > flashUntil) {
        flashUntil = 0;
        for (const m of std) m.emissiveIntensity = enraged ? 0.6 : 0.05;
      }
    },
    setEnraged(on: boolean) {
      enraged = on;
      for (const m of std) {
        m.emissive.set(on ? 0xff2a3a : rim);
        m.emissiveIntensity = on ? 0.6 : 0.05;
      }
      root.scale.multiplyScalar(on ? 1.08 : 1 / 1.08);
    },
  };
}

// ───────────────────────── Zombie ─────────────────────────
function zombie(rim: number, scale: number): Creature {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.position.y = 0.72;
  const torso = cap(0.17, 0.36, shared.rag);
  torso.rotation.x = 0.0;
  torso.position.y = 0.22;
  body.add(torso);
  body.rotation.z = 0.32; // hunched forward (toward -X)
  const neck = new THREE.Group();
  neck.position.set(0, 0.5, 0);
  body.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), shared.flesh);
  head.scale.set(1, 1.1, 0.95);
  head.position.set(-0.04, 0.12, 0);
  head.castShadow = true;
  neck.add(head);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.14), shared.flesh);
  jaw.position.set(-0.08, 0.0, 0);
  neck.add(jaw);
  const eyeM = eyeMat(0xd8ffb0);
  for (const z of [-0.055, 0.055]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eyeM);
    e.position.set(-0.17, 0.14, z);
    neck.add(e);
  }
  // arms
  const armL = bone(0.05, 0.28, shared.flesh);
  const foreL = bone(0.045, 0.26, shared.flesh);
  armL.end.add(foreL.pivot);
  armL.pivot.position.set(0, 0.42, 0.2);
  body.add(armL.pivot);
  const armR = bone(0.05, 0.28, shared.flesh);
  const foreR = bone(0.045, 0.26, shared.flesh);
  armR.end.add(foreR.pivot);
  armR.pivot.position.set(0, 0.42, -0.2);
  body.add(armR.pivot);
  // legs (attached to root so the hunch doesn't tilt them)
  const legL = bone(0.07, 0.36, shared.rag);
  const shinL = bone(0.06, 0.34, shared.flesh);
  legL.end.add(shinL.pivot);
  legL.pivot.position.set(0, 0.72, 0.1);
  root.add(legL.pivot);
  const legR = bone(0.07, 0.36, shared.rag);
  const shinR = bone(0.06, 0.34, shared.flesh);
  legR.end.add(shinR.pivot);
  legR.pivot.position.set(0, 0.72, -0.1);
  root.add(legR.pivot);

  root.scale.setScalar(scale);
  const mats = cloneMats(root);
  const fx = withFlash(root, mats, rim);
  let phase = Math.random() * 10;
  return {
    root,
    height: 1.4 * scale,
    materials: mats,
    flash: fx.flash,
    setEnraged: fx.setEnraged,
    update(_t, dt, speed) {
      phase += dt * (2.2 + speed * 3.5);
      const s = Math.sin(phase);
      // stepping leg (right), dragging leg (left)
      legR.pivot.rotation.z = s * 0.5;
      shinR.pivot.rotation.z = Math.max(0, -Math.cos(phase)) * -0.8;
      legL.pivot.rotation.z = -s * 0.15 + 0.1;
      shinL.pivot.rotation.z = -0.15;
      // reaching arms, the right one swinging
      armL.pivot.rotation.z = -1.35 + Math.sin(phase * 2) * 0.08;
      foreL.pivot.rotation.z = -0.2;
      armR.pivot.rotation.z = -0.4 + s * 0.35;
      foreR.pivot.rotation.z = -0.3;
      body.position.y = 0.72 + Math.abs(Math.cos(phase)) * 0.04;
      body.rotation.x = Math.sin(phase * 0.5) * 0.08; // lurch side to side
      neck.rotation.z = 0.25 + Math.sin(phase * 0.7) * 0.15;
      jaw.rotation.z = Math.abs(Math.sin(phase * 1.3)) * 0.3;
      fx.tickFlash();
    },
  };
}

// ───────────────────────── Skeleton ─────────────────────────
function skeleton(rim: number, scale: number): Creature {
  const root = new THREE.Group();
  const B = shared.bone;
  const pelvis = new THREE.Group();
  pelvis.position.y = 0.62;
  root.add(pelvis);
  const hip = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12, Math.PI), B);
  hip.rotation.x = Math.PI / 2;
  pelvis.add(hip);
  const spine = cap(0.025, 0.4, B);
  spine.position.y = 0.24;
  pelvis.add(spine);
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.11 - i * 0.012, 0.012, 5, 14, Math.PI * 1.6), B);
    rib.rotation.set(Math.PI / 2, 0, Math.PI * 0.7);
    rib.position.y = 0.3 + i * 0.06;
    pelvis.add(rib);
  }
  const neck = new THREE.Group();
  neck.position.y = 0.55;
  pelvis.add(neck);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), B);
  skull.scale.set(1, 1.1, 0.9);
  skull.position.y = 0.1;
  neck.add(skull);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.12), B);
  jaw.position.set(-0.03, 0.01, 0);
  neck.add(jaw);
  const eyeM = eyeMat(0xffe6a8);
  for (const z of [-0.04, 0.04]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeM);
    e.position.set(-0.095, 0.11, z);
    neck.add(e);
  }
  const limbs: Array<{ a: ReturnType<typeof bone>; b: ReturnType<typeof bone>; side: number; leg: boolean }> = [];
  for (const [side, leg] of [[1, true], [-1, true], [1, false], [-1, false]] as const) {
    const a = bone(0.022, leg ? 0.3 : 0.22, B);
    const b = bone(0.02, leg ? 0.3 : 0.2, B);
    a.end.add(b.pivot);
    if (leg) {
      a.pivot.position.set(0, 0, 0.07 * side);
      pelvis.add(a.pivot);
    } else {
      a.pivot.position.set(0, 0.5, 0.13 * side);
      pelvis.add(a.pivot);
    }
    limbs.push({ a, b, side, leg });
  }
  root.scale.setScalar(scale);
  const mats = cloneMats(root);
  const fx = withFlash(root, mats, rim);
  let phase = Math.random() * 10;
  return {
    root,
    height: 1.0 * scale,
    materials: mats,
    flash: fx.flash,
    setEnraged: fx.setEnraged,
    update(_t, dt, speed) {
      phase += dt * (4 + speed * 5);
      const s = Math.sin(phase);
      for (const l of limbs) {
        const sw = s * l.side * (l.leg ? 0.6 : -0.5);
        l.a.pivot.rotation.z = sw + (l.leg ? 0 : 0.15);
        l.b.pivot.rotation.z = l.leg ? Math.max(0, -Math.cos(phase) * l.side) * -0.9 : -0.4;
      }
      pelvis.position.y = 0.62 + Math.abs(Math.sin(phase)) * 0.035;
      pelvis.rotation.z = 0.12;
      jaw.rotation.z = Math.max(0, Math.sin(phase * 3)) * 0.5;
      fx.tickFlash();
    },
  };
}

// ───────────────────────── Page swarm (quiz) ─────────────────────────
let pageTex: THREE.Texture | null = null;
export function setPageTexture(t: THREE.Texture) {
  pageTex = t;
}
function page(rim: number, scale: number): Creature {
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: pageTex ?? undefined, color: 0xd8ccb0, roughness: 0.9, side: THREE.DoubleSide });
  const leafGeo = new THREE.PlaneGeometry(0.34, 0.42);
  leafGeo.translate(0.17, 0, 0);
  const left = new THREE.Mesh(leafGeo, mat);
  const right = new THREE.Mesh(leafGeo, mat);
  const body = new THREE.Group();
  body.add(left, right);
  body.rotation.x = -Math.PI / 2.4;
  body.position.y = 0.9;
  left.castShadow = right.castShadow = true;
  root.add(body);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat(0xffd27a));
  eye.position.set(0, 0, 0.02);
  body.add(eye);
  root.scale.setScalar(scale);
  const mats = cloneMats(root);
  const fx = withFlash(root, mats, rim);
  let phase = Math.random() * 10;
  const base = 0.8 + Math.random() * 0.5;
  return {
    root,
    height: 1.0 * scale,
    materials: mats,
    flash: fx.flash,
    setEnraged: fx.setEnraged,
    update(_t, dt) {
      phase += dt * 11;
      const flap = Math.sin(phase) * 0.9;
      left.rotation.y = Math.PI - 0.3 + flap;
      right.rotation.y = 0.3 - flap;
      body.position.y = base + Math.sin(phase * 0.23) * 0.15;
      body.rotation.z = Math.sin(phase * 0.17) * 0.3;
      fx.tickFlash();
    },
  };
}

// ───────────────────────── Wraith (exam boss) ─────────────────────────
function wraith(rim: number, scale: number): Creature {
  const root = new THREE.Group();
  const shroudMat = new THREE.MeshStandardMaterial({ color: 0x4a4258, roughness: 0.85, side: THREE.DoubleSide });
  // Lathe profile: hood to flared hem
  const prof: THREE.Vector2[] = [];
  const pts = [
    [0.0, 2.35],
    [0.18, 2.3],
    [0.28, 2.1],
    [0.3, 1.85],
    [0.42, 1.6],
    [0.5, 1.2],
    [0.62, 0.7],
    [0.78, 0.2],
    [0.84, 0.0],
  ];
  for (const [x, y] of pts) prof.push(new THREE.Vector2(x, y));
  const shroudGeo = new THREE.LatheGeometry(prof, 40);
  const shroud = new THREE.Mesh(shroudGeo, shroudMat);
  shroud.castShadow = true;
  root.add(shroud);
  const basePos = (shroudGeo.attributes.position.array as Float32Array).slice();
  // face void + eyes
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), new THREE.MeshBasicMaterial({ color: 0x020104 }));
  face.scale.set(0.7, 1.1, 1);
  face.position.set(-0.17, 1.98, 0);
  root.add(face);
  const eyeM = eyeMat(0xff5a4a);
  const eyes: THREE.Mesh[] = [];
  for (const z of [-0.06, 0.06]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.08), eyeM);
    e.position.set(-0.3, 2.0, z);
    e.rotation.y = z > 0 ? -0.3 : 0.3;
    root.add(e);
    eyes.push(e);
  }
  // crown of thorns
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x8a7a58, roughness: 0.5, metalness: 0.6 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22 + (i % 2) * 0.12, 5), crownMat);
    spike.position.set(Math.cos(a) * 0.2, 2.36 + (i % 2) * 0.05, Math.sin(a) * 0.2);
    spike.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    root.add(spike);
  }
  // claws
  const clawMat = shared.bone;
  const arms: Array<{ p: THREE.Group; fingers: THREE.Group }> = [];
  for (const z of [-0.36, 0.36]) {
    const arm = bone(0.04, 0.6, shroudMat);
    arm.pivot.position.set(-0.1, 1.65, z);
    root.add(arm.pivot);
    const fingers = new THREE.Group();
    arm.end.add(fingers);
    for (let f = -2; f <= 2; f++) {
      const fg = cap(0.012, 0.2, clawMat);
      fg.position.set(-0.08, -0.08, f * 0.035);
      fg.rotation.z = -1.0 + Math.abs(f) * 0.1;
      fingers.add(fg);
    }
    arms.push({ p: arm.pivot, fingers });
  }
  const light = new THREE.PointLight(rim, 3, 4.5, 2);
  light.position.set(-0.4, 1.4, 0);
  root.add(light);

  root.scale.setScalar(scale);
  const mats = cloneMats(root).filter((m) => m !== face.material);
  const fx = withFlash(root, mats, rim);
  let phase = Math.random() * 10;
  const pos = shroudGeo.attributes.position;
  return {
    root,
    height: 2.5 * scale,
    materials: mats,
    flash: fx.flash,
    setEnraged: (on) => {
      fx.setEnraged(on);
      light.color.set(on ? 0xff2a3a : rim);
    },
    update(t, dt) {
      phase += dt * 1.6;
      // ripple the hem: displace vertices near the bottom
      const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        const y = basePos[i + 1];
        if (y > 0.9) continue;
        const k = (0.9 - y) / 0.9;
        const ang = Math.atan2(basePos[i + 2], basePos[i]);
        const w = Math.sin(phase * 2 + ang * 5) * 0.08 * k + Math.sin(phase * 3.1 + ang * 9) * 0.04 * k;
        arr[i] = basePos[i] * (1 + w);
        arr[i + 2] = basePos[i + 2] * (1 + w);
        arr[i + 1] = y + (ang % 0.8 < 0.4 ? -0.08 * k : 0) + Math.sin(phase + ang * 3) * 0.05 * k;
      }
      pos.needsUpdate = true;
      shroudGeo.computeVertexNormals();
      root.position.y = 0.15 + Math.sin(phase) * 0.08;
      arms.forEach((a, i) => {
        a.p.rotation.z = -1.1 + Math.sin(phase * 1.3 + i) * 0.15;
        a.fingers.rotation.z = Math.sin(phase * 2.6 + i) * 0.25;
      });
      const flick = 0.85 + Math.sin(t * 9) * 0.1 + Math.sin(t * 23) * 0.05;
      light.intensity = 3 * flick;
      eyes.forEach((e) => e.scale.set(1, Math.sin(t * 0.7) > 0.97 ? 0.2 : 1, 1));
      fx.tickFlash();
    },
  };
}

// ───────────────────────── Golem (project) ─────────────────────────
function golem(rim: number, scale: number): Creature {
  const root = new THREE.Group();
  const S = shared.stone;
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: 0xff7a2a, toneMapped: false }));
  const body = new THREE.Group();
  body.position.y = 1.0;
  root.add(body);
  core.scale.setScalar(0.9);
  body.add(core);
  const chunks: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + Math.random() * 0.1, 0), S);
    const a = (i / 7) * Math.PI * 2;
    c.position.set(Math.cos(a) * 0.22, Math.sin(a * 1.3) * 0.2, Math.sin(a) * 0.22);
    c.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    c.castShadow = true;
    body.add(c);
    chunks.push(c);
  }
  const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), S);
  head.position.set(-0.05, 0.48, 0);
  body.add(head);
  const eyeM = eyeMat(0xffa040);
  for (const z of [-0.06, 0.06]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), eyeM);
    e.position.set(-0.19, 0.5, z);
    body.add(e);
  }
  const arms: THREE.Group[] = [];
  for (const z of [-0.42, 0.42]) {
    const a = bone(0.11, 0.42, S);
    a.pivot.position.set(0, 0.2, z);
    body.add(a.pivot);
    const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), S);
    a.end.add(fist);
    arms.push(a.pivot);
  }
  const legs: THREE.Group[] = [];
  for (const z of [-0.2, 0.2]) {
    const l = bone(0.12, 0.5, S);
    l.pivot.position.set(0, 0.62, z);
    root.add(l.pivot);
    legs.push(l.pivot);
  }
  const light = new THREE.PointLight(0xff7a2a, 1.5, 2.5, 2);
  light.position.y = 1;
  root.add(light);
  root.scale.setScalar(scale);
  const mats = cloneMats(root);
  const fx = withFlash(root, mats, rim);
  let phase = Math.random() * 10;
  return {
    root,
    height: 1.7 * scale,
    materials: mats,
    flash: fx.flash,
    setEnraged: fx.setEnraged,
    update(t, dt, speed) {
      phase += dt * (1.6 + speed * 2);
      const s = Math.sin(phase);
      legs[0].rotation.z = s * 0.35;
      legs[1].rotation.z = -s * 0.35;
      arms[0].rotation.z = -s * 0.3 - 0.1;
      arms[1].rotation.z = s * 0.3 - 0.1;
      body.position.y = 1.0 + Math.abs(Math.cos(phase)) * 0.06;
      body.rotation.x = s * 0.06;
      chunks.forEach((c, i) => (c.rotation.y += dt * 0.2 * (i % 2 ? 1 : -1)));
      light.intensity = 1.3 + Math.sin(t * 5) * 0.3;
      fx.tickFlash();
    },
  };
}

export function makeCreature(type: ItemType, isMinion: boolean, rim: number): Creature {
  if (isMinion) {
    if (type === 'quiz') return page(rim, 0.75);
    if (type === 'project' || type === 'presentation') return golem(rim, 0.55);
    return skeleton(rim, 0.85);
  }
  switch (type) {
    case 'exam':
      return wraith(rim, 1.0);
    case 'quiz':
      return page(rim, 1.0);
    case 'project':
    case 'presentation':
      return golem(rim, 1.0);
    default:
      return zombie(rim, 1.0);
  }
}

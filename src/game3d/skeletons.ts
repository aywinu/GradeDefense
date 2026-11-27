/**
 * Rigged, animated undead for the procession: KayKit "Character Pack:
 * Skeletons" by Kay Lousberg (CC0, see public/models/LICENSE.txt). The
 * models are slimmed at build time (only the clips we use, on the minion
 * file; every skeleton shares the same rig, so one set of clips drives all).
 *
 *   exam                 → Skeleton Mage with a staff (the boss, casts while it waits)
 *   project/presentation → Skeleton Warrior with axe and shield
 *   assignment           → Skeleton Rogue with a blade
 *   quiz                 → Skeleton Minion
 *
 * Each one is tinted by its course (cloak, hood, hat), has glowing eyes in
 * the course colour (bloom), rises from the ground when it enters the
 * horizon, flinches when struck, taunts when you miss, collapses when its
 * last seal breaks and swings at the altar when it arrives.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ItemType } from '../core/types';
import type { Creature } from './creatures';

type Kind = 'mage' | 'warrior' | 'rogue' | 'minion';

interface Library {
  models: Record<Kind, THREE.Object3D>;
  weapons: Record<string, THREE.Object3D>;
  clips: Map<string, THREE.AnimationClip>;
}

let lib: Library | null = null;
let loading: Promise<void> | null = null;

/** Start loading the models (idempotent). Resolves when ready; never rejects. */
export function preloadSkeletons(): Promise<void> {
  if (loading) return loading;
  const base = `${import.meta.env.BASE_URL}models/`;
  const loader = new GLTFLoader();
  const get = (f: string) => loader.loadAsync(base + f);
  loading = Promise.all([
    get('skeleton-mage.glb'),
    get('skeleton-warrior.glb'),
    get('skeleton-rogue.glb'),
    get('skeleton-minion.glb'),
    get('weapon-staff.glb'),
    get('weapon-axe.glb'),
    get('weapon-shield.glb'),
    get('weapon-blade.glb'),
  ])
    .then(([mage, warrior, rogue, minion, staff, axe, shield, blade]) => {
      lib = {
        models: { mage: mage.scene, warrior: warrior.scene, rogue: rogue.scene, minion: minion.scene },
        weapons: { staff: staff.scene, axe: axe.scene, shield: shield.scene, blade: blade.scene },
        clips: new Map(minion.animations.map((c) => [c.name, c])),
      };
    })
    .catch(() => {
      lib = null; // fall back to the procedural creatures
    });
  return loading;
}

export function skeletonsReady(): boolean {
  return !!lib;
}

const KIND: Record<ItemType, Kind> = {
  exam: 'mage',
  project: 'warrior',
  presentation: 'warrior',
  assignment: 'rogue',
  quiz: 'minion',
};
const HEIGHT: Record<Kind, number> = { mage: 2.6, warrior: 2.2, rogue: 1.95, minion: 1.75 };
const WEAPONS: Record<Kind, [string, string][]> = {
  mage: [['staff', 'handslot.r']],
  warrior: [
    ['axe', 'handslot.r'],
    ['shield', 'handslot.l'],
  ],
  rogue: [['blade', 'handslot.r']],
  minion: [],
};

/** An animated skeleton for this deadline, or null while the models are not loaded. */
export function skeletonCreature(type: ItemType, rim: number): Creature | null {
  if (!lib) return null;
  const kind = KIND[type] ?? 'rogue';
  const root = new THREE.Group();
  const body = SkeletonUtils.clone(lib.models[kind]);
  root.add(body);

  // Size to the creature's role and face the altar (−X), turned a little toward the camera.
  const box = new THREE.Box3().setFromObject(body);
  const h = Math.max(0.01, box.max.y - box.min.y);
  const s = HEIGHT[kind] / h;
  body.scale.setScalar(s);
  body.rotation.y = -Math.PI / 2 + 0.45;

  const bones = new Map<string, THREE.Object3D>();
  body.traverse((o) => bones.set(o.name, o));
  for (const [w, slot] of WEAPONS[kind]) {
    const weapon = lib.weapons[w]?.clone(true);
    const hand = bones.get(slot);
    if (weapon && hand) hand.add(weapon);
  }

  // Materials: bone stays bone, cloth takes the course colour, eyes glow.
  const course = new THREE.Color(rim);
  const mats: THREE.Material[] = [];
  const std: THREE.MeshStandardMaterial[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.frustumCulled = false; // skinned bounds lag behind the animation
    const name = mesh.name.toLowerCase();
    if (name.includes('eyes')) {
      const m = new THREE.MeshBasicMaterial({ color: course.clone().lerp(new THREE.Color(0xffffff), 0.35).multiplyScalar(2.2), toneMapped: false, transparent: true });
      mesh.material = m;
      mats.push(m);
      return;
    }
    const m = (mesh.material as THREE.MeshStandardMaterial).clone();
    m.transparent = true;
    m.roughness = 0.85;
    m.metalness = 0;
    if (/cloak|hood|cape|hat|helmet/.test(name)) m.color = new THREE.Color(0xffffff).lerp(course, 0.7).multiplyScalar(0.8);
    else m.color = new THREE.Color(0xd8d0bc);
    m.emissive = course.clone();
    m.emissiveIntensity = 0.06;
    mesh.material = m;
    mats.push(m);
    std.push(m);
  });

  // An invisible capsule makes the whole silhouette clickable.
  const hit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, HEIGHT[kind], 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  hit.position.y = HEIGHT[kind] / 2;
  root.add(hit);

  // Animation
  const mixer = new THREE.AnimationMixer(body);
  const clip = (n: string) => lib!.clips.get(n);
  const action = (n: string) => {
    const c = clip(n);
    return c ? mixer.clipAction(c) : null;
  };
  const walk = action('Walking_D_Skeletons');
  const idle = action(kind === 'mage' ? 'Spellcasting' : 'Idle_Combat');
  let base: THREE.AnimationAction | null = null;
  let oneShot: THREE.AnimationAction | null = null;
  const setBase = (a: THREE.AnimationAction | null) => {
    if (!a || a === base) return;
    a.reset().setEffectiveWeight(1).fadeIn(0.35).play();
    base?.fadeOut(0.35);
    base = a;
  };
  const once = (n: string, hold = false, fade = 0.12) => {
    const a = action(n);
    if (!a) return 0;
    oneShot?.fadeOut(0.1);
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = hold;
    a.setEffectiveWeight(1).fadeIn(fade).play();
    oneShot = a;
    return a.getClip().duration;
  };
  mixer.addEventListener('finished', (e) => {
    const a = (e as unknown as { action: THREE.AnimationAction }).action;
    if (a === oneShot && !a.clampWhenFinished) {
      a.fadeOut(0.25);
      oneShot = null;
    }
  });
  setBase(idle);
  // Rise from the ground as it enters the horizon.
  once('Spawn_Ground_Skeletons', false, 0);
  mixer.update(Math.random() * 0.2);

  let flashUntil = 0;
  let enraged = false;
  const glow = () => (enraged ? 0.4 : 0.06);
  return {
    root,
    height: HEIGHT[kind],
    materials: mats,
    update(_t, dt, speed) {
      setBase(speed > 0.06 ? walk : idle);
      if (walk) walk.timeScale = 0.6 + speed * 0.8;
      mixer.update(dt);
      if (flashUntil && performance.now() > flashUntil) {
        flashUntil = 0;
        for (const m of std) m.emissiveIntensity = glow();
      }
    },
    flash() {
      flashUntil = performance.now() + 90;
      for (const m of std) m.emissiveIntensity = 1.2;
      once('Hit_A');
    },
    setEnraged(on) {
      enraged = on;
      for (const m of std) {
        m.emissive.set(on ? 0x7a0a18 : rim);
        m.emissiveIntensity = glow();
      }
      if (on) once('Taunt');
    },
    play(what) {
      if (what === 'die') return once('Death_C_Skeletons', true);
      if (what === 'attack') return once('1H_Melee_Attack_Chop', true);
      if (what === 'taunt') return once('Taunt');
      if (what === 'cheer') return once('Cheer');
      return 0;
    },
    hover(on) {
      for (const m of std) m.emissiveIntensity = on ? 0.35 : glow();
    },
  };
}

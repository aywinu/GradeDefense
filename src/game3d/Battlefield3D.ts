/**
 * Battlefield3D: the 3D view of the siege. Rendering only; the battle rules
 * stay in Kiro's pure src/core simulation, whose 2D coordinates (x 150..1650,
 * lanes 110..870) map onto a perspective floor here.
 *
 * Scene: a moonlit crypt hall. Your grimoire altar and candles on the left,
 * six flagstone lanes, the graveyard gate on the right where coursework
 * crawls out of the mist. Real lights and shadows, exponential fog, animated
 * ground mist that the cursor-lantern parts, bloom and a vignette.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { makeCreature, setPageTexture, type Creature } from './creatures';
import * as tex from './textures';
import type { ItemType } from '../core/types';

export const SIM = { xMin: 150, xMax: 1650, yMin: 110, yMax: 870, lanes: 6 };
const UNIT = 100; // sim pixels per world unit
const CAM_POS = new THREE.Vector3(0.4, 14.2, 14.8);
const CAM_LOOK = new THREE.Vector3(0.4, 0, 0.1);

/** Lanes are spread wider in depth than the sim's 2D layout, for readability. */
const ZK = 1.6;
export function toWorld(x: number, y: number): THREE.Vector3 {
  return new THREE.Vector3((x - 900) / UNIT, 0, ((y - 490) / UNIT) * ZK);
}

interface EnemyRec {
  c: Creature;
  label?: HTMLDivElement;
  hpEl?: HTMLElement;
  target: THREE.Vector3;
  speed: number;
  dying?: number;
  isBoss: boolean;
}

interface TowerRec {
  group: THREE.Group;
  crystal: THREE.Mesh;
  light: THREE.Sprite;
  rings: THREE.Group;
  recoil: number;
  grow: number;
  color: number;
}

const VIGNETTE = {
  uniforms: { tDiffuse: { value: null }, uDesat: { value: 0 }, uDanger: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uDesat; uniform float uDanger; uniform float uTime; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299,0.587,0.114));
      c.rgb = mix(c.rgb, vec3(l) * vec3(1.0,0.92,0.9), uDesat);
      vec2 d = vUv - 0.5; d.x *= 1.2;
      float v = smoothstep(0.85, 0.25, length(d));
      c.rgb *= mix(0.45, 1.0, v);
      c.rgb += vec3(0.5,0.02,0.04) * uDanger * (1.0 - v) * 0.9;
      c.rgb += (hash(vUv * 900.0 + uTime) - 0.5) * 0.015;
      gl_FragColor = c;
    }`,
};

const MIST_VERT = `varying vec2 vUv; varying vec3 vWorld; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const MIST_FRAG = `
  uniform float uTime; uniform vec3 uLantern; uniform float uDensity; uniform vec3 uColor; uniform vec2 uPush;
  varying vec2 vUv; varying vec3 vWorld;
  vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
  vec2 mod289(vec2 x){return x - floor(x*(1.0/289.0))*289.0;}
  vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m; m = m*m;
    vec3 x = 2.0*fract(p*C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314*(a0*a0 + h*h);
    vec3 g; g.x = a0.x*x0.x + h.x*x0.y; g.yz = a0.yz*x12.xz + h.yz*x12.yw; return 130.0*dot(m,g);
  }
  void main(){
    vec2 p = vWorld.xz * 0.16 + uPush;
    float n = snoise(p + vec2(uTime*0.035, uTime*0.012)) * 0.6 + snoise(p*2.3 - vec2(uTime*0.05, 0.0)) * 0.3 + snoise(p*5.0 + uTime*0.02)*0.1;
    float a = smoothstep(-0.2, 0.9, n) * uDensity;
    float d = distance(vWorld.xz, uLantern.xz);
    a *= smoothstep(0.6, 2.6, d) * 0.85 + 0.15 * (1.0 - uLantern.y);
    a *= smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
    gl_FragColor = vec4(uColor, a);
  }`;

export class Battlefield3D {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private post: ShaderPass;
  private mistMats: THREE.ShaderMaterial[] = [];
  private candles: Array<{ light: THREE.PointLight; flame: THREE.Sprite; base: number; seed: number }> = [];
  private enemies = new Map<string, EnemyRec>();
  private towers = new Map<string, TowerRec>();
  private sockets = new Map<string, THREE.Mesh>();
  private bolts: Array<{ m: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; trail: THREE.Points }> = [];
  private bursts: Array<{ p: THREE.Points; v: Float32Array; t: number; life: number; up: number }> = [];
  private glowTex = tex.glow();
  private lantern: THREE.PointLight;
  private lanternPos = new THREE.Vector3(0, 0, 99);
  private push = new THREE.Vector2();
  private lastMouse = new THREE.Vector2(-1, -1);
  private ray = new THREE.Raycaster();
  private floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private labelLayer: HTMLDivElement;
  private shake = 0;
  private time = 0;
  private reduced: boolean;
  private desat = 0;
  private desatTarget = 0;
  private altarGlow!: THREE.PointLight;
  private cracks = 0;
  private book!: THREE.Group;
  onSocketClick?: (key: string) => void;

  constructor(container: HTMLElement, labelLayer: HTMLDivElement, reduced: boolean) {
    this.reduced = reduced;
    this.labelLayer = labelLayer;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(1600, 900, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'dd-3d';
    container.appendChild(this.canvas);

    this.camera = new THREE.PerspectiveCamera(37, 16 / 9, 0.1, 140);
    this.camera.position.copy(CAM_POS);
    this.camera.lookAt(CAM_LOOK);

    this.scene.background = new THREE.Color(0x07060b);
    this.scene.fog = new THREE.FogExp2(0x0c0a14, 0.022);

    this.buildLights();
    this.buildEnvironment();
    this.buildMist();
    setPageTexture(tex.parchment(true));

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(800, 450), 0.75, 0.55, 0.35));
    this.post = new ShaderPass(VIGNETTE);
    this.composer.addPass(this.post);
    this.composer.addPass(new OutputPass());

    this.sweepLight = new THREE.PointLight(0x6ee7d0, 0, 9, 1.4);
    this.scene.add(this.sweepLight);
    this.lantern = new THREE.PointLight(0xffc27a, 0, 5.5, 1.6);
    this.lantern.position.set(0, 1.1, 0);
    this.scene.add(this.lantern);

    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerdown', this.onClick);
    this.fit();
    window.addEventListener('resize', this.fit);
  }

  // ───────────── environment ─────────────

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x8a82b0, 0x1a1424, 1.1));
    const moon = new THREE.DirectionalLight(0xb4bcff, 1.6);
    moon.position.set(8, 14, -6);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    const sc = moon.shadow.camera;
    sc.left = -11;
    sc.right = 11;
    sc.top = 11;
    sc.bottom = -11;
    sc.far = 40;
    moon.shadow.bias = -0.0005;
    this.scene.add(moon);
    // Warm key from the altar side: candlelight vs moonlight contrast on every creature.
    const warm = new THREE.DirectionalLight(0xffb070, 0.7);
    warm.position.set(-12, 5, 4);
    this.scene.add(warm);
  }

  private buildEnvironment() {
    const { map, bump } = tex.flagstones();
    map.repeat.set(6, 4.6);
    bump.repeat.set(6, 4.6);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 26),
      new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2.2, roughness: 0.88, color: 0xc4bcd4 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Sky backdrop far behind
    const skyMat = new THREE.MeshBasicMaterial({ map: tex.sky(), fog: false });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(90, 34), skyMat);
    sky.position.set(4, 8, -26);
    this.scene.add(sky);

    // Lane curbs: low stone rails between lanes
    const stoneTex = tex.stone();
    stoneTex.repeat.set(8, 1);
    const curbMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x6a6280, roughness: 0.95 });
    const laneH = (SIM.yMax - SIM.yMin) / SIM.lanes / UNIT;
    for (let i = 0; i <= SIM.lanes; i++) {
      const z = toWorld(0, SIM.yMin + i * laneH * UNIT).z;
      const curb = new THREE.Mesh(new THREE.BoxGeometry(16.5, 0.12, 0.09), curbMat);
      curb.position.set(0.3, 0.06, z);
      curb.receiveShadow = true;
      curb.castShadow = true;
      this.scene.add(curb);
    }

    // Altar with the open grimoire (the fortress) on the left
    const altarMat = new THREE.MeshStandardMaterial({ map: stone(5), color: 0x5a5270, roughness: 0.9 });
    const altar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 12.6), altarMat);
    altar.position.set(-8.6, 0.45, 0.1);
    altar.castShadow = altar.receiveShadow = true;
    this.scene.add(altar);
    const book = new THREE.Group();
    const pageMat = new THREE.MeshStandardMaterial({ map: tex.parchment(true), roughness: 0.85, emissive: 0x3a2a10, emissiveIntensity: 0.25 });
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x3a1a1c, roughness: 0.7 });
    const cover = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 2.4), coverMat);
    book.add(cover);
    for (const s of [-1, 1]) {
      const pg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.92), pageMat);
      pg.position.set(0, 0.07, s * 0.48);
      pg.rotation.x = s * 0.08;
      book.add(pg);
    }
    book.position.set(-8.6, 0.95, 0.1);
    book.rotation.y = -0.1;
    book.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    this.scene.add(book);
    this.book = book;
    this.altarGlow = new THREE.PointLight(0xffc27a, 2.2, 6, 1.8);
    this.altarGlow.position.set(-8.2, 2.0, 0.1);
    this.scene.add(this.altarGlow);

    // A candle at the head of every lane
    for (let i = 0; i < SIM.lanes; i++) {
      const z = toWorld(0, SIM.yMin + (i + 0.5) * laneH * UNIT).z;
      this.addCandle(-7.25, z - 0.45, i);
    }
    // Candle cluster on the altar
    for (const [dx, dz] of [
      [0.3, -4.6],
      [-0.2, -4.0],
      [0.25, 4.3],
      [-0.25, 5.0],
    ])
      this.addCandle(-8.6 + dx, dz, 9 + dx * 10, 0.9, 1.4);

    // Graveyard gate and stones on the right where the horde spawns
    const gateMat = new THREE.MeshStandardMaterial({ map: stone(7), color: 0x4a4458, roughness: 1 });
    for (const z of [-6.6, 6.9]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.2, 0.7), gateMat);
      pillar.position.set(9.4, 1.6, z);
      pillar.castShadow = true;
      this.scene.add(pillar);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.6, 4), gateMat);
      cap.position.set(9.4, 3.5, z);
      cap.rotation.y = Math.PI / 4;
      this.scene.add(cap);
    }
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x15121c, roughness: 0.5, metalness: 0.7 });
    for (let z = -7.2; z <= 7.4; z += 0.32) {
      if (Math.abs(z) < 6.2) continue;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 5), ironMat);
      bar.position.set(9.4, 1.2, z);
      this.scene.add(bar);
    }
    const r = mulberry(4);
    for (let k = 0; k < 34; k++) {
      const x = 10.2 + r() * 7;
      const z = -9 + r() * 18;
      const tomb = r() < 0.7 ? tombstone(gateMat, r) : cross(gateMat);
      tomb.position.set(x, 0, z);
      tomb.rotation.set((r() - 0.5) * 0.15, -Math.PI / 2 + (r() - 0.5) * 0.5, (r() - 0.5) * 0.2);
      tomb.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      this.scene.add(tomb);
    }
    // Dead trees
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x1a1520, roughness: 1 });
    for (const [x, z, s] of [
      [13, -5.5, 1.3],
      [15, 3.5, 1.6],
      [11.8, 6.2, 1.0],
    ]) {
      const t = deadTree(barkMat, mulberry(x * 10 + z));
      t.position.set(x, 0, z);
      t.scale.setScalar(s);
      this.scene.add(t);
    }
  }

  private addCandle(x: number, z: number, seed: number, h = 0.55, intensity = 1.1) {
    const wax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.08, h, 10),
      new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.6, emissive: 0x3a2a10, emissiveIntensity: 0.4 }),
    );
    const baseY = x < -8 ? 0.9 : 0;
    wax.position.set(x, baseY + h / 2, z);
    wax.castShadow = true;
    this.scene.add(wax);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.flame(), color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    flame.scale.set(0.16, 0.32, 1);
    flame.position.set(x, baseY + h + 0.14, z);
    this.scene.add(flame);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 }));
    halo.scale.setScalar(1.1);
    halo.position.copy(flame.position);
    this.scene.add(halo);
    const light = new THREE.PointLight(0xffa850, x < -8 ? 0 : intensity, 4.2, 1.7);
    light.position.set(x, baseY + h + 0.25, z);
    if (x >= -8) this.scene.add(light);
    this.candles.push({ light, flame, base: x < -8 ? 0 : intensity, seed });
  }

  private buildMist() {
    const layers = [
      { y: 0.12, density: 0.34, color: new THREE.Color(0x3a3450) },
      { y: 0.55, density: 0.16, color: new THREE.Color(0x4a4466) },
    ];
    for (const L of layers) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uLantern: { value: new THREE.Vector3(0, 0, 99) },
          uDensity: { value: L.density },
          uColor: { value: L.color },
          uPush: { value: new THREE.Vector2() },
        },
        vertexShader: MIST_VERT,
        fragmentShader: MIST_FRAG,
        transparent: true,
        depthWrite: false,
        fog: false,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(36, 26), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(2, L.y, 0);
      m.renderOrder = 5;
      this.scene.add(m);
      this.mistMats.push(mat);
    }
  }

  // ───────────── towers & sockets ─────────────

  addTower(key: string, x: number, y: number, color: number, forge: number) {
    const p = toWorld(x, y);
    const g = new THREE.Group();
    g.position.copy(p);
    const stoneMat = new THREE.MeshStandardMaterial({ map: stone(2), color: 0x6a6280, roughness: 0.9 });
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), stoneMat);
    plinth.position.y = 0.09;
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.17, 1.0, 4), stoneMat);
    obelisk.position.y = 0.68;
    obelisk.rotation.y = Math.PI / 4;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), stoneMat);
    tip.position.y = 1.28;
    tip.rotation.y = Math.PI / 4;
    for (const m of [plinth, obelisk, tip]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12, 0),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2, roughness: 0.2, toneMapped: false }),
    );
    crystal.position.y = 1.62;
    // A halo sprite instead of a real light: adding lights at runtime forces
    // shader recompiles (hitches) and many lights cost frame time.
    const light = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
    light.position.y = 1.62;
    light.scale.setScalar(0.9);
    const rings = new THREE.Group();
    g.add(plinth, obelisk, tip, crystal, light, rings);
    this.scene.add(g);
    const rec: TowerRec = { group: g, crystal, light, rings, recoil: 0, grow: this.reduced ? 1 : 0.01, color };
    this.towers.set(key, rec);
    this.setForge(key, forge);
    g.scale.setScalar(rec.grow);
  }

  setForge(key: string, level: number) {
    const t = this.towers.get(key);
    if (!t) return;
    t.rings.clear();
    for (let i = 0; i < level; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.34 + i * 0.07, 0.012, 6, 40),
        new THREE.MeshBasicMaterial({ color: 0xf2b45a, transparent: true, opacity: 0.7 - i * 0.08, toneMapped: false }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.2 + i * 0.03;
      t.rings.add(ring);
    }
  }

  towerFire(key: string) {
    const t = this.towers.get(key);
    if (t) t.recoil = 1;
  }

  muzzle(key: string): THREE.Vector3 | null {
    const t = this.towers.get(key);
    return t ? t.group.position.clone().add(new THREE.Vector3(0, 1.62, 0)) : null;
  }

  addSocket(key: string, x: number, y: number, color: number) {
    const p = toWorld(x, y);
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.26, 0.31, 40),
      new THREE.MeshBasicMaterial({ color: 0xcfc3a8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, toneMapped: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, 0.03, p.z);
    const inner = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.18, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, toneMapped: false }),
    );
    m.add(inner);
    m.userData.key = key;
    this.scene.add(m);
    this.sockets.set(key, m);
  }

  removeSocket(key: string) {
    const m = this.sockets.get(key);
    if (m) this.scene.remove(m);
    this.sockets.delete(key);
  }

  // ───────────── enemies ─────────────

  addEnemy(id: string, type: ItemType, isMinion: boolean, x: number, y: number, color: number, label: string | null, daysLeft: number) {
    const c = makeCreature(type, isMinion, color);
    const p = toWorld(x, y);
    c.root.position.copy(p);
    c.root.rotation.y = 0;
    this.scene.add(c.root);
    const rec: EnemyRec = { c, target: p.clone(), speed: 0, isBoss: type === 'exam' && !isMinion };
    if (label) {
      const el = document.createElement('div');
      el.className = `enemy-label${rec.isBoss ? ' boss' : ''}`;
      const when = daysLeft <= 0 ? 'due today' : daysLeft === 1 ? 'due tomorrow' : `${daysLeft} days left`;
      el.innerHTML = `<span class="n">${label.replace(/Examination/, 'Exam')}</span><span class="d ${daysLeft <= 7 ? 'soon' : ''}">${when}</span><span class="hp"><i></i></span>`;
      this.labelLayer.appendChild(el);
      rec.label = el;
      rec.hpEl = el.querySelector<HTMLElement>('.hp > i')!;
    }
    if (!this.reduced) {
      for (const m of c.materials) {
        (m as THREE.MeshStandardMaterial).opacity = 0;
      }
    }
    this.enemies.set(id, rec);
  }

  moveEnemy(id: string, x: number, y: number, hpFrac: number) {
    const e = this.enemies.get(id);
    if (!e) return;
    const p = toWorld(x, y);
    e.speed = Math.min(1, e.target.distanceTo(p) * 60);
    e.target.copy(p);
    if (e.hpEl) e.hpEl.style.width = `${Math.max(0, hpFrac) * 100}%`;
  }

  hitEnemy(id: string) {
    this.enemies.get(id)?.c.flash();
  }

  setEnraged(id: string, on: boolean) {
    this.enemies.get(id)?.c.setEnraged(on);
  }

  killEnemy(id: string, color: number) {
    const e = this.enemies.get(id);
    if (!e) return;
    e.dying = 0;
    e.label?.remove();
    this.burst(e.c.root.position.clone().add(new THREE.Vector3(0, e.c.height * 0.5, 0)), color, e.isBoss ? 120 : 26, 1.6, true);
    if (e.isBoss) this.shake = 0.35;
  }

  removeEnemy(id: string) {
    const e = this.enemies.get(id);
    if (!e) return;
    e.label?.remove();
    this.scene.remove(e.c.root);
    this.enemies.delete(id);
  }

  /** Screen position (stage px) for the far end of a lane, for its name plate. */
  laneScreen(lane: number): { x: number; y: number } {
    const laneH = (SIM.yMax - SIM.yMin) / SIM.lanes;
    const p = toWorld(SIM.xMax + 170, SIM.yMin + (lane + 0.5) * laneH);
    this.camera.updateMatrixWorld();
    return this.project(p);
  }

  enemyScreen(id: string): { x: number; y: number } | null {
    const e = this.enemies.get(id);
    if (!e) return null;
    return this.project(e.c.root.position.clone().add(new THREE.Vector3(0, e.c.height, 0)));
  }

  // ───────────── effects ─────────────

  bolt(fromKey: string, toX: number, toY: number, color: number) {
    const from = this.muzzle(fromKey);
    if (!from) return;
    const to = toWorld(toX, toY).add(new THREE.Vector3(0, 0.8, 0));
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    m.position.copy(from);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(0.6);
    m.add(halo);
    this.scene.add(m);
    const trail = this.makePoints(14, color, 0.12);
    this.scene.add(trail);
    this.bolts.push({ m, from, to, t: 0, dur: Math.min(0.28, from.distanceTo(to) / 22), trail });
  }

  private makePoints(n: number, color: number, size: number) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new THREE.PointsMaterial({ map: this.glowTex, color, size, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    return new THREE.Points(geo, mat);
  }

  burst(at: THREE.Vector3, color: number, n: number, speed: number, souls = false) {
    if (this.reduced) n = Math.min(n, 6);
    const p = this.makePoints(n, color, souls ? 0.28 : 0.14);
    const pos = p.geometry.attributes.position.array as Float32Array;
    const v = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos.set([at.x, at.y, at.z], i * 3);
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random());
      v.set([Math.cos(a) * Math.cos(e) * s, Math.abs(Math.sin(e)) * s * (souls ? 1.4 : 1), Math.sin(a) * Math.cos(e) * s], i * 3);
    }
    this.scene.add(p);
    this.bursts.push({ p, v, t: 0, life: souls ? 1.1 : 0.45, up: souls ? 1.6 : -3 });
  }

  hitSpark(x: number, y: number, color: number) {
    this.burst(toWorld(x, y).add(new THREE.Vector3(0, 0.8, 0)), color, 8, 2.6);
  }

  private sweepLight?: THREE.PointLight;

  lanternSweep(color: number) {
    const sweep = this.sweepLight!;
    sweep.color.set(color);
    sweep.intensity = 30;
    sweep.position.set(-9, 1.5, 0);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
    s.scale.set(4, 9, 1);
    s.position.set(-9, 1.5, 0);
    this.scene.add(s);
    const start = this.time;
    const step = () => {
      const k = (this.time - start) / 0.8;
      sweep.position.x = s.position.x = -9 + k * 20;
      if (k < 1) requestAnimationFrame(step);
      else {
        sweep.intensity = 0;
        this.scene.remove(s);
      }
    };
    step();
  }

  breach(fraction: number) {
    this.shake = this.reduced ? 0 : 0.25;
    this.cracks = fraction;
    this.burst(new THREE.Vector3(-8.3, 1.2, 0), 0xb3202c, 30, 2);
  }

  setDanger(f: number) {
    this.post.uniforms.uDanger.value = f;
  }

  setSlowmo(on: boolean) {
    this.desatTarget = on ? 0.75 : 0;
  }

  // ───────────── frame ─────────────

  update(dtMs: number) {
    const dt = Math.min(0.05, dtMs / 1000);
    this.time += dt;
    const t = this.time;

    // Candles flicker
    for (const c of this.candles) {
      const n = Math.sin(t * 7.3 + c.seed) * 0.5 + Math.sin(t * 13.1 + c.seed * 2) * 0.3 + Math.sin(t * 2.1 + c.seed) * 0.2;
      c.light.intensity = c.base * (this.reduced ? 1 : 1 + n * 0.18);
      if (!this.reduced) c.flame.scale.set(0.16 + n * 0.01, 0.32 + n * 0.04, 1);
    }
    this.altarGlow.intensity = 2.2 * (1 - this.cracks * 0.6) + Math.sin(t * 3) * 0.1;
    if (this.book) this.book.rotation.z = this.cracks > 0.6 && !this.reduced ? Math.sin(t * 40) * 0.01 : 0;

    // Mist + lantern
    this.push.multiplyScalar(Math.pow(0.5, dt / 0.9));
    for (const m of this.mistMats) {
      m.uniforms.uTime.value = this.reduced ? 0 : t;
      m.uniforms.uLantern.value.copy(this.lanternPos);

    }
    this.lantern.position.lerp(new THREE.Vector3(this.lanternPos.x, 1.2, this.lanternPos.z), this.reduced ? 1 : 0.2);
    this.lantern.intensity = this.lanternPos.z > 50 ? 0 : 2.2 + Math.sin(t * 6) * 0.15;

    // Towers
    for (const tw of this.towers.values()) {
      if (tw.grow < 1) {
        tw.grow = Math.min(1, tw.grow + dt * 2.5);
        const k = tw.grow;
        tw.group.scale.setScalar(1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.15);
      }
      tw.crystal.rotation.y += dt * 1.5;
      tw.crystal.position.y = 1.62 + (this.reduced ? 0 : Math.sin(t * 2 + tw.group.position.z) * 0.05);
      tw.light.material.opacity = 0.45 + tw.recoil * 0.5;
      tw.light.scale.setScalar(0.9 + tw.recoil * 0.6);
      (tw.crystal.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.2 + tw.recoil * 4;
      tw.recoil = Math.max(0, tw.recoil - dt * 6);
      tw.rings.rotation.y += dt * 0.4;
    }

    // Enemies: ease toward sim position, animate, fade in, dissolve on death
    for (const [id, e] of this.enemies) {
      const root = e.c.root;
      if (e.dying !== undefined) {
        e.dying += dt;
        const k = e.dying / 0.6;
        root.position.y += dt * 1.2;
        root.scale.multiplyScalar(1 - dt * 0.8);
        for (const m of e.c.materials) (m as THREE.MeshStandardMaterial).opacity = Math.max(0, 1 - k);
        if (k >= 1) this.removeEnemy(id);
        continue;
      }
      const prev = root.position.clone();
      root.position.x += (e.target.x - root.position.x) * Math.min(1, dt * 12);
      root.position.z += (e.target.z - root.position.z) * Math.min(1, dt * 12);
      const v = prev.distanceTo(root.position) / Math.max(dt, 1e-3);
      e.c.update(t, dt, Math.min(1, v / 0.5));
      for (const m of e.c.materials) {
        const mm = m as THREE.MeshStandardMaterial;
        if (mm.opacity < 1) mm.opacity = Math.min(1, mm.opacity + dt * 2);
      }
      if (e.label) {
        const s = this.project(root.position.clone().add(new THREE.Vector3(0, e.c.height + 0.25, 0)));
        e.label.style.transform = `translate(${Math.min(1560, Math.max(40, s.x))}px, ${Math.max(150, s.y)}px) translate(-50%, -100%)`;
      }
    }

    // Bolts
    this.bolts = this.bolts.filter((b) => {
      b.t += dt;
      const k = Math.min(1, b.t / b.dur);
      const p = b.from.clone().lerp(b.to, k);
      p.y += Math.sin(k * Math.PI) * 0.4;
      b.m.position.copy(p);
      const tp = b.trail.geometry.attributes.position.array as Float32Array;
      for (let i = tp.length - 3; i >= 3; i--) tp[i] = tp[i - 3];
      tp[0] = p.x;
      tp[1] = p.y;
      tp[2] = p.z;
      b.trail.geometry.attributes.position.needsUpdate = true;
      if (k >= 1) {
        this.scene.remove(b.m, b.trail);
        return false;
      }
      return true;
    });

    // Particle bursts
    this.bursts = this.bursts.filter((b) => {
      b.t += dt;
      const pos = b.p.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) {
        b.v[i + 1] += b.up * dt;
        pos[i] += b.v[i] * dt;
        pos[i + 1] += b.v[i + 1] * dt;
        pos[i + 2] += b.v[i + 2] * dt;
      }
      b.p.geometry.attributes.position.needsUpdate = true;
      (b.p.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - b.t / b.life);
      if (b.t >= b.life) {
        this.scene.remove(b.p);
        return false;
      }
      return true;
    });

    // Camera: gentle breathing drift + shake
    const base = CAM_POS.clone();
    if (!this.reduced) {
      base.x += Math.sin(t * 0.13) * 0.25;
      base.y += Math.sin(t * 0.21) * 0.12;
    }
    if (this.shake > 0) {
      base.x += (Math.random() - 0.5) * this.shake;
      base.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.2);
    }
    this.camera.position.copy(base);
    this.camera.lookAt(CAM_LOOK);

    this.desat += (this.desatTarget - this.desat) * Math.min(1, dt * 5);
    this.post.uniforms.uDesat.value = this.desat;
    this.post.uniforms.uTime.value = t;
    this.composer.render();
  }

  // ───────────── input / projection ─────────────

  private project(p: THREE.Vector3): { x: number; y: number } {
    const v = p.project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * 1600, y: (-v.y * 0.5 + 0.5) * 900 };
  }

  private ndc(e: PointerEvent): THREE.Vector2 {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private onMove = (e: PointerEvent) => {
    const n = this.ndc(e);
    this.ray.setFromCamera(n, this.camera);
    const hit = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.floorPlane, hit)) {
      if (this.lastMouse.x >= -1 && this.lanternPos.z < 50 && !this.reduced) {
        this.push.x += (hit.x - this.lanternPos.x) * 0.6;
        this.push.y += (hit.z - this.lanternPos.z) * 0.6;
      }
      this.lanternPos.set(hit.x, 0, hit.z);
    }
    let over = false;
    const hits = this.ray.intersectObjects([...this.sockets.values()], false);
    if (hits.length) over = true;
    for (const s of this.sockets.values()) (s.material as THREE.MeshBasicMaterial).opacity = hits[0]?.object === s ? 0.8 : 0.22;
    this.canvas.style.cursor = over ? 'pointer' : '';
    this.lastMouse.copy(n);
  };

  private onClick = (e: PointerEvent) => {
    this.ray.setFromCamera(this.ndc(e), this.camera);
    const hits = this.ray.intersectObjects([...this.sockets.values()], false);
    const key = hits[0]?.object.userData.key as string | undefined;
    if (key) this.onSocketClick?.(key);
  };

  private fit = () => {
    const phaser = document.querySelector<HTMLCanvasElement>('#game-container canvas:not(.dd-3d)');
    const r = phaser?.getBoundingClientRect();
    if (!r) return;
    Object.assign(this.canvas.style, {
      position: 'fixed',
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      zIndex: '5',
    });
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(Math.round(r.width), Math.round(r.height), false);
    this.composer?.setSize(Math.round(r.width), Math.round(r.height));
  };

  dispose() {
    window.removeEventListener('resize', this.fit);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerdown', this.onClick);
    for (const e of this.enemies.values()) e.label?.remove();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.composer.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}

// ───────────── helpers ─────────────

function stone(seed: number) {
  const t = tex.stone(seed);
  t.repeat.set(1, 1);
  return t;
}

function mulberry(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tombstone(mat: THREE.Material, r: () => number) {
  const g = new THREE.Group();
  const w = 0.5 + r() * 0.35;
  const h = 0.6 + r() * 0.6;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), mat);
  slab.position.y = h / 2;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.14, 16, 1, false, 0, Math.PI), mat);
  top.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  top.rotation.set(0, 0, 0);
  top.rotation.x = Math.PI / 2;
  top.rotation.z = -Math.PI / 2;
  top.position.y = h;
  g.add(slab, top);
  return g;
}

function cross(mat: THREE.Material) {
  const g = new THREE.Group();
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), mat);
  v.position.y = 0.6;
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.12), mat);
  h.position.y = 0.88;
  g.add(v, h);
  return g;
}

function deadTree(mat: THREE.Material, r: () => number) {
  const g = new THREE.Group();
  const branch = (parent: THREE.Object3D, len: number, rad: number, depth: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.6, rad, len, 5), mat);
    m.position.y = len / 2;
    const pivot = new THREE.Group();
    pivot.add(m);
    parent.add(pivot);
    const end = new THREE.Group();
    end.position.y = len;
    pivot.add(end);
    if (depth > 0) {
      for (let i = 0; i < 2 + (r() < 0.4 ? 1 : 0); i++) {
        const c = new THREE.Group();
        c.rotation.set((r() - 0.5) * 1.4, r() * Math.PI * 2, (r() - 0.5) * 1.4);
        end.add(c);
        branch(c, len * 0.68, rad * 0.62, depth - 1);
      }
    }
    return pivot;
  };
  branch(g, 1.6, 0.14, 4);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

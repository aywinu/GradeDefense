/**
 * Synthesised sound (WebAudio, no assets, no copyrighted music). Every cue
 * also has a visual counterpart in the UI, so sound is never required.
 */
import { load, save } from '../save/save';

type Cue =
  | 'correct' | 'wrong' | 'seal' | 'forge' | 'bell' | 'hit' | 'kill' | 'fortress'
  | 'special' | 'heartbeat' | 'crit' | 'enrage' | 'click' | 'victory' | 'defeat';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let droneNodes: AudioNode[] = [];

function ac(): AudioContext | null {
  if (load().settings.muted) return null;
  try {
    ctx ??= new AudioContext();
    if (!master) {
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, glideTo?: number) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, gain: number, when = 0, filterFreq = 1200, q = 0.7) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + when;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filterFreq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

let lastHit = 0;

export function sfx(cue: Cue): void {
  switch (cue) {
    case 'correct':
      tone(660, 0.18, 'triangle', 0.25);
      tone(990, 0.3, 'triangle', 0.2, 0.08);
      break;
    case 'wrong':
      tone(220, 0.3, 'sine', 0.22, 0, 160);
      break;
    case 'seal':
      noise(0.25, 0.4, 0, 400);
      tone(130, 0.4, 'sine', 0.3);
      break;
    case 'forge':
      noise(0.12, 0.5, 0, 3000, 2);
      tone(392, 0.6, 'triangle', 0.25, 0.05);
      tone(587, 0.8, 'triangle', 0.2, 0.15);
      tone(784, 1.0, 'triangle', 0.16, 0.25);
      break;
    case 'bell':
      [1, 2.76, 5.4].forEach((m, i) => tone(196 * m, 2.4 - i * 0.6, 'sine', 0.18 / (i + 1)));
      break;
    case 'hit': {
      const now = performance.now();
      if (now - lastHit < 45) return; // avoid a wall of clicks
      lastHit = now;
      noise(0.05, 0.12, 0, 2400, 3);
      break;
    }
    case 'kill':
      tone(520, 0.25, 'sine', 0.12, 0, 260);
      noise(0.18, 0.15, 0, 900);
      break;
    case 'fortress':
      tone(80, 0.5, 'sawtooth', 0.25, 0, 50);
      noise(0.4, 0.3, 0, 200);
      break;
    case 'special':
      noise(1.2, 0.5, 0, 500, 0.5);
      tone(110, 1.2, 'sawtooth', 0.2, 0, 440);
      tone(220, 1.0, 'triangle', 0.2, 0.2, 880);
      break;
    case 'heartbeat':
      tone(60, 0.16, 'sine', 0.5);
      tone(55, 0.2, 'sine', 0.4, 0.22);
      break;
    case 'crit':
      noise(0.5, 0.5, 0, 1800, 1);
      tone(880, 0.5, 'square', 0.12, 0, 220);
      tone(330, 0.9, 'triangle', 0.25, 0.05);
      break;
    case 'enrage':
      tone(90, 0.9, 'sawtooth', 0.3, 0, 140);
      noise(0.8, 0.3, 0, 300);
      break;
    case 'click':
      tone(1400, 0.04, 'square', 0.05);
      break;
    case 'victory':
      [392, 494, 587, 784].forEach((f, i) => tone(f, 1.4, 'triangle', 0.18, i * 0.14));
      break;
    case 'defeat':
      [294, 277, 262, 196].forEach((f, i) => tone(f, 1.2, 'sine', 0.2, i * 0.3));
      break;
  }
}

/** Low drone pad for battles. */
export function startDrone(): void {
  const c = ac();
  if (!c || !master || droneNodes.length) return;
  const g = c.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(0.06, c.currentTime + 3);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 420;
  [55, 82.4, 110.5].forEach((fr) => {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = fr;
    o.detune.value = Math.random() * 12 - 6;
    o.connect(f);
    o.start();
    droneNodes.push(o);
  });
  f.connect(g).connect(master);
  droneNodes.push(f, g);
}

export function stopDrone(): void {
  droneNodes.forEach((n) => {
    try {
      (n as OscillatorNode).stop?.();
    } catch {
      /* already stopped */
    }
    n.disconnect();
  });
  droneNodes = [];
}

export function isMuted(): boolean {
  return load().settings.muted;
}

export function setMuted(m: boolean): void {
  save((d) => (d.settings.muted = m));
  if (m) stopDrone();
  if (master && ctx) master.gain.value = m ? 0 : 0.5;
}

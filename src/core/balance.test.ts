/**
 * Headless campaign simulation over the demo semester: proves the design rule
 * "studying matters" with Kiro's pure simulation (no rendering).
 */
import { describe, it, expect } from 'vitest';
import demo from '../data/demo.json';
import { resolveSemester } from './semester';
import { generateWave, campaignLength } from './wave';
import { stepSimulation } from './sim';
import { mulberry32 } from './rng';
import { BALANCE, forgeMultipliers } from './balance';
import type { GameState, DemoSemester } from './types';

const laneY = (i: number) => 110 + (i + 0.5) * (760 / 6);
const NOW = Date.UTC(2026, 10, 26, 12);

function campaignDamage(forge: number, extraSockets: number): number {
  const s = resolveSemester(demo as unknown as DemoSemester, new Date(NOW));
  const n = campaignLength(s, NOW);
  const m = forgeMultipliers(forge);
  let taken = 0;
  for (let w = 1; w <= n; w++) {
    const rng = mulberry32(w);
    const towers = s.courses.flatMap((c, i) =>
      BALANCE.sockets.slice(0, 1 + extraSockets).map((x) => ({
        courseId: c.id, x, y: laneY(i) + 8,
        range: BALANCE.tower.range * m.range, damage: BALANCE.tower.damage * m.damage, fireRate: BALANCE.tower.fireRate * m.fireRate,
        lastFiredAt: -9999, upgrades: { damage: 0, speed: 0, range: 0 },
      })),
    );
    const pending = generateWave(s, w, NOW, rng).map((e) => ({
      ...e, x: 1650, y: laneY(e.lane), pathProgress: 0, progress: 0,
      hp: e.hp * BALANCE.enemyHpScale, maxHp: e.maxHp * BALANCE.enemyHpScale, damage: Math.round(e.damage * BALANCE.enemyDamageScale),
    }));
    let st: GameState = { wave: w, gold: 0, fortressHp: 1000, maxFortressHp: 1000, towers, enemies: [], pending, chargeMeter: 0, special: 0, answeredQuestions: [], lastAnswerTime: 0, timeMs: 0 };
    let t = 0;
    let waveDmg = 0;
    while ((st.enemies.length || st.pending.length) && t < 600_000) {
      const r = stepSimulation(st, 16, { fortressX: 150, spawnX: 1650, waveStartTimeMs: 0 }, rng);
      for (const ev of r.events) if (ev.type === 'fortressHit') waveDmg += ev.damage;
      st = r.state;
      t += 16;
    }
    taken += waveDmg;
    taken = Math.max(0, taken - BALANCE.waveClearHeal);
  }
  return taken;
}

describe('campaign balance (headless)', () => {
  it('an idle player who never studies loses the demo semester', () => {
    expect(campaignDamage(0, 0)).toBeGreaterThanOrEqual(100);
  });
  it('a player who trains (forge 2) and raises one extra sentinel per lane holds it', () => {
    expect(campaignDamage(2, 1)).toBeLessThan(60);
  });
  it('more studying never makes the campaign harder', () => {
    const a = campaignDamage(1, 1);
    const b = campaignDamage(3, 1);
    expect(b).toBeLessThanOrEqual(a);
  });
});

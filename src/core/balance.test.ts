/**
 * Headless campaign simulation over the demo semester: proves the design rule
 * "studying matters" with Kiro's pure simulation (no rendering).
 * 
 * Duel Combat (R18): No towers, creatures creep toward the altar, only
 * player answers reduce their seals. Idle player loses, studious player holds.
 */
import { describe, it, expect } from 'vitest';
import demo from '../data/demo.json';
import { resolveSemester } from './semester';
import { generateWave, campaignLength } from './wave';
import { stepSimulation } from './sim';
import { mulberry32 } from './rng';
import { BALANCE } from './balance';
import { sealsFor, applyAnswer, creepSpeed } from './duel';
import type { GameState, DemoSemester, EnemyStats } from './types';

const NOW = Date.UTC(2026, 10, 26, 12);
const LANE_SPAN = 1500; // Distance from spawn to fortress in px

interface SimConfig {
  answerEveryMs: number; // How often the student answers (0 = never)
  accuracy: number; // Probability of correct answer (0-1)
  seed: number; // RNG seed for determinism
}

/**
 * Simulate the entire demo semester campaign with a student who answers
 * questions at a given rate and accuracy.
 * 
 * Returns total breach damage taken across all waves.
 */
function campaignDamage(config: SimConfig): number {
  const s = resolveSemester(demo as unknown as DemoSemester, new Date(NOW));
  const n = campaignLength(s, NOW);
  const rng = mulberry32(config.seed);
  
  let totalDamage = 0;
  
  for (let w = 1; w <= n; w++) {
    const waveRng = mulberry32(w);
    
    // Generate wave with same minion filtering as BattleScene
    const list = generateWave(s, w, NOW, waveRng);
    const minionsPer = new Map<string, number>();
    const kept = list.filter((e) => {
      if (!e.isMinion) return true;
      const k = e.parentItemId ?? e.itemId;
      const n = (minionsPer.get(k) ?? 0) + 1;
      minionsPer.set(k, n);
      return n <= 2;
    });
    
    // Convert to simulation enemies with duel combat stats
    const pending = kept.map((e) => {
      const item = s.courses.flatMap((c) => c.items).find((it) => it.id === (e.parentItemId ?? e.itemId));
      const seals = sealsFor(e, item?.points ?? 20);
      const speed = creepSpeed(e.type, !!e.isMinion, e.daysLeft) * LANE_SPAN * BALANCE.creepScale;
      const damage = e.isMinion ? 5 : e.type === 'exam' ? 30 : 15;
      
      return {
        ...e,
        x: 1650,
        y: 110 + (e.lane + 0.5) * (760 / 6),
        pathProgress: 0,
        progress: 0,
        hp: seals,
        maxHp: seals,
        speed,
        damage,
      };
    });
    
    // Simulate the wave (no towers in duel combat)
    let state: GameState = {
      wave: w,
      gold: 0,
      fortressHp: 1000,
      maxFortressHp: 1000,
      towers: [],
      enemies: [],
      pending,
      chargeMeter: 0,
      special: 0,
      answeredQuestions: [],
      lastAnswerTime: 0,
      timeMs: 0,
    };
    
    let waveDamage = 0;
    let lastAnswerTime = 0;
    let streak = 0; // Track consecutive correct answers
    const maxTime = 600_000; // 10 minutes max per wave
    
    while ((state.enemies.length > 0 || state.pending.length > 0) && state.timeMs < maxTime) {
      // Student answers questions at the configured rate
      if (config.answerEveryMs > 0 && state.timeMs - lastAnswerTime >= config.answerEveryMs) {
        // Find creature closest to fortress (highest progress)
        const target = state.enemies.reduce<EnemyStats | null>((closest, e) => {
          if (!closest || e.progress > closest.progress) return e;
          return closest;
        }, null);
        
        if (target) {
          lastAnswerTime = state.timeMs;
          const correct = rng() < config.accuracy;
          
          // Apply answer to target's duel state
          const result = applyAnswer(
            { seals: target.hp, maxSeals: target.maxHp, progress: target.progress },
            correct,
            streak
          );
          
          // Update streak
          if (correct) {
            streak += 1;
          } else {
            streak = 0;
          }
          
          // Update enemy state
          target.hp = result.state.seals;
          target.progress = result.state.progress;
          
          // Recalculate x from progress (since stepSimulation recalculates progress from x)
          // progress = 1 - (x - fortressX) / (spawnX - fortressX)
          // => x = fortressX + (1 - progress) * (spawnX - fortressX)
          target.x = 150 + (1 - target.progress) * (1650 - 150);
          target.pathProgress = target.progress;
          
          // Remove if defeated
          if (target.hp <= 0) {
            state.enemies = state.enemies.filter((e) => e.id !== target.id);
          }
        }
      }
      
      // Step simulation (handles movement and fortress hits)
      const result = stepSimulation(state, 16, { fortressX: 150, spawnX: 1650, waveStartTimeMs: 0 }, waveRng);
      
      // Count fortress damage
      for (const ev of result.events) {
        if (ev.type === 'fortressHit') {
          waveDamage += ev.damage;
        }
      }
      
      state = result.state;
    }
    
    totalDamage += waveDamage;
    
    // Apply wave clear healing
    totalDamage = Math.max(0, totalDamage - BALANCE.waveClearHeal);
  }
  
  return totalDamage;
}

describe('campaign balance (headless duel combat)', () => {
  it('an idle student (never answers) loses the demo semester', () => {
    const damage = campaignDamage({ answerEveryMs: 0, accuracy: 0, seed: 42 });
    expect(damage).toBeGreaterThanOrEqual(100);
  });
  
  it('a student who answers every 10s with 75% accuracy keeps total breach damage < 60', () => {
    const damage = campaignDamage({ answerEveryMs: 10_000, accuracy: 0.75, seed: 42 });
    expect(damage).toBeLessThan(60);
  });
  
  it('monotonicity: answering more often (every 8s vs every 14s) never takes more damage', () => {
    const fast = campaignDamage({ answerEveryMs: 8_000, accuracy: 0.75, seed: 42 });
    const slow = campaignDamage({ answerEveryMs: 14_000, accuracy: 0.75, seed: 42 });
    expect(fast).toBeLessThanOrEqual(slow);
  });
  
  it('monotonicity: higher accuracy (0.9 vs 0.6) never takes more damage', () => {
    const high = campaignDamage({ answerEveryMs: 10_000, accuracy: 0.9, seed: 42 });
    const low = campaignDamage({ answerEveryMs: 10_000, accuracy: 0.6, seed: 42 });
    expect(high).toBeLessThanOrEqual(low);
  });
});

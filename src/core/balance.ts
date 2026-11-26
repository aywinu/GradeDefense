/**
 * Balance constants, tuned with the headless campaign simulation in
 * balance.test.ts so that studying matters: an idle player loses the demo
 * semester, a player who trains (forge levels) and builds holds it.
 */
export const BALANCE = {
  enemyHpScale: 3,
  enemyDamageScale: 2.5,
  tower: { damage: 14, fireRate: 1.1, range: 290 },
  sockets: [300, 640, 980],
  socketCost: [0, 60, 110],
  forgePerLevel: { damage: 0.25, fireRate: 0.12, range: 0.05 },
  waveClearHeal: 10,
} as const;

export function forgeMultipliers(level: number): { damage: number; fireRate: number; range: number } {
  const f = BALANCE.forgePerLevel;
  return { damage: 1 + level * f.damage, fireRate: 1 + level * f.fireRate, range: 1 + level * f.range };
}

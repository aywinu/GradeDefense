/**
 * Deterministic random number generation for Deadline Defense.
 * Pure functions with no side effects.
 */

/**
 * RNG function type (same as Math.random).
 * Returns a number in [0, 1).
 */
export type RngFunction = () => number;

/**
 * Mulberry32 is a simple, fast, and good quality seeded RNG.
 * Returns a function that generates pseudo-random numbers in [0, 1).
 * 
 * @param seed - Seed value (any integer)
 * @returns RNG function
 */
export function mulberry32(seed: number): RngFunction {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

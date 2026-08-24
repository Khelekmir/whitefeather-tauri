import type { ItemizedHealth } from '../../types/characters';

/** Port of utils_old CalcStaminaPenalty */
export function calcStaminaPenalty(staminaCap: number, staminaCurrent: number): number {
  if (staminaCap <= 0) return 0.1;
  return Math.sqrt(Math.max(0, staminaCurrent) / staminaCap);
}

/**
 * Port of utils_old CalcWeightPenalty (single-hand form).
 * Guarded against invalid log arguments.
 */
export function calcWeightPenalty(constitution: number, weight: number): number {
  const logNumber = 12;
  const arg = logNumber - (weight - constitution);
  if (arg <= 1) return 0.05;
  return Math.min(1, Math.log(arg) / Math.log(logNumber));
}

/**
 * Simplified stand-in for CalcHealthPenalty(weaponAttackPower).
 * Full bodypartHealthCombatModifiers table can replace this later.
 */
export function calcHealthPenaltySimple(itemizedHealth: ItemizedHealth): number {
  const parts = Object.values(itemizedHealth);
  if (parts.length === 0) return 1;
  const avg = parts.reduce((sum, p) => sum + (p.health ?? 1), 0) / parts.length;
  return Math.max(0.15, Math.sqrt(Math.max(0, avg)));
}

export function roundToThousandths(n: number): number {
  return Math.round(n * 1000) / 1000;
}

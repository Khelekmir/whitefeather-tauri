import type { BodyPartId, ItemizedHealth } from '../../types/characters';
import {
  BODYPART_COMBAT_MODIFIERS,
  type CombatPenaltyStat,
} from '../../data/combat/bodypartCombatModifiers';

/** Port of utils_old CalcStaminaPenalty */
export function calcStaminaPenalty(staminaCap: number, staminaCurrent: number): number {
  if (staminaCap <= 0) return 0.1;
  return Math.sqrt(Math.max(0, staminaCurrent) / staminaCap);
}

/**
 * Port of utils_old CalcWeightPenalty.
 * `weight` may be mainhand-only or mainhand+offhand combined (old dodge form).
 * Guarded against invalid log arguments.
 */
export function calcWeightPenalty(constitution: number, weight: number): number {
  const logNumber = 12;
  const arg = logNumber - (weight - constitution);
  if (arg <= 1) return 0.05;
  return Math.min(1, Math.log(arg) / Math.log(logNumber));
}

/**
 * Port of utils_old CalcHealthPenalty.
 * degradation += (1 − √health) × weight per part; return max(0, 1 − sum).
 */
export function calcHealthPenalty(
  itemizedHealth: ItemizedHealth,
  stat: CombatPenaltyStat
): number {
  const modifiers = BODYPART_COMBAT_MODIFIERS[stat];
  if (!modifiers) return 1;

  let totalDegradation = 0;
  for (const [part, weight] of Object.entries(modifiers) as [
    BodyPartId,
    number,
  ][]) {
    if (!weight) continue;
    const health = Math.max(
      0,
      Math.min(1, itemizedHealth[part]?.health ?? 1)
    );
    const reducedPerformance = 1 - Math.sqrt(health);
    totalDegradation += reducedPerformance * weight;
  }
  return Math.max(0, 1 - totalDegradation);
}

/**
 * Simplified stand-in for attack-power health degradation (avg √health).
 * Prefer calcHealthPenalty for dodge/parry.
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

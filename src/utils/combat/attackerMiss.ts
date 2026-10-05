import type { Unit as DetailedUnit } from '../../types/characters';
import type { Item } from '../../types/items';
import { COMBAT_TUNING } from './combatTuning';
import { calcRhythmCompetence } from './rhythmCompetence';
import { roundToThousandths } from './penalties';

/**
 * NPC (or any attacker) intrinsic miss chance from competence alone.
 * Never 0; never above missChanceMax (33%) even at zero skill.
 *
 * competence 0    → missChanceMax
 * competence 1.25 → missChanceMin
 */
export function calcAttackerMissChance(
  attacker: DetailedUnit,
  weaponType: string,
  itemsById?: Record<string, Item>
): { chance: number; competence: number } {
  const t = COMBAT_TUNING.attackerMiss;
  const strike = attacker.combatStats.currentStance.strike;
  const { competence } = calcRhythmCompetence(attacker, weaponType, strike, {
    itemsById,
  });
  const c = Math.max(0, Math.min(1.25, competence));
  // High competence → low miss; lerp max → min across 0..1.25
  const tNorm = c / 1.25;
  const chance = roundToThousandths(
    t.missChanceMax + (t.missChanceMin - t.missChanceMax) * tNorm
  );
  return {
    chance: Math.max(t.missChanceMin, Math.min(t.missChanceMax, chance)),
    competence: roundToThousandths(c),
  };
}

export function rollAttackerMiss(
  attacker: DetailedUnit,
  weaponType: string,
  rng: () => number = Math.random,
  itemsById?: Record<string, Item>
): { missed: boolean; chance: number; roll: number; competence: number } {
  const { chance, competence } = calcAttackerMissChance(
    attacker,
    weaponType,
    itemsById
  );
  const roll = rng();
  return {
    missed: roll < chance,
    chance,
    roll: roundToThousandths(roll),
    competence,
  };
}

import { BODY_PARTS, type Unit as DetailedUnit } from '../../types/characters';
import {
  calcBloodCombatPenalties,
  getBloodStatus,
} from './bloodVolume';
import { COMBAT_TUNING } from './combatTuning';
import {
  calcPartBleedRate,
  deriveHealthFromItemized,
  getBleedIntensity,
} from './deriveHealthPool';
import { roundToThousandths } from './penalties';
import type { FighterState } from './resolveBasicAttack';

export interface BleedTickResult {
  log: string[];
  /** Minutes simulated. */
  minutes: number;
  bloodLossDelta: number;
  staminaDelta: number;
  totalBleedRate: number;
  fighter: FighterState;
}

/**
 * Advance bleeding by `minutes`.
 *
 * - Does **not** change part.health (wound state stays as injured).
 * - Increases systemic bloodLoss in **liters** from current bleed rates.
 * - Drains stamina points directly + blood-fraction stamina effectiveness applies in combat.
 * - Clots (reduces part.bleed) over time, except ruined undressed parts.
 */
export function tickBleed(
  fighterIn: FighterState,
  minutes: number
): BleedTickResult {
  const fighter: FighterState = {
    unit: structuredClone(fighterIn.unit) as DetailedUnit,
    itemsById: structuredClone(fighterIn.itemsById),
  };
  const log: string[] = [];
  const dt = Math.max(0, minutes);
  const base = fighter.unit.combatStats.base;
  const itemized = fighter.unit.combatStats.itemizedHealth;

  if (dt <= 0) {
    return {
      log: ['No time passed.'],
      minutes: 0,
      bloodLossDelta: 0,
      staminaDelta: 0,
      totalBleedRate: 0,
      fighter,
    };
  }

  let totalRate = 0;
  for (const part of BODY_PARTS) {
    totalRate += calcPartBleedRate(part, itemized[part]);
  }

  const bloodLossDelta = roundToThousandths(
    totalRate * dt * COMBAT_TUNING.bleedToBloodLossScale
  );
  const staminaDelta = roundToThousandths(
    totalRate * dt * COMBAT_TUNING.bleedToStaminaScale
  );

  base.bloodLoss = roundToThousandths((base.bloodLoss ?? 0) + bloodLossDelta);
  base.staminaCurrent = Math.max(
    0,
    roundToThousandths(base.staminaCurrent - staminaDelta)
  );

  for (const part of BODY_PARTS) {
    const s = itemized[part];
    if (!s) continue;

    if (s.health <= 0 && !s.dressed) {
      s.bleed = COMBAT_TUNING.unclottableRuinedIntensity;
      continue;
    }

    if (getBleedIntensity(s) <= 0) {
      s.bleed = 0;
      continue;
    }

    const clot = COMBAT_TUNING.clotRatePerMinute * dt;
    if (s.health >= 1) {
      s.bleed = Math.max(0, s.bleed - clot);
    } else {
      const floor = (1 - s.health) * 0.2;
      s.bleed = Math.max(floor, s.bleed - clot);
    }
  }

  const blood = getBloodStatus(fighter.unit);
  const bloodPen = calcBloodCombatPenalties(blood.remainingFraction);
  const derived = deriveHealthFromItemized(
    itemized,
    base.health,
    base.bloodLoss,
    bloodPen.vitality
  );
  base.healthCurrent = derived.healthCurrent;

  log.push(
    `${fighter.unit.name}: ${dt} min — bleed rate ${totalRate.toFixed(2)} → lost +${bloodLossDelta.toFixed(3)} L (total ${base.bloodLoss.toFixed(3)} / ${blood.volumeLiters.toFixed(2)} L), stamina −${staminaDelta}.`
  );
  log.push(
    `Blood remaining ${(blood.remainingFraction * 100).toFixed(0)}% (${blood.lossClass}) · stamina factor ${bloodPen.stamina.toFixed(2)} · HP ${derived.healthCurrent.toFixed(1)}/${base.health}.`
  );
  if (derived.totalBleedRate > 0) {
    log.push(`Remaining bleed rate after clotting: ${derived.totalBleedRate.toFixed(2)}.`);
  } else {
    log.push('Bleeding has stopped.');
  }

  return {
    log,
    minutes: dt,
    bloodLossDelta,
    staminaDelta,
    totalBleedRate: derived.totalBleedRate,
    fighter,
  };
}

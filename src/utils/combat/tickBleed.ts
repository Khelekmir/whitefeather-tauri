import { BODY_PARTS, type Unit as DetailedUnit } from '../../types/characters';
import {
  applyBleedSoilToLoadout,
  type BleedSoilEntry,
} from './bleedClothSoil';
import {
  calcBloodCombatPenalties,
  getBloodStatus,
} from './bloodVolume';
import { COMBAT_TUNING } from './combatTuning';
import {
  calcPartBleedRate,
  deriveHealthFromItemized,
  getExternalBleedIntensity,
  getInternalBleedIntensity,
} from './deriveHealthPool';
import { roundToThousandths } from './penalties';
import type { FighterState } from './resolveBasicAttack';
import {
  applyNaturalHealing,
  clotRatePerMinute,
  clotRatePerMinuteInternal,
} from './woundCare';
import { fadeAllBruises, bruiseFlavor } from './bruise';
import { formatBodyPartLabel } from '../../types/characters';

export interface BleedTickResult {
  log: string[];
  /** Minutes simulated. */
  minutes: number;
  bloodLossDelta: number;
  staminaDelta: number;
  totalBleedRate: number;
  /** Cloth/armor blood soil deposited this tick. */
  soilEntries: BleedSoilEntry[];
  fighter: FighterState;
}

/**
 * Advance bleeding + natural healing by `minutes`.
 *
 * - Raises part.health via natural heal (bandage / vulnerary accelerate).
 * - Increases systemic bloodLoss in **liters** from current bleed rates.
 * - Drains stamina points directly + blood-fraction stamina effectiveness applies in combat.
 * - Soils covering armor/clothing from active bleeds (innermost layer first).
 * - Clots (reduces part.bleed) over time — faster when dressed / vulnerary;
 *   ruined undressed parts stay at max bleed.
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
      soilEntries: [],
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

  // Soil from rates during this interval (before clotting reduces intensity).
  const soil = applyBleedSoilToLoadout(fighter.unit, fighter.itemsById, dt);

  for (const part of BODY_PARTS) {
    const s = itemized[part];
    if (!s) continue;

    // —— External channel ——
    if (s.health <= 0 && !s.dressed) {
      s.bleed = COMBAT_TUNING.unclottableRuinedIntensity;
    } else if (getExternalBleedIntensity(s) <= 0) {
      s.bleed = 0;
    } else {
      const clotExt = clotRatePerMinute(s) * dt;
      if (s.health >= 1) {
        s.bleed = Math.max(0, s.bleed - clotExt);
      } else {
        // Soft floor while wound remains — does not force bleed from health alone.
        const floor = Math.min(s.bleed, (1 - s.health) * 0.15);
        s.bleed = Math.max(floor, s.bleed - clotExt);
      }
    }

    // —— Internal channel (dressing irrelevant; always clotable) ——
    if (getInternalBleedIntensity(s) <= 0) {
      s.internalBleed = 0;
    } else {
      const clotInt = clotRatePerMinuteInternal(s) * dt;
      s.internalBleed = Math.max(0, s.internalBleed - clotInt);
    }
  }

  const heal = applyNaturalHealing(itemized, dt);
  const bruiseFaded = fadeAllBruises(itemized, dt);

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
  if (heal.healedParts.length > 0) {
    log.push(
      `Natural heal: ${heal.healedParts
        .map((p) => formatBodyPartLabel(p))
        .join(', ')}.`
    );
  }
  if (heal.clearedCare.length > 0) {
    log.push(
      `Care removed (healed): ${heal.clearedCare
        .map((p) => formatBodyPartLabel(p))
        .join(', ')}.`
    );
  }
  if (bruiseFaded.length > 0) {
    const sample = bruiseFaded.slice(0, 3).map((p) => {
      const sev = itemized[p]?.bruise ?? 0;
      const fl = bruiseFlavor(sev);
      return `${formatBodyPartLabel(p)}${sev > 0 ? ` (${fl.label})` : ' (cleared)'}`;
    });
    log.push(
      `Bruises easing: ${sample.join(', ')}${bruiseFaded.length > 3 ? '…' : ''}.`
    );
  }
  log.push(
    `Blood remaining ${(blood.remainingFraction * 100).toFixed(0)}% (${blood.lossClass}) · stamina factor ${bloodPen.stamina.toFixed(2)} · HP ${derived.healthCurrent.toFixed(1)}/${base.health}.`
  );
  if (soil.soiledNames.length > 0) {
    const byName = new Map<string, number>();
    for (const e of soil.entries) {
      byName.set(e.name, (byName.get(e.name) ?? 0) + e.amount01);
    }
    const bits = [...byName.entries()]
      .map(([name, amt]) => `${name} (+${(amt * 100).toFixed(0)} wet)`)
      .join(', ');
    log.push(`Bleed soaks into cloth: ${bits}.`);
  }
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
    soilEntries: soil.entries,
    fighter,
  };
}

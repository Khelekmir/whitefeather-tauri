import {
  BLEED_CRITICALITY_RATE,
  BODYPART_VITALITY,
  getBodypartVitality,
} from '../../data/combat/bodypartVitality';
import {
  BODY_PARTS,
  type BodyPartHealth,
  type BodyPartId,
  type ItemizedHealth,
} from '../../types/characters';
import {
  normalizeBleedSplit,
  type BleedSplit,
} from './bleedSplit';
import { applyBruiseFromHit } from './bruise';
import {
  careExternalFlowMult,
  hypovolemiaFlowMult,
} from './bloodVolume';
import { COMBAT_TUNING } from './combatTuning';
import { lodgedExternalBleedMult } from './lodgedArrow';
import { roundToThousandths } from './penalties';

export interface DerivedHealth {
  /** 0–1 weighted average of part health (wound state only). */
  vitalityRatio: number;
  /**
   * vitalityRatio × healthCap × bloodVitalityFactor.
   * Blood loss mostly hits stamina; only severe+ hemorrhage soft-touches HP.
   */
  healthCurrent: number;
  healthCap: number;
  /** Liters lost (same units as blood volume). */
  bloodLossLiters: number;
  /** Sum of effective bleed rates across injured parts (external + internal). */
  totalBleedRate: number;
  partsBleeding: {
    part: BodyPartId;
    /** Separate from bleed — structural / functional injury. */
    health: number;
    bleedIntensity: number;
    internalBleedIntensity: number;
    externalRate: number;
    internalRate: number;
    rate: number;
    criticality: string;
  }[];
}

type BleedState = Pick<
  BodyPartHealth,
  | 'health'
  | 'bleed'
  | 'internalBleed'
  | 'dressed'
  | 'vulnerary'
  | 'directPressure'
  | 'lodgedArrow'
>;

/**
 * Ruined + undressed + no pressure: cannot clot; intensity may relapse
 * upward (see ruinedBleedRelapsePerMinute) but is not snapped to 1.
 */
export function isExternalBleedPinned(state: BleedState): boolean {
  return (
    Math.max(0, state.health) <= 0 &&
    !state.dressed &&
    !state.directPressure
  );
}

/**
 * Compile pool HP from itemized part *health* (wounds), with a soft blood-vitality factor.
 *
 * part.health and part.bleed stay independent:
 * - Foot at 0 health → tiny vitality hit, but huge mobility/dodge penalty elsewhere.
 * - Foot at 0 also forces max bleed intensity until dressed/tourniquet.
 * - Liters lost mainly drain stamina effectiveness (see bloodVolume.ts).
 */
export function deriveHealthFromItemized(
  itemizedHealth: ItemizedHealth,
  healthCap: number,
  bloodLossLiters = 0,
  bloodVitalityFactor = 1
): DerivedHealth {
  let weighted = 0;
  let totalWeight = 0;

  for (const part of BODY_PARTS) {
    const w = BODYPART_VITALITY[part].vitalityWeight;
    const h = itemizedHealth[part]?.health ?? 1;
    weighted += Math.max(0, Math.min(1, h)) * w;
    totalWeight += w;
  }

  const vitalityRatio = totalWeight > 0 ? weighted / totalWeight : 1;
  const fromParts = vitalityRatio * healthCap;
  const healthCurrent = roundToThousandths(
    Math.max(
      0,
      Math.min(healthCap, fromParts * Math.max(0.5, Math.min(1, bloodVitalityFactor)))
    )
  );

  const bleed = summarizeBleed(itemizedHealth);

  return {
    vitalityRatio: roundToThousandths(vitalityRatio),
    healthCurrent,
    healthCap,
    bloodLossLiters: Math.max(0, bloodLossLiters),
    totalBleedRate: bleed.totalBleedRate,
    partsBleeding: bleed.partsBleeding,
  };
}

function partBaseBleedRate(part: BodyPartId): number {
  const vit = getBodypartVitality(part);
  return (
    vit.maxBleedRate * (BLEED_CRITICALITY_RATE[vit.bleedCriticality] / 10)
  );
}

/** External open-bleed intensity (0–1). Uses stored bleed (no snap-to-max). */
export function getExternalBleedIntensity(state: BleedState): number {
  const health = Math.max(0, Math.min(1, state.health));
  const bleed = Math.max(0, Math.min(1, state.bleed ?? 0));
  if (health >= 1 && bleed <= 0) return 0;
  return bleed;
}

/** Internal bleed intensity (0–1). Not pinned by ruined/dressing. */
export function getInternalBleedIntensity(state: BleedState): number {
  return Math.max(0, Math.min(1, state.internalBleed ?? 0));
}

/** @deprecated Prefer getExternalBleedIntensity — kept for call sites. */
export function getBleedIntensity(state: BleedState): number {
  return getExternalBleedIntensity(state);
}

/**
 * Care factor for vulnerary on internal channel (75% efficiency default).
 * Maps full vulnerary rate mult (0.25) toward 1 by (1 − efficiency).
 */
export function vulneraryInternalRateMult(vulnerary: boolean): number {
  if (!vulnerary) return 1;
  const full = COMBAT_TUNING.vulneraryExternalRateMult;
  const eff = COMBAT_TUNING.vulneraryInternalEfficiency;
  return 1 - (1 - full) * eff;
}

export function calcPartExternalBleedRate(
  part: BodyPartId,
  state: BleedState,
  bloodLostFraction = 0
): number {
  const intensity = getExternalBleedIntensity(state);
  if (intensity <= 0) return 0;
  const arterial =
    getBodypartVitality(part).bleedCriticality === 'arterial';
  let rate = partBaseBleedRate(part) * intensity;
  rate *= careExternalFlowMult(state);
  rate *= hypovolemiaFlowMult(bloodLostFraction, arterial);
  // Lodged shaft plugs the open channel (style mult).
  rate *= lodgedExternalBleedMult(state);
  return roundToThousandths(rate);
}

export function calcPartInternalBleedRate(
  part: BodyPartId,
  state: BleedState,
  bloodLostFraction = 0
): number {
  const intensity = getInternalBleedIntensity(state);
  if (intensity <= 0) return 0;
  const arterial =
    getBodypartVitality(part).bleedCriticality === 'arterial';
  let rate =
    partBaseBleedRate(part) *
    intensity *
    COMBAT_TUNING.internalBleedRateMult;
  // Dressing does not help internal; vulnerary at reduced efficiency.
  rate *= vulneraryInternalRateMult(!!state.vulnerary);
  rate *= hypovolemiaFlowMult(bloodLostFraction, arterial);
  return roundToThousandths(rate);
}

/** Combined external + internal rate (blood loss / stamina). */
export function calcPartBleedRate(
  part: BodyPartId,
  state: BleedState,
  bloodLostFraction = 0
): number {
  return roundToThousandths(
    calcPartExternalBleedRate(part, state, bloodLostFraction) +
      calcPartInternalBleedRate(part, state, bloodLostFraction)
  );
}

export function summarizeBleed(
  itemizedHealth: ItemizedHealth,
  bloodLostFraction = 0
): {
  totalBleedRate: number;
  partsBleeding: DerivedHealth['partsBleeding'];
} {
  const partsBleeding: DerivedHealth['partsBleeding'] = [];
  let totalBleedRate = 0;

  for (const part of BODY_PARTS) {
    const s = itemizedHealth[part];
    if (!s) continue;
    const externalRate = calcPartExternalBleedRate(part, s, bloodLostFraction);
    const internalRate = calcPartInternalBleedRate(part, s, bloodLostFraction);
    const rate = roundToThousandths(externalRate + internalRate);
    const bleedIntensity = getExternalBleedIntensity(s);
    const internalBleedIntensity = getInternalBleedIntensity(s);

    if (
      bleedIntensity > 0 ||
      internalBleedIntensity > 0 ||
      s.health < 1
    ) {
      const vit = getBodypartVitality(part);
      partsBleeding.push({
        part,
        health: s.health,
        bleedIntensity: roundToThousandths(bleedIntensity),
        internalBleedIntensity: roundToThousandths(internalBleedIntensity),
        externalRate,
        internalRate,
        rate,
        criticality: vit.bleedCriticality,
      });
      totalBleedRate += rate;
    }
  }

  partsBleeding.sort((a, b) => b.rate - a.rate);

  return {
    totalBleedRate: roundToThousandths(totalBleedRate),
    partsBleeding,
  };
}

export interface RefreshBleedOpts {
  /** Chip applied this hit (0–1). Required for split apply. */
  damagePercent: number;
  /** Default full external. */
  split?: BleedSplit;
}

/**
 * After damaging a part: raise bleed channels from this hit's damage × split.
 * Does NOT change part.health. No auto-floor to (1 − health).
 */
export function refreshBleedAfterInjury(
  itemizedHealth: ItemizedHealth,
  part: BodyPartId,
  opts?: RefreshBleedOpts
): void {
  const s = itemizedHealth[part];
  if (!s) return;
  const health = Math.max(0, Math.min(1, s.health));
  if (health >= 1) {
    s.bleed = 0;
    s.internalBleed = 0;
    return;
  }

  const dmg = Math.max(0, Math.min(1, opts?.damagePercent ?? 0));
  const split = normalizeBleedSplit(opts?.split);

  if (dmg > 0) {
    s.bleed = Math.max(s.bleed, Math.min(1, dmg * split.external));
    s.internalBleed = Math.max(
      s.internalBleed,
      Math.min(1, dmg * split.internal)
    );
    applyBruiseFromHit(s, dmg, split);
  }

  // Fresh ruin without occlusion: open at full external intensity.
  if (health <= 0 && !s.dressed && !s.directPressure) {
    s.bleed = Math.max(s.bleed, COMBAT_TUNING.unclottableRuinedIntensity);
  }
}

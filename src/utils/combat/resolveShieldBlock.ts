import type { BodyPartId, ItemizedHealth } from '../../types/characters';
import { COMBAT_TUNING } from './combatTuning';
import { roundToThousandths } from './penalties';
import {
  highestTrauma,
  setTraumaFlag,
  traumaSeverityPoints,
  type TraumaLevel,
} from './traumaFlags';

/** Flat = inferior (full force into arm); redirect = superior QTE (half overload). */
export type BlockStyle = 'flat' | 'redirect';

export type ShieldOverloadBand =
  | 'none'
  | 'bruise'
  | 'sprain'
  | 'fracture'
  | 'broken';

export interface ResolveShieldBlockInput {
  attackValue: number;
  blockValue: number;
  style: BlockStyle;
  itemized: ItemizedHealth;
  /** When true, mutate itemized (bruise + trauma). */
  apply?: boolean;
}

export interface ResolveShieldBlockResult {
  style: BlockStyle;
  armPart: BodyPartId;
  capacity: number;
  /** Raw comparative excess before style mult: max(0, atk/capacity − 1). */
  excessRatioRaw: number;
  /** Excess after redirectOverloadMult (0 when flat-capacity or below). */
  excessRatioEffective: number;
  band: ShieldOverloadBand;
  /** Trauma requested by band before absolute atk floors. */
  traumaDesired: TraumaLevel;
  /** Trauma actually applied (may be none if under abs floor / already worse). */
  traumaApplied: TraumaLevel;
  bruiseBefore: number;
  bruiseAfter: number;
  bruiseGained: boolean;
  /** True when effective excess is 0 — no arm overload. */
  withinCapacity: boolean;
  overloaded: boolean;
}

function bandFromExcess(excessEff: number): ShieldOverloadBand {
  const T = COMBAT_TUNING.shieldBlock;
  if (excessEff <= 0) return 'none';
  if (excessEff <= T.bruiseMax) return 'bruise';
  if (excessEff <= T.sprainMax) return 'sprain';
  if (excessEff <= T.fractureMax) return 'fracture';
  return 'broken';
}

function traumaForBand(band: ShieldOverloadBand): TraumaLevel {
  if (band === 'sprain') return 'sprain';
  if (band === 'fracture') return 'fracture';
  if (band === 'broken') return 'broken';
  return 'none';
}

/** Gate trauma flags by absolute attackValue (weak vs weak cannot break bone). */
function traumaAfterAbsFloor(
  desired: TraumaLevel,
  attackValue: number
): TraumaLevel {
  const T = COMBAT_TUNING.shieldBlock;
  const atk = Math.max(0, attackValue);
  if (desired === 'broken' && atk < T.brokenMinAtk) {
    if (atk >= T.fractureMinAtk) return 'fracture';
    if (atk >= T.sprainMinAtk) return 'sprain';
    return 'none';
  }
  if (desired === 'fracture' && atk < T.fractureMinAtk) {
    if (atk >= T.sprainMinAtk) return 'sprain';
    return 'none';
  }
  if (desired === 'sprain' && atk < T.sprainMinAtk) return 'none';
  return desired;
}

/**
 * Successful shield block: aimed part is fully covered.
 * Overload (atk above capacity) bruises / traumatizes the shield arm.
 */
export function resolveShieldBlock(
  input: ResolveShieldBlockInput
): ResolveShieldBlockResult {
  const T = COMBAT_TUNING.shieldBlock;
  const armPart = T.shieldArmPart as BodyPartId;
  const capacity = Math.max(0.001, input.blockValue);
  const atk = Math.max(0, input.attackValue);
  const excessRatioRaw = Math.max(0, atk / capacity - 1);
  const styleMult = input.style === 'redirect' ? T.redirectOverloadMult : 1;
  const excessRatioEffective = roundToThousandths(excessRatioRaw * styleMult);
  const band = bandFromExcess(excessRatioEffective);
  const traumaDesired = traumaForBand(band);
  const traumaGated = traumaAfterAbsFloor(traumaDesired, atk);

  const arm = input.itemized[armPart];
  const bruiseBefore = Math.max(0, Math.min(1, arm?.bruise ?? 0));
  let bruiseAfter = bruiseBefore;
  let traumaApplied: TraumaLevel = 'none';

  if (excessRatioEffective > 0 && arm) {
    const deposit = Math.max(
      T.bruiseFromOverloadFloor,
      excessRatioEffective * T.bruiseFromOverloadScale
    );
    bruiseAfter = roundToThousandths(Math.min(1, Math.max(bruiseBefore, deposit)));
  }

  const current = highestTrauma(arm);
  if (
    traumaGated !== 'none' &&
    traumaSeverityPoints(traumaGated) > traumaSeverityPoints(current)
  ) {
    traumaApplied = traumaGated;
  }

  if (input.apply && arm) {
    if (bruiseAfter > bruiseBefore + 1e-4) {
      arm.bruise = bruiseAfter;
    }
    if (traumaApplied !== 'none') {
      setTraumaFlag(input.itemized, armPart, traumaApplied);
    }
  }

  return {
    style: input.style,
    armPart,
    capacity: roundToThousandths(capacity),
    excessRatioRaw: roundToThousandths(excessRatioRaw),
    excessRatioEffective,
    band,
    traumaDesired,
    traumaApplied,
    bruiseBefore: roundToThousandths(bruiseBefore),
    bruiseAfter,
    bruiseGained: bruiseAfter > bruiseBefore + 1e-4,
    withinCapacity: excessRatioEffective <= 0,
    overloaded: excessRatioEffective > 0,
  };
}

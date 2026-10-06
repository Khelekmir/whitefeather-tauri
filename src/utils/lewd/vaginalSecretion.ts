/**
 * Arousal-gated vaginal secretion → orificeSlick.vagina (fluid truth).
 * Cloth weep is a share of produced volume — readiness/cloth are consequences.
 */

import type { Unit as DetailedUnit } from '../../types/characters';
import {
  bodilyStateFromHormones,
  type CycleBodilyState,
} from './cycleBodilyState';
import { LEWD_TUNING as T } from './lewdTuning';
import { addOrificeSlickLayer, type OrificeSlickById } from './orificeSlick';
import { hormonesForUnit } from './ovulationCycle';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Smoothstep gate 0–1 between lo and hi. */
function arousalGate01(arousal: number, lo: number, hi: number): number {
  if (arousal <= lo) return 0;
  if (arousal >= hi) return 1;
  const t = (arousal - lo) / Math.max(0.01, hi - lo);
  return t * t * (3 - 2 * t);
}

export interface VaginalSecretionInput {
  unit: DetailedUnit;
  /** Encounter arousal 0–100. */
  encounterArousal: number;
  holdSeconds: number;
  genitalPlay: boolean;
  /** Optional precomputed bodily state. */
  bodily?: CycleBodilyState | null;
  /** Soft quality 0–1 (beat psych/physio). */
  beatQuality01?: number;
}

export interface VaginalSecretionResult {
  unit: DetailedUnit;
  /** Total fluid produced this tick (truth). */
  produced01: number;
  /** Retained in orificeSlick.vagina. */
  orifice01: number;
  /** Weep toward cloth. */
  cloth01: number;
  ratePerSec: number;
  lubricationRate01: number;
  gate01: number;
}

function setVaginaSlick(
  unit: DetailedUnit,
  slick: OrificeSlickById
): DetailedUnit {
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        orificeSlick: slick,
      },
    },
  };
}

/**
 * Produce vaginal secretion from arousal × cycle rate × contact; split orifice/cloth.
 */
export function accrueVaginalSecretion(
  input: VaginalSecretionInput
): VaginalSecretionResult {
  const S = T.cycle.vaginalSecretion;
  const empty: VaginalSecretionResult = {
    unit: input.unit,
    produced01: 0,
    orifice01: 0,
    cloth01: 0,
    ratePerSec: 0,
    lubricationRate01: 0,
    gate01: 0,
  };
  if (input.unit.sex !== 'F') return empty;

  const bodily =
    input.bodily ??
    (() => {
      const h = hormonesForUnit(input.unit);
      if (!h) return null;
      return bodilyStateFromHormones(
        h,
        input.unit.lewdStats.static.ovulationCycleLength || 28
      );
    })();
  if (!bodily) return empty;

  const hold = Math.max(0.5, input.holdSeconds);
  const gate01 = arousalGate01(
    input.encounterArousal,
    S.secreteArousalBelow,
    S.secreteArousalFull
  );
  const contactMult = input.genitalPlay
    ? S.genitalSecreteMult
    : S.nonGenitalSecreteMult;
  const q = clamp01(input.beatQuality01 ?? 0.7);
  const qualityMult = 0.85 + 0.3 * q;
  const ratePerSec =
    S.baseSecretePerSec *
    bodily.lubricationRate01 *
    gate01 *
    contactMult *
    qualityMult;
  const produced01 = ratePerSec * hold;
  if (produced01 < 0.0005) {
    return {
      ...empty,
      lubricationRate01: bodily.lubricationRate01,
      gate01,
      ratePerSec,
    };
  }

  const orifice01 = produced01 * S.orificeRetainShare;
  const cloth01 = produced01 * (1 - S.orificeRetainShare);
  const prev = input.unit.lewdStats.dynamic.orificeSlick ?? {};
  const vagina = addOrificeSlickLayer(prev.vagina, 'vaginalSecretion', orifice01);
  const unit = setVaginaSlick(input.unit, { ...prev, vagina });

  return {
    unit,
    produced01,
    orifice01,
    cloth01,
    ratePerSec,
    lubricationRate01: bodily.lubricationRate01,
    gate01,
  };
}

/**
 * Idle lust trickle into orifice (and optional cloth weep) over hours.
 */
export function accrueLustSecretionTrickle(
  unit: DetailedUnit,
  hours: number,
  bodily?: CycleBodilyState | null
): { unit: DetailedUnit; produced01: number; cloth01: number } {
  const S = T.cycle.vaginalSecretion;
  if (unit.sex !== 'F' || !(hours > 0)) {
    return { unit, produced01: 0, cloth01: 0 };
  }
  const lust = unit.lewdStats.dynamic.lust ?? 0;
  if (lust < S.lustTrickleBelow) {
    return { unit, produced01: 0, cloth01: 0 };
  }
  const body =
    bodily ??
    (() => {
      const h = hormonesForUnit(unit);
      if (!h) return null;
      return bodilyStateFromHormones(
        h,
        unit.lewdStats.static.ovulationCycleLength || 28
      );
    })();
  if (!body) return { unit, produced01: 0, cloth01: 0 };

  const lust01 = clamp01(lust / 100);
  const produced01 =
    S.lustTricklePerHourAtCap * lust01 * body.lubricationRate01 * hours;
  if (produced01 < 0.002) return { unit, produced01: 0, cloth01: 0 };

  const orifice01 = produced01 * S.orificeRetainShare;
  const cloth01 = produced01 * (1 - S.orificeRetainShare);
  const prev = unit.lewdStats.dynamic.orificeSlick ?? {};
  const vagina = addOrificeSlickLayer(prev.vagina, 'vaginalSecretion', orifice01);
  return {
    unit: setVaginaSlick(unit, { ...prev, vagina }),
    produced01,
    cloth01,
  };
}

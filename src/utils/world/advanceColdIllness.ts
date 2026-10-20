/**
 * Cold exposure debt + respiratory illness advance.
 * Owns truth on lewdStats.dynamic; social/combat only read / receive soft taxes.
 */

import { BODY_TEMP_TUNING } from '../../data/world/bodyTempTuning';
import {
  COLD_ILLNESS_TUNING as T,
  formatRespiratoryIllnessLabel,
} from '../../data/world/coldIllnessTuning';
import type {
  RespiratoryIllnessStage,
  Unit as DetailedUnit,
} from '../../types/characters';
import { readBodyTemp } from './advanceBodyTemperature';

export interface ColdIllnessSnapshot {
  coldExposureDebt01: number;
  respiratoryIllness: RespiratoryIllnessStage;
  respiratoryIllnessHours: number;
}

export interface AdvanceColdIllnessOpts {
  sleeping?: boolean;
  sheltered?: boolean;
  /** Post-evap felt ambient °F from body-temp advance. */
  feltAmbientF: number;
  /** Coverage-weighted worn env wet 0–1. */
  wornEnvWet01: number;
  /** Lab care action already applied this tick (skip double care). */
  skipCare?: boolean;
}

export interface AdvanceColdIllnessResult {
  unit: DetailedUnit;
  from: ColdIllnessSnapshot;
  to: ColdIllnessSnapshot;
  /** Energy/stress deltas applied this tick (for log). */
  socialTax: { energy: number; stress: number };
  summary: string;
  onset: boolean;
  stageChanged: boolean;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function readColdIllness(unit: DetailedUnit): ColdIllnessSnapshot {
  const d = unit.lewdStats.dynamic;
  const stage = d.respiratoryIllness;
  return {
    coldExposureDebt01:
      typeof d.coldExposureDebt01 === 'number'
        ? clamp01(d.coldExposureDebt01)
        : 0,
    respiratoryIllness:
      stage === 'cold' || stage === 'lingering' || stage === 'pneumonia'
        ? stage
        : 'none',
    respiratoryIllnessHours:
      typeof d.respiratoryIllnessHours === 'number'
        ? Math.max(0, d.respiratoryIllnessHours)
        : 0,
  };
}

function conResistMult(unit: DetailedUnit): {
  accrue: number;
  decay: number;
} {
  const con = clamp(
    unit.combatStats.base.constitution ?? T.debt.refConstitution,
    1,
    20
  );
  const ratio = con / T.debt.refConstitution;
  return {
    accrue: clamp(1.25 - 0.25 * ratio, 0.65, 1.35),
    decay: clamp(0.75 + 0.25 * ratio, 0.7, 1.35),
  };
}

function coreBandEnergyTax(coreTempF: number): number {
  const b = BODY_TEMP_TUNING.bands;
  if (coreTempF <= b.hypothermic) return T.hypothermiaEnergyPerHour.hypothermic;
  if (coreTempF <= b.cold) return T.hypothermiaEnergyPerHour.cold;
  if (coreTempF <= b.cool) return T.hypothermiaEnergyPerHour.cool;
  return 0;
}

function stillColdStressed(
  debt: number,
  coreTempF: number,
  feltAmbientF: number,
  wornEnvWet01: number
): boolean {
  if (debt >= T.stages.escalateDebtFloor) return true;
  if (coreTempF <= T.stages.escalateCoreF) return true;
  if (
    wornEnvWet01 >= T.debt.wetFloor &&
    feltAmbientF < T.debt.feltColdStartF
  ) {
    return true;
  }
  return false;
}

function warmDryResting(opts: {
  sheltered?: boolean;
  sleeping?: boolean;
  wornEnvWet01: number;
  feltAmbientF: number;
}): boolean {
  const dry = opts.wornEnvWet01 < T.debt.wetFloor;
  const warm =
    opts.feltAmbientF >= T.debt.feltColdStartF || !!opts.sheltered;
  return dry && warm;
}

function writeColdIllness(
  unit: DetailedUnit,
  snap: ColdIllnessSnapshot
): DetailedUnit {
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: {
        ...unit.lewdStats.dynamic,
        coldExposureDebt01: snap.coldExposureDebt01,
        respiratoryIllness: snap.respiratoryIllness,
        respiratoryIllnessHours: round1(snap.respiratoryIllnessHours),
      },
    },
  };
}

function nudgeSocial(
  unit: DetailedUnit,
  energyDelta: number,
  stressDelta: number
): DetailedUnit {
  if (energyDelta === 0 && stressDelta === 0) return unit;
  const dyn = unit.socialStats.dynamic;
  const energy = clamp((dyn.energy ?? 70) + energyDelta, 0, 100);
  const stress = clamp((dyn.stress ?? 30) + stressDelta, 0, 100);
  return {
    ...unit,
    socialStats: {
      ...unit.socialStats,
      dynamic: { ...dyn, energy, stress },
    },
  };
}

/** Read-only combat soft multipliers from respiratory illness. */
export function illnessCombatMult(unit: DetailedUnit): {
  stamina: number;
  speed: number;
  skill: number;
  stage: RespiratoryIllnessStage;
} {
  const stage = readColdIllness(unit).respiratoryIllness;
  const m = T.combatMult[stage];
  return { ...m, stage };
}

/** Optional sister stub: mood could later soft-cap combat the same way. */
export function moodCombatMult(_unit: DetailedUnit): {
  stamina: number;
  speed: number;
  skill: number;
} {
  return { stamina: 1, speed: 1, skill: 1 };
}

/**
 * Lab / camp: rest by the fire, change into dry clothes, warm care.
 * Cuts debt and credits recovery hours toward stage improvement.
 */
export function applyWarmCare(
  unit: DetailedUnit,
  opts?: { debtRelief?: number; recoveryHoursCredit?: number }
): {
  unit: DetailedUnit;
  from: ColdIllnessSnapshot;
  to: ColdIllnessSnapshot;
  summary: string;
} {
  const from = readColdIllness(unit);
  let debt = from.coldExposureDebt01;
  let stage = from.respiratoryIllness;
  let hoursInStage = from.respiratoryIllnessHours;

  debt = clamp01(debt - (opts?.debtRelief ?? T.care.debtRelief));
  const credit = opts?.recoveryHoursCredit ?? T.care.recoveryHoursCredit;

  if (stage !== 'none') {
    hoursInStage += credit;
    const recovered = tryRecoverStage(stage, hoursInStage, true);
    stage = recovered.stage;
    hoursInStage = recovered.hoursInStage;
  }

  const to: ColdIllnessSnapshot = {
    coldExposureDebt01: round3(debt),
    respiratoryIllness: stage,
    respiratoryIllnessHours: round1(hoursInStage),
  };
  let next = writeColdIllness(unit, to);
  // Care also soft-restores a little energy.
  next = nudgeSocial(next, 4, -2);

  const bits = [
    `warm care · debt ${(from.coldExposureDebt01 * 100).toFixed(0)}→${(to.coldExposureDebt01 * 100).toFixed(0)}%`,
  ];
  if (from.respiratoryIllness !== to.respiratoryIllness) {
    bits.push(
      `${formatRespiratoryIllnessLabel(from.respiratoryIllness)} → ${formatRespiratoryIllnessLabel(to.respiratoryIllness)}`
    );
  } else if (to.respiratoryIllness !== 'none') {
    bits.push(formatRespiratoryIllnessLabel(to.respiratoryIllness));
  }
  return { unit: next, from, to, summary: bits.join(' · ') };
}

function tryRecoverStage(
  stage: RespiratoryIllnessStage,
  hoursInStage: number,
  warmRest: boolean
): { stage: RespiratoryIllnessStage; hoursInStage: number } {
  if (!warmRest || stage === 'none') {
    return { stage, hoursInStage };
  }
  const need =
    stage === 'cold'
      ? T.stages.recoverColdHours
      : stage === 'lingering'
        ? T.stages.recoverLingeringHours
        : T.stages.recoverPneumoniaHours;
  if (hoursInStage < need) return { stage, hoursInStage };

  const next: RespiratoryIllnessStage =
    stage === 'pneumonia'
      ? 'lingering'
      : stage === 'lingering'
        ? 'cold'
        : 'none';
  return { stage: next, hoursInStage: 0 };
}

function tryEscalateStage(
  stage: RespiratoryIllnessStage,
  hoursInStage: number,
  stressed: boolean
): { stage: RespiratoryIllnessStage; hoursInStage: number } {
  if (!stressed) return { stage, hoursInStage };
  if (stage === 'cold' && hoursInStage >= T.stages.coldToLingeringHours) {
    return { stage: 'lingering', hoursInStage: 0 };
  }
  if (
    stage === 'lingering' &&
    hoursInStage >= T.stages.lingeringToPneumoniaHours
  ) {
    return { stage: 'pneumonia', hoursInStage: 0 };
  }
  return { stage, hoursInStage };
}

/**
 * Advance cold-exposure debt and respiratory illness after body temp.
 * Also applies soft energy/stress taxes (illness + hypothermia bands).
 */
export function advanceColdIllness(
  unit: DetailedUnit,
  hours: number,
  opts: AdvanceColdIllnessOpts
): AdvanceColdIllnessResult {
  const from = readColdIllness(unit);
  if (!(hours > 0)) {
    return {
      unit,
      from,
      to: from,
      socialTax: { energy: 0, stress: 0 },
      summary: '',
      onset: false,
      stageChanged: false,
    };
  }

  const core = readBodyTemp(unit).coreTempF;
  const resist = conResistMult(unit);
  const wet = clamp01(opts.wornEnvWet01);
  const felt = opts.feltAmbientF;

  let debt = from.coldExposureDebt01;
  let stage = from.respiratoryIllness;
  let hoursInStage = from.respiratoryIllnessHours;

  const wetTerm = Math.max(0, wet - T.debt.wetFloor) / (1 - T.debt.wetFloor);
  const feltCold = Math.max(0, T.debt.feltColdStartF - felt) / 20;
  const coreCool = Math.max(0, T.debt.coreCoolStartF - core) / 4;
  const accruing =
    wetTerm > 0 && (feltCold > 0 || coreCool > 0)
      ? wetTerm * clamp01(0.45 + feltCold + coreCool * 0.5)
      : coreCool > 0.35 && wetTerm > 0.05
        ? coreCool * wetTerm
        : 0;

  if (accruing > 0) {
    const coreBonus =
      core <= BODY_TEMP_TUNING.bands.hypothermic
        ? T.debt.coreBonusPerHour
        : 0;
    debt +=
      (T.debt.accruePerHour * accruing + coreBonus) * resist.accrue * hours;
  } else if (warmDryResting(opts)) {
    let decay = T.debt.decayPerHour * resist.decay;
    if (opts.sheltered || opts.sleeping) decay *= T.debt.warmRestDecayMult;
    debt -= decay * hours;
  } else {
    // Mild ambient decay when not actively soaking.
    debt -= T.debt.decayPerHour * 0.35 * resist.decay * hours;
  }
  debt = clamp01(debt);

  let onset = false;
  if (stage === 'none' && debt >= T.onsetDebt && debt >= T.onsetMinDebt) {
    stage = 'cold';
    hoursInStage = 0;
    onset = true;
  } else if (stage !== 'none') {
    hoursInStage += hours;
    const stressed = stillColdStressed(debt, core, felt, wet);
    if (stressed) {
      const esc = tryEscalateStage(stage, hoursInStage, true);
      stage = esc.stage;
      hoursInStage = esc.hoursInStage;
    } else if (warmDryResting(opts)) {
      const rec = tryRecoverStage(stage, hoursInStage, true);
      stage = rec.stage;
      hoursInStage = rec.hoursInStage;
    }
  }

  const to: ColdIllnessSnapshot = {
    coldExposureDebt01: round3(debt),
    respiratoryIllness: stage,
    respiratoryIllnessHours: round1(hoursInStage),
  };

  const illnessTax = T.socialTaxPerHour[stage];
  const hypoEnergy = coreBandEnergyTax(core);
  const socialTax = {
    energy: round1(illnessTax.energy * hours + hypoEnergy * hours),
    stress: round1(illnessTax.stress * hours),
  };

  let next = writeColdIllness(unit, to);
  next = nudgeSocial(next, socialTax.energy, socialTax.stress);

  const stageChanged = from.respiratoryIllness !== to.respiratoryIllness;
  const bits: string[] = [];
  if (onset) {
    bits.push('caught a cold');
  } else if (stageChanged) {
    bits.push(
      `${formatRespiratoryIllnessLabel(from.respiratoryIllness)} → ${formatRespiratoryIllnessLabel(to.respiratoryIllness)}`
    );
  } else if (to.respiratoryIllness !== 'none') {
    bits.push(formatRespiratoryIllnessLabel(to.respiratoryIllness));
  }
  if (Math.abs(to.coldExposureDebt01 - from.coldExposureDebt01) >= 0.04) {
    bits.push(
      `cold-debt ${(from.coldExposureDebt01 * 100).toFixed(0)}→${(to.coldExposureDebt01 * 100).toFixed(0)}%`
    );
  }
  if (socialTax.energy <= -0.5 || socialTax.stress >= 0.5) {
    bits.push(
      `energy ${socialTax.energy >= 0 ? '+' : ''}${socialTax.energy.toFixed(1)} / stress ${socialTax.stress >= 0 ? '+' : ''}${socialTax.stress.toFixed(1)}`
    );
  }
  if (hypoEnergy <= -1) {
    bits.push('hypothermia drain');
  }

  return {
    unit: next,
    from,
    to,
    socialTax,
    summary: bits.join(' · '),
    onset,
    stageChanged,
  };
}

export function describeColdIllness(unit: DetailedUnit): string {
  const snap = readColdIllness(unit);
  if (snap.respiratoryIllness === 'none') {
    if (snap.coldExposureDebt01 >= 0.35) {
      return `chilled · debt ${(snap.coldExposureDebt01 * 100).toFixed(0)}%`;
    }
    return 'well';
  }
  return `${formatRespiratoryIllnessLabel(snap.respiratoryIllness)} · debt ${(snap.coldExposureDebt01 * 100).toFixed(0)}% · ${snap.respiratoryIllnessHours.toFixed(0)}h in stage`;
}

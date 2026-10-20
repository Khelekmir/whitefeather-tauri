/**
 * Overworld (Pass-Time) female discharge streams.
 * Leukorrhea + sleep/recumbency pool + menstrual day-curve.
 * Encounter arousal is never a writer here — see cycleBodilyState persistence
 * contract and memory topic whitefeather-overworld-wetness.md.
 *
 * Sweat deferred (whole-body social beats later).
 */

import type { Unit as DetailedUnit } from '../../types/characters';
import {
  bodilyStateFromHormones,
  type MucusKind,
} from './cycleBodilyState';
import {
  applySoilToEquippedCloth,
  applyWetSoil,
  bagIntensity,
  EMPTY_SOIL_CHANNEL,
  getEquippedItem,
} from './fluidSoil';
import { LEWD_TUNING as T } from './lewdTuning';
import { hormonesForUnit, phaseBoundsHours } from './ovulationCycle';
import { addOrificeSlickLayer } from './orificeSlick';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function traitMult(v: number | undefined): number {
  if (v == null || !(v > 0)) return 1;
  return v;
}

function setPeriodCloth(
  unit: DetailedUnit,
  periodCloth: NonNullable<DetailedUnit['lewdStats']['dynamic']['periodCloth']>
): DetailedUnit {
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: { ...unit.lewdStats.dynamic, periodCloth },
    },
  };
}

function setVaginaSlick(
  unit: DetailedUnit,
  orificeSlick: DetailedUnit['lewdStats']['dynamic']['orificeSlick']
): DetailedUnit {
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: { ...unit.lewdStats.dynamic, orificeSlick },
    },
  };
}

/** Equip a stub period cloth for Lab / Pass-Time tests (catalog later). */
export function equipStubPeriodCloth(
  unit: DetailedUnit,
  opts?: { capacity01?: number; label?: string; templateId?: string }
): DetailedUnit {
  if (unit.sex !== 'F') return unit;
  const O = T.cycle.overworldDischarge;
  const capacity01 = Math.max(
    1,
    opts?.capacity01 ?? O.periodClothDefaultCapacity
  );
  return setPeriodCloth(unit, {
    capacity01,
    absorbed01: 0,
    soiled: {
      blood: { ...EMPTY_SOIL_CHANNEL },
      vaginalDischarge: { ...EMPTY_SOIL_CHANNEL },
    },
    templateId: opts?.templateId,
    label: opts?.label ?? 'period cloth',
  });
}

/** Remove period cloth (discard / laundry later). Does not auto-soil underwear. */
export function unequipPeriodCloth(unit: DetailedUnit): DetailedUnit {
  if (!unit.lewdStats.dynamic.periodCloth) return unit;
  const { periodCloth: _removed, ...rest } = unit.lewdStats.dynamic;
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      dynamic: rest,
    },
  };
}

export interface PeriodClothBleedThroughReport {
  equipped: boolean;
  capacity01: number;
  absorbed01: number;
  fill01: number;
  /** Fluid that would pass to underwear this apply (diagnostic). */
  lastBleedThrough01: number;
  /** Underwear blood intensity already present. */
  underwearBlood01: number;
  /** True when underwear blood looks like a visible stain. */
  visibleBleedThrough: boolean;
}

export function periodClothBleedThroughReport(
  unit: DetailedUnit,
  lastBleedThrough01 = 0
): PeriodClothBleedThroughReport {
  const O = T.cycle.overworldDischarge;
  const cloth = unit.lewdStats.dynamic.periodCloth;
  const underwear = getEquippedItem(unit, 'underwear');
  const underwearBlood01 = underwear
    ? bagIntensity(underwear.lewdStats?.soiled, 'blood')
    : bagIntensity(unit.lewdStats.dynamic.crotchSoil, 'blood');
  if (!cloth) {
    return {
      equipped: false,
      capacity01: 0,
      absorbed01: 0,
      fill01: 0,
      lastBleedThrough01,
      underwearBlood01,
      visibleBleedThrough: underwearBlood01 >= O.bleedThroughVisibleAt,
    };
  }
  const absorbed01 = Math.max(
    cloth.absorbed01,
    bagIntensity(cloth.soiled, 'blood') +
      bagIntensity(cloth.soiled, 'vaginalDischarge') * 0.5
  );
  return {
    equipped: true,
    capacity01: cloth.capacity01,
    absorbed01,
    fill01: cloth.capacity01 > 0 ? clamp01(absorbed01 / cloth.capacity01) : 1,
    lastBleedThrough01,
    underwearBlood01,
    visibleBleedThrough: underwearBlood01 >= O.bleedThroughVisibleAt,
  };
}

/**
 * Route menstrual (or mixed bloody) fluid: period cloth first, excess → underwear.
 * `amount01` is volume01 (applyWetSoil maps ×100 → soil points).
 * `periodCloth.capacity01` / `absorbed01` are soil-point units (same family as wet scores).
 * Catalog inserts will set capacity via template; stub uses overworldDischarge defaults.
 */
export function applyMenstrualFluid(
  unit: DetailedUnit,
  amount01: number
): { unit: DetailedUnit; absorbed01: number; bleedThrough01: number } {
  if (!(amount01 > 1e-6) || unit.sex !== 'F') {
    return { unit, absorbed01: 0, bleedThrough01: 0 };
  }
  const cloth = unit.lewdStats.dynamic.periodCloth;
  if (!cloth || !(cloth.capacity01 > 0)) {
    const soiled = applySoilToEquippedCloth(unit, 'blood', amount01);
    return { unit: soiled.unit, absorbed01: 0, bleedThrough01: amount01 };
  }

  const currentAbsorbed = Math.max(
    cloth.absorbed01,
    bagIntensity(cloth.soiled, 'blood') +
      bagIntensity(cloth.soiled, 'vaginalDischarge') * 0.5
  );
  const incomingSoil = amount01 * 100;
  const room = Math.max(0, cloth.capacity01 - currentAbsorbed);
  const absorbedSoil = Math.min(incomingSoil, room);
  const bleedThrough01 = Math.max(0, incomingSoil - absorbedSoil) / 100;
  const absorbedVolume01 = absorbedSoil / 100;

  let next = unit;
  if (absorbedVolume01 > 1e-6) {
    const soiled = applyWetSoil(
      cloth.soiled ?? { blood: { ...EMPTY_SOIL_CHANNEL } },
      'blood',
      absorbedVolume01
    );
    next = setPeriodCloth(next, {
      ...cloth,
      absorbed01: currentAbsorbed + absorbedSoil,
      soiled,
    });
  }
  if (bleedThrough01 > 1e-6) {
    next = applySoilToEquippedCloth(next, 'blood', bleedThrough01).unit;
  }
  return {
    unit: next,
    absorbed01: absorbedSoil,
    bleedThrough01,
  };
}

export function leukorrheaMucusMult(kind: MucusKind): number {
  const table = T.cycle.overworldDischarge.leukorrheaByMucus;
  return table[kind] ?? 0.5;
}

export function leukorrheaRatePerHour(unit: DetailedUnit): number {
  if (unit.sex !== 'F') return 0;
  const h = hormonesForUnit(unit);
  if (!h) return 0;
  const length = unit.lewdStats.static.ovulationCycleLength || 28;
  const body = bodilyStateFromHormones(h, length);
  const O = T.cycle.overworldDischarge;
  const traits = unit.lewdStats.static.cycleFluidTraits;
  return (
    O.leukorrheaBasePerHour *
    leukorrheaMucusMult(body.mucusKind) *
    traitMult(traits?.leukorrheaMult)
  );
}

/** Day index within the bleed window (0 = first menstrual day). */
export function menstrualBleedDayIndex(
  cycleDay: number,
  lengthDays: number
): number {
  const b = phaseBoundsHours(lengthDays);
  const menstrualDays = Math.max(1, b.menstrualEnd / 24);
  return Math.max(0, Math.min(Math.floor(cycleDay), Math.ceil(menstrualDays)));
}

export function menstrualDayCurveMult(bleedDayIndex: number): number {
  const curve = T.cycle.overworldDischarge.menstrualDayCurve;
  if (!curve.length) return 1;
  const i = Math.max(0, Math.floor(bleedDayIndex));
  return curve[Math.min(i, curve.length - 1)] ?? 0.1;
}

export function menstrualBleedRatePerHour(unit: DetailedUnit): number {
  if (unit.sex !== 'F') return 0;
  const h = hormonesForUnit(unit);
  if (!h) return 0;
  const length = unit.lewdStats.static.ovulationCycleLength || 28;
  const body = bodilyStateFromHormones(h, length);
  if (body.mucusKind !== 'bloody' && h.phase !== 'Menstrual') return 0;
  const O = T.cycle.overworldDischarge;
  const traits = unit.lewdStats.static.cycleFluidTraits;
  const dayIdx = menstrualBleedDayIndex(h.day, length);
  return (
    O.menstrualPeakPerHour *
    menstrualDayCurveMult(dayIdx) *
    traitMult(traits?.menstrualFlowMult)
  );
}

export interface AccrueLeukorrheaOpts {
  /** Overnight / intentional sleep block. */
  sleeping?: boolean;
  /** Lying / side-lying encounter posture — also pools. */
  recumbent?: boolean;
}

export interface AccrueLeukorrheaResult {
  unit: DetailedUnit;
  produced01: number;
  orifice01: number;
  cloth01: number;
  poolMult: number;
}

/**
 * Baseline physiologic leukorrhea → light orifice film + cloth vaginalDischarge.
 * Sleep/recumbent multiplies cloth share (pooling), not production glands.
 */
export function accrueLeukorrhea(
  unit: DetailedUnit,
  hours: number,
  opts?: AccrueLeukorrheaOpts
): AccrueLeukorrheaResult {
  if (unit.sex !== 'F' || !(hours > 0)) {
    return { unit, produced01: 0, orifice01: 0, cloth01: 0, poolMult: 1 };
  }
  const rate = leukorrheaRatePerHour(unit);
  const produced01 = rate * hours;
  if (produced01 < 0.0015) {
    return { unit, produced01: 0, orifice01: 0, cloth01: 0, poolMult: 1 };
  }

  const O = T.cycle.overworldDischarge;
  const traits = unit.lewdStats.static.cycleFluidTraits;
  const poolMult =
    opts?.sleeping || opts?.recumbent
      ? O.sleepPoolMult * traitMult(traits?.sleepPoolMult)
      : 1;

  const orificeShare = O.leukorrheaOrificeRetainShare;
  const orifice01 = produced01 * orificeShare;
  const cloth01 = produced01 * (1 - orificeShare) * poolMult;

  let next = unit;
  if (orifice01 > 1e-6) {
    const prev = next.lewdStats.dynamic.orificeSlick ?? {};
    const vagina = addOrificeSlickLayer(
      prev.vagina,
      'vaginalSecretion',
      orifice01
    );
    next = setVaginaSlick(next, { ...prev, vagina });
  }
  if (cloth01 > 1e-6) {
    next = applySoilToEquippedCloth(next, 'vaginalDischarge', cloth01).unit;
  }
  return { unit: next, produced01, orifice01, cloth01, poolMult };
}

export interface AccrueMenstrualResult {
  unit: DetailedUnit;
  produced01: number;
  absorbed01: number;
  bleedThrough01: number;
  ratePerHour: number;
}

/**
 * Menstrual fluid with day-curve × menstrualFlowMult.
 * Routes through period cloth when equipped; excess bleedthrough → underwear.
 */
export function accrueMenstrualBloodCurved(
  unit: DetailedUnit,
  hours: number
): AccrueMenstrualResult {
  if (unit.sex !== 'F' || !(hours > 0)) {
    return {
      unit,
      produced01: 0,
      absorbed01: 0,
      bleedThrough01: 0,
      ratePerHour: 0,
    };
  }
  const ratePerHour = menstrualBleedRatePerHour(unit);
  const produced01 = ratePerHour * hours;
  if (produced01 < 0.001) {
    return {
      unit,
      produced01: 0,
      absorbed01: 0,
      bleedThrough01: 0,
      ratePerHour,
    };
  }
  const applied = applyMenstrualFluid(unit, produced01);
  return {
    unit: applied.unit,
    produced01,
    absorbed01: applied.absorbed01,
    bleedThrough01: applied.bleedThrough01,
    ratePerHour,
  };
}

/** True when posture pools discharge at the introitus / seat. */
export function postureIsRecumbent(
  posture: string | undefined
): boolean {
  return (
    posture === 'lying' ||
    posture === 'sideLying' ||
    posture === 'seated'
  );
}

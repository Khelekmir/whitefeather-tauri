import type {
  AlcoholDrink,
  AlcoholKind,
  DrinkPace,
  DrinkSipAction,
  HeldDrink,
} from '../../data/social/sampleDrinks';
import type {
  Sex,
  SocialDynamic,
  Unit as DetailedUnit,
} from '../../types/characters';
import { BAC_TUNING, type IntoxicationStageId } from './bacTuning';
import { roundToThousandths } from '../combat/penalties';

const T = BAC_TUNING;

/**
 * BAC % precision. NEVER use roundToThousandths on BAC — 1 minute of
 * metabolism is ~0.00025 and was getting wiped to 0 every short tick.
 */
function roundBac(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

function ensureDynamic(d: SocialDynamic): SocialDynamic {
  return {
    ...d,
    unabsorbedEthanolG: d.unabsorbedEthanolG ?? 0,
  };
}

/** Grams of pure ethanol in a volume of a given ABV drink. */
export function ethanolGramsInVolume(
  volumeMl: number,
  abvPercent: number
): number {
  return Math.max(0, volumeMl) * (abvPercent / 100) * T.ethanolDensity;
}

/** Grams of pure ethanol in a full drink serving. */
export function ethanolGrams(drink: Pick<AlcoholDrink, 'volumeMl' | 'abvPercent'>): number {
  return ethanolGramsInVolume(drink.volumeMl, drink.abvPercent);
}

export function widmarkR(sex: Sex): number {
  return sex === 'F' ? T.rFemale : T.rMale;
}

/** Convert ethanol grams already in blood-distribution to %BAC. */
export function bacDeltaFromEthanolGrams(
  unit: Pick<DetailedUnit, 'sex' | 'weight'>,
  ethanolG: number
): number {
  const weightG = Math.max(1, unit.weight) * T.lbsToGrams;
  const r = widmarkR(unit.sex);
  return (Math.max(0, ethanolG) / (weightG * r)) * 100;
}

export function intoxicationStageFromBac(bac: number): IntoxicationStageId {
  let stage: IntoxicationStageId = 'Sober';
  for (const row of T.stages) {
    if (bac + 1e-9 >= row.minBac) stage = row.id;
  }
  return stage;
}

/**
 * %BAC if `volumeMl` of this ABV were fully in the blood (reference helper).
 */
export function bacDeltaFromVolume(
  unit: Pick<DetailedUnit, 'sex' | 'weight'>,
  drink: Pick<AlcoholDrink, 'abvPercent'>,
  volumeMl: number,
  absorbFraction = T.absorbFraction
): number {
  const A =
    ethanolGramsInVolume(volumeMl, drink.abvPercent) *
    Math.max(0, Math.min(1, absorbFraction));
  return bacDeltaFromEthanolGrams(unit, A);
}

export function bacDeltaFromDrink(
  unit: Pick<DetailedUnit, 'sex' | 'weight'>,
  drink: Pick<AlcoholDrink, 'volumeMl' | 'abvPercent'>,
  absorbFraction = T.absorbFraction
): number {
  return bacDeltaFromVolume(unit, drink, drink.volumeMl, absorbFraction);
}

function toleranceForKind(
  tolerance: Record<string, number> | undefined,
  kind: AlcoholKind | undefined
): number {
  if (!kind || !tolerance) return 1;
  const v = tolerance[kind];
  return typeof v === 'number' && v > 0 ? v : 1;
}

export function metabolizeRatePerHour(
  tolerance?: Record<string, number>,
  kind?: AlcoholKind
): number {
  let factor = 1;
  if (kind) {
    const tol = toleranceForKind(tolerance, kind);
    factor = 1 + (tol - 1) * T.toleranceMetabolizeInfluence;
  } else if (tolerance && Object.keys(tolerance).length > 0) {
    const vals = Object.values(tolerance).filter((n) => typeof n === 'number' && n > 0);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1;
    factor = 1 + (avg - 1) * T.toleranceMetabolizeInfluence;
  }
  return T.metabolizePerHour * Math.max(0.5, factor);
}

function refreshStage(dynamic: SocialDynamic): SocialDynamic {
  return {
    ...dynamic,
    intoxicationStage: intoxicationStageFromBac(dynamic.BAC),
  };
}

function raiseBac(prev: SocialDynamic, deltaBac: number): SocialDynamic {
  const BAC = roundBac(Math.max(0, prev.BAC + deltaBac));
  const peakBAC = roundBac(Math.max(prev.peakBAC, BAC));
  return refreshStage({ ...prev, BAC, peakBAC });
}

/** Effective first-order absorption ka (/hour), optionally paced. */
export function absorptionKa(pace?: DrinkPace | null): number {
  const base = T.absorptionKaPerHour;
  if (!pace) return base;
  return base * (T.absorptionKaByPace[pace] ?? 1);
}

/**
 * Move gut ethanol → BAC over `hours` (first-order).
 * Does not metabolize — call metabolizeBac after, or use tickDrinking.
 */
export function absorbFromGut(
  unit: DetailedUnit,
  hours: number,
  pace?: DrinkPace | null
): {
  dynamic: SocialDynamic;
  absorbedG: number;
  deltaBac: number;
} {
  const prev = ensureDynamic(unit.socialStats.dynamic);
  const h = Math.max(0, hours);
  const gut = Math.max(0, prev.unabsorbedEthanolG);
  if (h <= 0 || gut <= 0) {
    return { dynamic: prev, absorbedG: 0, deltaBac: 0 };
  }
  const ka = absorptionKa(pace);
  const fraction = 1 - Math.exp(-ka * h);
  const absorbedG = gut * fraction;
  const deltaBac = bacDeltaFromEthanolGrams(unit, absorbedG);
  const dynamic = raiseBac(
    {
      ...prev,
      unabsorbedEthanolG: roundBac(Math.max(0, gut - absorbedG)),
    },
    deltaBac
  );
  return {
    dynamic,
    absorbedG: roundBac(absorbedG),
    deltaBac: roundBac(deltaBac),
  };
}

/** ml/min drain rate for the held serving at this pace. */
export function paceMlPerMinute(pace: DrinkPace, remainingMl: number): number {
  if (pace === 'slam') {
    return remainingMl / Math.max(0.001, T.slamMinutes);
  }
  return T.paceMlPerMinute[pace];
}

export function minutesToFinish(pace: DrinkPace, remainingMl: number): number {
  if (remainingMl <= 0) return 0;
  if (pace === 'slam') return T.slamMinutes;
  const rate = T.paceMlPerMinute[pace];
  return rate > 0 ? remainingMl / rate : Number.POSITIVE_INFINITY;
}

export function startHeldDrink(
  drink: AlcoholDrink,
  pace: DrinkPace = 'moderate'
): HeldDrink {
  return {
    drink,
    remainingMl: drink.volumeMl,
    pace,
  };
}

export function setHeldPace(held: HeldDrink, pace: DrinkPace): HeldDrink {
  return { ...held, pace };
}

/**
 * Swallow `volumeMl` of a drink: most ethanol → gut pool; a small fraction
 * may bump BAC immediately (mucosa). Does not advance time.
 */
export function applyDrinkPortion(
  unit: DetailedUnit,
  drink: Pick<AlcoholDrink, 'abvPercent' | 'kind' | 'label'>,
  volumeMl: number,
  absorbFraction = T.absorbFraction
): {
  dynamic: SocialDynamic;
  /** Immediate BAC rise (usually small). */
  deltaBac: number;
  ethanolG: number;
  /** Grams added to the gut pool. */
  gutAddedG: number;
  volumeMl: number;
} {
  const ml = Math.max(0, volumeMl);
  const bio = Math.max(0, Math.min(1, absorbFraction));
  const ethanolG = ethanolGramsInVolume(ml, drink.abvPercent) * bio;
  const immediateG = ethanolG * T.immediateAbsorbFraction;
  const gutG = ethanolG - immediateG;

  const prev = ensureDynamic(unit.socialStats.dynamic);
  let dynamic: SocialDynamic = {
    ...prev,
    unabsorbedEthanolG: roundBac(prev.unabsorbedEthanolG + gutG),
    hoursSinceLastDrink: ml > 0 ? 0 : prev.hoursSinceLastDrink,
  };
  const deltaBac = bacDeltaFromEthanolGrams(unit, immediateG);
  if (deltaBac > 0) {
    dynamic = raiseBac(dynamic, deltaBac);
  } else {
    dynamic = refreshStage(dynamic);
  }

  return {
    dynamic,
    deltaBac: roundBac(deltaBac),
    ethanolG: roundToThousandths(ethanolG),
    gutAddedG: roundBac(gutG),
    volumeMl: roundToThousandths(ml),
  };
}

/** Full serving swallowed at once into gut (+ tiny immediate). */
export function applyDrink(
  unit: DetailedUnit,
  drink: AlcoholDrink,
  absorbFraction = T.absorbFraction
): {
  dynamic: SocialDynamic;
  deltaBac: number;
  ethanolG: number;
  gutAddedG: number;
} {
  const r = applyDrinkPortion(unit, drink, drink.volumeMl, absorbFraction);
  return {
    dynamic: r.dynamic,
    deltaBac: r.deltaBac,
    ethanolG: r.ethanolG,
    gutAddedG: r.gutAddedG,
  };
}

/**
 * Discrete gulp / mouthful / sip — swallow volume now (gut + tiny BAC),
 * no world time / no absorption tick / no metabolism.
 */
export function sipFromHeld(
  unit: DetailedUnit,
  held: HeldDrink,
  action: DrinkSipAction
): {
  unit: DetailedUnit;
  held: HeldDrink | null;
  consumedMl: number;
  deltaBac: number;
  ethanolG: number;
  gutAddedG: number;
} {
  const want = T.sipActionMl[action];
  const consumedMl = Math.min(held.remainingMl, want);
  const portion = applyDrinkPortion(unit, held.drink, consumedMl);
  const remainingMl = roundToThousandths(held.remainingMl - consumedMl);
  const nextHeld: HeldDrink | null =
    remainingMl <= 0.05 ? null : { ...held, remainingMl };
  return {
    unit: {
      ...unit,
      socialStats: { ...unit.socialStats, dynamic: portion.dynamic },
    },
    held: nextHeld,
    consumedMl,
    deltaBac: portion.deltaBac,
    ethanolG: portion.ethanolG,
    gutAddedG: portion.gutAddedG,
  };
}

/**
 * Advance time:
 * 1) Optionally swallow more from held drink → gut (+ tiny immediate BAC)
 * 2) Absorb gut → BAC (first-order, pace-scaled ka)
 * 3) Metabolize BAC
 */
export function tickDrinking(
  unit: DetailedUnit,
  held: HeldDrink | null,
  hours: number
): {
  unit: DetailedUnit;
  held: HeldDrink | null;
  consumedMl: number;
  /** Immediate BAC from swallowing this tick (mucosa). */
  deltaBacImmediate: number;
  /** BAC from gut absorption this tick. */
  deltaBacAbsorbed: number;
  ethanolSwallowedG: number;
  gutAddedG: number;
  absorbedG: number;
  metabolized: number;
} {
  const minutes = Math.max(0, hours) * 60;
  let consumedMl = 0;
  let deltaBacImmediate = 0;
  let ethanolSwallowedG = 0;
  let gutAddedG = 0;
  let nextUnit = unit;
  let nextHeld = held;
  const paceForKa: DrinkPace | null = held?.pace ?? null;

  if (held && minutes > 0 && held.remainingMl > 0) {
    const rate = paceMlPerMinute(held.pace, held.remainingMl);
    consumedMl = Math.min(held.remainingMl, rate * minutes);
    const portion = applyDrinkPortion(nextUnit, held.drink, consumedMl);
    deltaBacImmediate = portion.deltaBac;
    ethanolSwallowedG = portion.ethanolG;
    gutAddedG = portion.gutAddedG;
    nextUnit = {
      ...nextUnit,
      socialStats: { ...nextUnit.socialStats, dynamic: portion.dynamic },
    };
    const remainingMl = roundToThousandths(held.remainingMl - consumedMl);
    nextHeld = remainingMl <= 0.05 ? null : { ...held, remainingMl };
  }

  const absorb = absorbFromGut(nextUnit, hours, paceForKa ?? nextHeld?.pace);
  nextUnit = {
    ...nextUnit,
    socialStats: { ...nextUnit.socialStats, dynamic: absorb.dynamic },
  };

  const beforeMeta = nextUnit.socialStats.dynamic.BAC;
  const kindHint = held?.drink.kind ?? nextHeld?.drink.kind;
  const metabolizedDynamic = metabolizeBac(nextUnit, hours, kindHint);
  const metabolized = roundBac(Math.max(0, beforeMeta - metabolizedDynamic.BAC));
  nextUnit = {
    ...nextUnit,
    socialStats: { ...nextUnit.socialStats, dynamic: metabolizedDynamic },
  };

  return {
    unit: nextUnit,
    held: nextHeld,
    consumedMl: roundToThousandths(consumedMl),
    deltaBacImmediate: roundBac(deltaBacImmediate),
    deltaBacAbsorbed: absorb.deltaBac,
    ethanolSwallowedG: roundToThousandths(ethanolSwallowedG),
    gutAddedG: roundBac(gutAddedG),
    absorbedG: absorb.absorbedG,
    metabolized,
  };
}

export function metabolizeBac(
  unit: DetailedUnit,
  hours: number,
  kindHint?: AlcoholKind
): SocialDynamic {
  const prev = ensureDynamic(unit.socialStats.dynamic);
  const ratePerHour = metabolizeRatePerHour(
    unit.socialStats.static.alcoholTolerance,
    kindHint
  );
  const minutes = Math.max(0, hours) * 60;
  const burned = (minutes / 60) * ratePerHour;
  const nextBac = Math.max(0, prev.BAC - burned);
  const hoursSince =
    prev.hoursSinceLastDrink == null
      ? hours
      : prev.hoursSinceLastDrink + hours;
  return refreshStage({
    ...prev,
    BAC: roundBac(nextBac),
    hoursSinceLastDrink: roundBac(hoursSince),
  });
}

export function soberUp(dynamic: SocialDynamic): SocialDynamic {
  return {
    ...ensureDynamic(dynamic),
    BAC: 0,
    peakBAC: 0,
    unabsorbedEthanolG: 0,
    hoursSinceLastDrink: null,
    intoxicationStage: 'Sober',
    alcoholFatigue: 0,
    hangoverSeverity: 0,
  };
}

export function formatBac(bac: number): string {
  return bac.toFixed(4);
}

export function formatMl(ml: number): string {
  return ml >= 10 ? ml.toFixed(0) : ml.toFixed(1);
}

export function formatEthanolG(g: number): string {
  return g >= 1 ? g.toFixed(2) : g.toFixed(3);
}

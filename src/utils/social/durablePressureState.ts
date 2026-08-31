import {
  PERSONALIZED_PRESSURES,
  resolveCharacterPressureProfile,
  type PersonalizedPressureId,
  type TemperamentPressureTable,
} from '../../data/social/durablePressures';
import type { Unit as DetailedUnit } from '../../types/characters';
import { standingLustTarget } from '../lewd/lustDrive';
import { derivePainLoad } from './painLoad';
import { PRESSURE_DRIFT_TUNING as T } from './pressureDriftTuning';
import { bandFrom100, type AffectBand } from './resolveMood';

export interface DurablePressureSnapshot {
  profile: TemperamentPressureTable;
  /** Fixed personality resting points (temperament × mods). */
  anchors: Record<PersonalizedPressureId, number>;
  /** Dynamic idle targets (wander near anchors). */
  baselines: Record<PersonalizedPressureId, number>;
  values: Record<PersonalizedPressureId, number>;
  /** Derived 0–100 from itemized health — no personal rates. */
  painLoad: number;
  bands: Record<PersonalizedPressureId | 'painLoad', AffectBand>;
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function clampBaselineToAnchor(baseline: number, anchor: number): number {
  const lo = Math.max(0, anchor - T.baselineWanderMax);
  const hi = Math.min(100, anchor + T.baselineWanderMax);
  return Math.max(lo, Math.min(hi, baseline));
}

/** Fixed anchor for a pressure (does not change with lived experience). */
export function readPressureAnchor(
  unit: DetailedUnit,
  id: PersonalizedPressureId
): number {
  const profile = resolveCharacterPressureProfile(
    unit.socialStats.static.temperament,
    unit.socialStats.static.pressureMods
  );
  return profile[id].baseline;
}

/**
 * Dynamic baseline (idle target). Falls back to anchor when unset.
 */
export function readPressureBaseline(
  unit: DetailedUnit,
  id: PersonalizedPressureId
): number {
  const stored = unit.socialStats.dynamic.pressureBaselines?.[id];
  const anchor = readPressureAnchor(unit, id);
  if (stored == null || Number.isNaN(stored)) return anchor;
  return clampBaselineToAnchor(stored, anchor);
}

/**
 * Ensure dynamic meters + pressureBaselines exist; seed from anchors when missing.
 */
export function hydrateDurablePressures(unit: DetailedUnit): DetailedUnit {
  const profile = resolveCharacterPressureProfile(
    unit.socialStats.static.temperament,
    unit.socialStats.static.pressureMods
  );
  const d = unit.socialStats.dynamic;
  const next = { ...d };
  const baselines: Partial<Record<PersonalizedPressureId, number>> = {
    ...d.pressureBaselines,
  };

  for (const id of PERSONALIZED_PRESSURES) {
    const anchor = profile[id].baseline;
    if (baselines[id] == null || Number.isNaN(baselines[id]!)) {
      baselines[id] = anchor;
    } else {
      baselines[id] = clampBaselineToAnchor(baselines[id]!, anchor);
    }

    if (id === 'lust') continue;
    const key = id as Exclude<PersonalizedPressureId, 'lust'>;
    if (next[key] == null || Number.isNaN(next[key])) {
      next[key] = baselines[id]!;
    }
  }
  if (d.stress == null) next.stress = baselines.stress ?? profile.stress.baseline;
  next.pressureBaselines = baselines as Record<PersonalizedPressureId, number>;

  const lustCur = unit.lewdStats.dynamic.lust;
  const lustNext =
    lustCur == null || Number.isNaN(lustCur)
      ? (baselines.lust ?? profile.lust.baseline)
      : lustCur;

  return {
    ...unit,
    socialStats: { ...unit.socialStats, dynamic: next },
    lewdStats: {
      ...unit.lewdStats,
      dynamic: { ...unit.lewdStats.dynamic, lust: lustNext },
    },
  };
}

export function readPersonalizedValue(
  unit: DetailedUnit,
  id: PersonalizedPressureId
): number {
  if (id === 'lust') return unit.lewdStats.dynamic.lust ?? 0;
  const v = unit.socialStats.dynamic[id as keyof typeof unit.socialStats.dynamic];
  return typeof v === 'number' ? v : 0;
}

export function snapshotDurablePressures(unit: DetailedUnit): DurablePressureSnapshot {
  const profile = resolveCharacterPressureProfile(
    unit.socialStats.static.temperament,
    unit.socialStats.static.pressureMods
  );
  const values = {} as Record<PersonalizedPressureId, number>;
  const anchors = {} as Record<PersonalizedPressureId, number>;
  const baselines = {} as Record<PersonalizedPressureId, number>;
  const bands = {} as DurablePressureSnapshot['bands'];
  for (const id of PERSONALIZED_PRESSURES) {
    values[id] = readPersonalizedValue(unit, id);
    anchors[id] = profile[id].baseline;
    baselines[id] = readPressureBaseline(unit, id);
    bands[id] = bandFrom100(values[id]);
  }
  const painLoad = derivePainLoad(unit.combatStats.itemizedHealth);
  bands.painLoad = bandFrom100(painLoad);
  return { profile, anchors, baselines, values, painLoad, bands };
}

export interface PressureDriftDelta {
  id: PersonalizedPressureId;
  from: number;
  to: number;
  baselineFrom: number;
  baselineTo: number;
  anchor: number;
  /** Signed meter change (to − from). */
  delta: number;
}

export interface PressureDriftResult {
  unit: DetailedUnit;
  hours: number;
  deltas: PressureDriftDelta[];
}

/**
 * First-order approach of `from` toward `toward`.
 * rate scales λ; side is caller’s responsibility.
 */
function approachToward(
  from: number,
  toward: number,
  rate: number,
  hours: number
): number {
  const gap = from - toward;
  if (Math.abs(gap) <= T.snapEpsilon) return toward;
  const factor = Math.exp(-T.idleLambdaPerHour * Math.max(0.05, rate) * hours);
  let next = toward + gap * factor;
  if (Math.abs(next - toward) <= T.snapEpsilon) next = toward;
  return next;
}

/**
 * Idle drift:
 * 1) meter → dynamic baseline (full growth/decay, side-aware)
 * 2) baseline ← meter (shaved fraction — lived experience walks the target)
 * 3) baseline → anchor (reduced fraction — personality slowly reasserts)
 * Baseline stays within ±baselineWanderMax of the fixed anchor.
 * painLoad is derived and is not drifted.
 */
export function driftDurablePressures(
  unit: DetailedUnit,
  hours: number
): PressureDriftResult {
  if (!(hours > 0)) {
    return { unit, hours: 0, deltas: [] };
  }

  const hydrated = hydrateDurablePressures(unit);
  const profile = resolveCharacterPressureProfile(
    hydrated.socialStats.static.temperament,
    hydrated.socialStats.static.pressureMods
  );

  const nextSocial = { ...hydrated.socialStats.dynamic };
  let nextLust = hydrated.lewdStats.dynamic.lust ?? 0;
  const nextBaselines = {} as Record<PersonalizedPressureId, number>;
  for (const id of PERSONALIZED_PRESSURES) {
    nextBaselines[id] = readPressureBaseline(hydrated, id);
  }
  const deltas: PressureDriftDelta[] = [];

  const writeMeter = (id: PersonalizedPressureId, value: number) => {
    if (id === 'lust') nextLust = value;
    else nextSocial[id] = value;
  };

  for (const id of PERSONALIZED_PRESSURES) {
    // Option A: lust meter is owned by advanceStandingLust (libido × cycle).
    // Temperament only supplies rates/expression there — do not dual-drift lust here.
    // Mirror the standing target into the pressure baseline for lab display only.
    if (id === 'lust') {
      nextBaselines[id] = clamp100(standingLustTarget(hydrated));
      continue;
    }

    const rateProfile = profile[id];
    const anchor = rateProfile.baseline;
    const value0 = readPersonalizedValue(hydrated, id);
    const baseline0 = readPressureBaseline(hydrated, id);

    // 1) Meter → baseline
    const meterRate =
      value0 >= baseline0 ? rateProfile.decay : rateProfile.growth;
    let value1 = approachToward(value0, baseline0, meterRate, hours);
    value1 = clamp100(value1);

    // 2) Baseline ← pre-drift meter (lived offset walks the target slowly)
    const followRate =
      (value0 >= baseline0 ? rateProfile.decay : rateProfile.growth) *
      T.baselineFollowFraction;
    let baseline1 = approachToward(baseline0, value0, followRate, hours);

    // 3) Baseline → anchor (personality reasserts at reduced rate)
    const anchorRate =
      (baseline1 >= anchor ? rateProfile.decay : rateProfile.growth) *
      T.baselineAnchorFraction;
    let baseline2 = approachToward(baseline1, anchor, anchorRate, hours);
    baseline2 = clampBaselineToAnchor(baseline2, anchor);

    writeMeter(id, value1);
    nextBaselines[id] = baseline2;

    const meterMoved = Math.abs(value1 - value0) >= 0.01;
    const baseMoved = Math.abs(baseline2 - baseline0) >= 0.01;
    if (meterMoved || baseMoved) {
      deltas.push({
        id,
        from: value0,
        to: value1,
        baselineFrom: baseline0,
        baselineTo: baseline2,
        anchor,
        delta: value1 - value0,
      });
    }
  }

  nextSocial.pressureBaselines = nextBaselines;

  const nextUnit: DetailedUnit = {
    ...hydrated,
    socialStats: { ...hydrated.socialStats, dynamic: nextSocial },
    lewdStats: {
      ...hydrated.lewdStats,
      dynamic: { ...hydrated.lewdStats.dynamic, lust: nextLust },
    },
  };

  return { unit: nextUnit, hours, deltas };
}

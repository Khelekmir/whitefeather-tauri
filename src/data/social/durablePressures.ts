import type { TemperamentBlendId } from './temperaments';
import { parseTemperament } from './temperaments';

/**
 * Durable pressures that feed mood / social receptivity.
 * `painLoad` is derived from itemized health — no personal baseline/rates.
 */
export const PERSONALIZED_PRESSURES = [
  'stress',
  'energy',
  'belonging',
  'agency',
  'lust',
  'pride',
  'shame',
] as const;

export type PersonalizedPressureId = (typeof PERSONALIZED_PRESSURES)[number];

export const DERIVED_PRESSURES = ['painLoad'] as const;
export type DerivedPressureId = (typeof DERIVED_PRESSURES)[number];

export type DurablePressureId = PersonalizedPressureId | DerivedPressureId;

/** Per-pressure resting point + how fast the meter moves. */
export interface PressureRateProfile {
  /** Where this meter drifts toward when idle (0–100). May be >0 for “worriers”. */
  baseline: number;
  /**
   * Relative speed climbing toward baseline when below it (idle recovery),
   * and when rising under load (events / combat writers). Dimensionless.
   */
  growth: number;
  /**
   * Relative speed falling toward baseline when above it (idle recovery).
   */
  decay: number;
}

export type TemperamentPressureTable = Record<
  PersonalizedPressureId,
  PressureRateProfile
>;

/**
 * Per-character overlay on temperament defaults.
 * - baselineOffset: add to temperament baseline (clamped 0–100)
 * - baselineOverride: replace baseline entirely if set
 * - growthMult / decayMult: multiply temperament rates (1 = unchanged)
 */
export interface CharacterPressureModifiers {
  baselineOffset?: Partial<Record<PersonalizedPressureId, number>>;
  baselineOverride?: Partial<Record<PersonalizedPressureId, number>>;
  growthMult?: Partial<Record<PersonalizedPressureId, number>>;
  decayMult?: Partial<Record<PersonalizedPressureId, number>>;
}

function P(
  baseline: number,
  growth: number,
  decay: number
): PressureRateProfile {
  return { baseline, growth, decay };
}

/**
 * Blend-level defaults (primary–secondary). Characters then specialize.
 * Values are intentional starting points — not final balance.
 */
export const TEMPERAMENT_PRESSURE_DEFAULTS: Record<
  TemperamentBlendId,
  TemperamentPressureTable
> = {
  'Sanguine-Choleric': {
    stress: P(22, 1.15, 1.1),
    energy: P(72, 1.2, 0.95),
    belonging: P(70, 1.25, 1.15),
    agency: P(68, 1.2, 1.0),
    lust: P(45, 1.2, 1.05),
    pride: P(55, 1.25, 1.1),
    shame: P(18, 1.1, 1.15),
  },
  'Sanguine-Phlegmatic': {
    stress: P(15, 0.85, 1.25),
    energy: P(68, 1.05, 0.9),
    belonging: P(75, 1.2, 0.95),
    agency: P(55, 0.95, 1.0),
    lust: P(40, 1.05, 0.95),
    pride: P(48, 1.0, 1.05),
    shame: P(15, 0.9, 1.2),
  },
  'Sanguine-Melancholic': {
    stress: P(32, 1.1, 0.95),
    energy: P(62, 1.1, 1.0),
    belonging: P(65, 1.15, 1.1),
    agency: P(52, 1.0, 1.05),
    lust: P(48, 1.15, 1.0),
    pride: P(45, 1.05, 1.1),
    shame: P(28, 1.15, 0.95),
  },
  'Choleric-Sanguine': {
    stress: P(28, 1.3, 1.05),
    energy: P(75, 1.25, 1.0),
    belonging: P(58, 1.05, 1.15),
    agency: P(78, 1.3, 0.95),
    lust: P(50, 1.2, 1.1),
    pride: P(70, 1.35, 1.0),
    shame: P(20, 1.2, 1.05),
  },
  'Choleric-Melancholic': {
    stress: P(40, 1.35, 0.9),
    energy: P(70, 1.15, 1.05),
    belonging: P(48, 0.9, 1.1),
    agency: P(75, 1.25, 1.0),
    lust: P(42, 1.05, 1.1),
    pride: P(72, 1.3, 0.95),
    shame: P(30, 1.25, 0.9),
  },
  'Choleric-Phlegmatic': {
    stress: P(24, 1.15, 1.2),
    energy: P(70, 1.1, 0.95),
    belonging: P(55, 0.95, 1.0),
    agency: P(72, 1.2, 0.9),
    lust: P(40, 1.0, 1.0),
    pride: P(65, 1.2, 1.0),
    shame: P(18, 1.05, 1.15),
  },
  'Melancholic-Choleric': {
    stress: P(45, 1.3, 0.85),
    energy: P(58, 0.95, 1.1),
    belonging: P(50, 0.95, 1.15),
    agency: P(60, 1.15, 1.05),
    lust: P(44, 1.1, 1.05),
    pride: P(55, 1.15, 1.1),
    shame: P(38, 1.3, 0.85),
  },
  'Melancholic-Phlegmatic': {
    stress: P(36, 1.15, 0.9),
    energy: P(55, 0.9, 1.05),
    belonging: P(58, 0.9, 0.95),
    agency: P(48, 0.9, 1.0),
    lust: P(38, 0.95, 0.95),
    pride: P(42, 0.95, 1.05),
    shame: P(35, 1.2, 0.9),
  },
  'Melancholic-Sanguine': {
    stress: P(38, 1.2, 1.0),
    energy: P(60, 1.05, 1.0),
    belonging: P(62, 1.1, 1.1),
    agency: P(50, 1.0, 1.05),
    lust: P(46, 1.15, 1.0),
    pride: P(48, 1.05, 1.1),
    shame: P(32, 1.2, 0.95),
  },
  'Phlegmatic-Sanguine': {
    stress: P(16, 0.8, 1.3),
    energy: P(65, 0.95, 0.85),
    belonging: P(72, 1.1, 0.9),
    agency: P(52, 0.9, 0.95),
    lust: P(36, 0.95, 0.9),
    pride: P(45, 0.95, 1.0),
    shame: P(14, 0.85, 1.2),
  },
  'Phlegmatic-Choleric': {
    stress: P(20, 1.0, 1.25),
    energy: P(68, 1.05, 0.9),
    belonging: P(60, 0.95, 1.0),
    agency: P(65, 1.1, 0.9),
    lust: P(38, 0.95, 1.0),
    pride: P(58, 1.1, 1.0),
    shame: P(16, 0.95, 1.15),
  },
  'Phlegmatic-Melancholic': {
    stress: P(28, 0.95, 1.05),
    energy: P(58, 0.9, 1.0),
    belonging: P(62, 0.9, 0.95),
    agency: P(50, 0.85, 1.0),
    lust: P(34, 0.9, 0.95),
    pride: P(44, 0.9, 1.05),
    shame: P(25, 1.05, 1.0),
  },
};

const FALLBACK_TABLE = TEMPERAMENT_PRESSURE_DEFAULTS['Phlegmatic-Sanguine'];

export function temperamentPressureTable(
  temperamentRaw: string
): TemperamentPressureTable {
  const parsed = parseTemperament(temperamentRaw);
  const blend = parsed.blend as TemperamentBlendId;
  return TEMPERAMENT_PRESSURE_DEFAULTS[blend] ?? FALLBACK_TABLE;
}

export function resolveCharacterPressureProfile(
  temperamentRaw: string,
  mods?: CharacterPressureModifiers | null
): TemperamentPressureTable {
  const base = temperamentPressureTable(temperamentRaw);
  const out = {} as TemperamentPressureTable;
  for (const id of PERSONALIZED_PRESSURES) {
    const b = base[id];
    const override = mods?.baselineOverride?.[id];
    const offset = mods?.baselineOffset?.[id] ?? 0;
    const gMult = mods?.growthMult?.[id] ?? 1;
    const dMult = mods?.decayMult?.[id] ?? 1;
    const baseline =
      override != null
        ? clamp100(override)
        : clamp100(b.baseline + offset);
    out[id] = {
      baseline,
      growth: Math.max(0.05, b.growth * gMult),
      decay: Math.max(0.05, b.decay * dMult),
    };
  }
  return out;
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * Drift a meter toward baseline for `hours`.
 * Above baseline → fallRate; below → rise using growth (recovery upward).
 * Event spikes still use growth when applying positive load elsewhere.
 */
export function driftTowardBaseline(
  current: number,
  profile: PressureRateProfile,
  hours: number,
  pace = 6
): number {
  const target = profile.baseline;
  if (hours <= 0 || Math.abs(current - target) < 0.01) return current;
  const rate = current > target ? profile.decay : profile.growth;
  const alpha = 1 - Math.exp((-rate * pace * hours) / 10);
  return clamp100(current + (target - current) * alpha);
}

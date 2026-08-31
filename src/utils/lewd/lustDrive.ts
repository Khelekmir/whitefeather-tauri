import type { Unit as DetailedUnit } from '../../types/characters';
import {
  parseTemperament,
  type TemperamentPrimary,
} from '../../data/social/temperaments';
import {
  resolveCharacterPressureProfile,
} from '../../data/social/durablePressures';
import {
  cycleLustTarget,
  hormonesForUnit,
  libidoBaseAppetite,
} from './ovulationCycle';

/**
 * Option A lust model:
 * - Setpoint from libido (× cycle hormones for females).
 * - Temperament only expresses: small mult on setpoint + growth/decay rates.
 * - Durable-pressure drift does not move the lust meter.
 */

const EXPRESSION: Record<TemperamentPrimary, number> = {
  Sanguine: 1.12,
  Choleric: 1.06,
  Melancholic: 0.9,
  Phlegmatic: 0.94,
};

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function approach(value: number, target: number, rate: number, hours: number): number {
  if (!(hours > 0) || rate <= 0) return value;
  return value + (target - value) * (1 - Math.exp(-rate * hours));
}

/** How freely temperament lets libido show in standing lust (≈0.85–1.15). */
export function temperamentLustExpression(temperamentRaw: string): number {
  const t = parseTemperament(temperamentRaw);
  const p = EXPRESSION[t.primary] ?? 1;
  const s = EXPRESSION[t.secondary] ?? 1;
  const w = t.primaryWeight ?? 0.67;
  return Math.max(0.85, Math.min(1.15, p * w + s * (1 - w)));
}

/**
 * Single lust home for Pass Time.
 * Female: libido × cycle hormones × temperament expression.
 * Male: libido appetite × temperament expression (no cycle).
 */
export function standingLustTarget(unit: DetailedUnit): number {
  const libido = unit.lewdStats.static.libido;
  const expr = temperamentLustExpression(unit.socialStats.static.temperament);
  if (unit.sex === 'F') {
    const h = hormonesForUnit(unit);
    if (h) return clamp100(cycleLustTarget(libido, h) * expr);
  }
  return clamp100(libidoBaseAppetite(libido) * expr);
}

/**
 * Drift lust toward standingLustTarget using temperament growth/decay
 * and libido-scaled responsiveness.
 */
export function advanceStandingLust(
  unit: DetailedUnit,
  hours: number
): { unit: DetailedUnit; lustFrom: number; lustTo: number; lustTarget: number } {
  const lustFrom = unit.lewdStats.dynamic.lust ?? 0;
  if (!(hours > 0)) {
    return {
      unit,
      lustFrom,
      lustTo: lustFrom,
      lustTarget: standingLustTarget(unit),
    };
  }

  const lustTarget = standingLustTarget(unit);
  const profile = resolveCharacterPressureProfile(
    unit.socialStats.static.temperament,
    unit.socialStats.static.pressureMods
  );
  const lib = Math.max(1, Math.min(10, unit.lewdStats.static.libido));
  const baseRate = 0.042;
  // Temperament rates from the lust pressure profile; libido hastens rise / slows fall.
  const lustRate =
    lustTarget >= lustFrom
      ? baseRate * profile.lust.growth * (lib / 5)
      : baseRate * profile.lust.decay / (lib / 5);
  const lustTo = clamp100(approach(lustFrom, lustTarget, lustRate, hours));

  return {
    unit: {
      ...unit,
      lewdStats: {
        ...unit.lewdStats,
        dynamic: { ...unit.lewdStats.dynamic, lust: lustTo },
      },
    },
    lustFrom,
    lustTo,
    lustTarget,
  };
}

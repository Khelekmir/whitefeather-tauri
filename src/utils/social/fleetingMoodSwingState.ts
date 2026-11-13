/**
 * Read / write / decay fleeting mood swings on socialStats.dynamic.moodSwings.
 */

import {
  FLEETING_MOOD_SWINGS,
  FLEETING_SWING_TELLS,
  type FleetingMoodSwingId,
  type FleetingMoodSwingScores,
} from '../../data/social/fleetingMoodSwings';
import type { Sex, Unit as DetailedUnit } from '../../types/characters';

export const FLEETING_SWING_TUNING = {
  /** Faster than ST relationship λ (0.7): mostly cleared in ~1–2 h. */
  lambdaPerHour: 1.4,
  snapEpsilon: 0.5,
  /** Ignore below this for mood paint / tells / receptivity. */
  salientMin: 8,
  /** Max intensity 0–100. */
  max: 100,
} as const;

function clampSwing(n: number): number {
  return Math.max(0, Math.min(FLEETING_SWING_TUNING.max, n));
}

export function readMoodSwings(unit: DetailedUnit): FleetingMoodSwingScores {
  return { ...(unit.socialStats.dynamic.moodSwings ?? {}) };
}

export function readMoodSwing(
  unit: DetailedUnit,
  id: FleetingMoodSwingId
): number {
  const v = unit.socialStats.dynamic.moodSwings?.[id];
  return typeof v === 'number' ? v : 0;
}

export function nudgeMoodSwing(
  unit: DetailedUnit,
  id: FleetingMoodSwingId,
  delta: number
): DetailedUnit {
  if (!delta) return unit;
  const prev = readMoodSwing(unit, id);
  const next = clampSwing(prev + delta);
  if (next === prev) return unit;
  const swings = { ...readMoodSwings(unit) };
  if (next <= FLEETING_SWING_TUNING.snapEpsilon) delete swings[id];
  else swings[id] = next;
  return {
    ...unit,
    socialStats: {
      ...unit.socialStats,
      dynamic: {
        ...unit.socialStats.dynamic,
        moodSwings: swings,
      },
    },
  };
}

export function setMoodSwing(
  unit: DetailedUnit,
  id: FleetingMoodSwingId,
  value: number
): DetailedUnit {
  const swings = { ...readMoodSwings(unit) };
  const v = clampSwing(value);
  if (v <= FLEETING_SWING_TUNING.snapEpsilon) delete swings[id];
  else swings[id] = v;
  return {
    ...unit,
    socialStats: {
      ...unit.socialStats,
      dynamic: {
        ...unit.socialStats.dynamic,
        moodSwings: swings,
      },
    },
  };
}

/**
 * Context helper for beats like a public kiss.
 * Lover claim → embarrassment + pride flush (pride is durable) + optional smug.
 * Captor / hostile → embarrassment + shame (durable) — no pride.
 */
export function applyPublicExposureSwing(
  unit: DetailedUnit,
  kind: 'lover' | 'hostile',
  intensity01 = 0.7
): DetailedUnit {
  const amp = Math.max(0, Math.min(1, intensity01)) * 100;
  let next = nudgeMoodSwing(unit, 'embarrassment', amp * 0.55);
  if (kind === 'lover') {
    next = nudgeMoodSwing(next, 'fluster', amp * 0.35);
    next = nudgeMoodSwing(next, 'smug', amp * 0.15);
    // Durable pride chip — not a swing.
    const pride = next.socialStats.dynamic.pride ?? 0;
    next = {
      ...next,
      socialStats: {
        ...next.socialStats,
        dynamic: {
          ...next.socialStats.dynamic,
          pride: Math.max(0, Math.min(100, pride + amp * 0.12)),
        },
      },
    };
  } else {
    const shame = next.socialStats.dynamic.shame ?? 0;
    next = {
      ...next,
      socialStats: {
        ...next.socialStats,
        dynamic: {
          ...next.socialStats.dynamic,
          shame: Math.max(0, Math.min(100, shame + amp * 0.22)),
        },
      },
    };
  }
  return next;
}

export interface MoodSwingDriftDelta {
  id: FleetingMoodSwingId;
  from: number;
  to: number;
}

export function driftMoodSwings(
  unit: DetailedUnit,
  hours: number
): { unit: DetailedUnit; deltas: MoodSwingDriftDelta[] } {
  if (!(hours > 0)) return { unit, deltas: [] };
  const swings = readMoodSwings(unit);
  const deltas: MoodSwingDriftDelta[] = [];
  const next: FleetingMoodSwingScores = {};
  let changed = false;

  for (const row of FLEETING_MOOD_SWINGS) {
    const from = swings[row.id] ?? 0;
    if (from <= 0) continue;
    let to =
      from * Math.exp(-FLEETING_SWING_TUNING.lambdaPerHour * hours);
    if (to <= FLEETING_SWING_TUNING.snapEpsilon) to = 0;
    if (Math.abs(to - from) >= 0.05) {
      deltas.push({ id: row.id, from, to });
    }
    if (to > 0) next[row.id] = to;
    if (to !== from) changed = true;
  }

  if (!changed) return { unit, deltas };

  return {
    unit: {
      ...unit,
      socialStats: {
        ...unit.socialStats,
        dynamic: {
          ...unit.socialStats.dynamic,
          moodSwings: next,
        },
      },
    },
    deltas,
  };
}

/** Salient swings for paint / tells (above threshold, highest first). */
export function listSalientMoodSwings(
  unit: DetailedUnit
): { id: FleetingMoodSwingId; value: number }[] {
  const out: { id: FleetingMoodSwingId; value: number }[] = [];
  for (const row of FLEETING_MOOD_SWINGS) {
    const v = readMoodSwing(unit, row.id);
    if (v >= FLEETING_SWING_TUNING.salientMin) out.push({ id: row.id, value: v });
  }
  return out.sort((a, b) => b.value - a.value);
}

export function moodSwingTellLine(
  unit: DetailedUnit,
  sex: Sex = unit.sex
): string | null {
  const top = listSalientMoodSwings(unit)[0];
  if (!top) return null;
  return FLEETING_SWING_TELLS[top.id][sex === 'M' ? 'M' : 'F'];
}

import {
  PERSONALIZED_PRESSURES,
  resolveCharacterPressureProfile,
  type PersonalizedPressureId,
  type TemperamentPressureTable,
} from '../../data/social/durablePressures';
import type { Unit as DetailedUnit } from '../../types/characters';
import { derivePainLoad } from './painLoad';
import { bandFrom100, type AffectBand } from './resolveMood';

export interface DurablePressureSnapshot {
  profile: TemperamentPressureTable;
  values: Record<PersonalizedPressureId, number>;
  /** Derived 0–100 from itemized health — no personal rates. */
  painLoad: number;
  bands: Record<PersonalizedPressureId | 'painLoad', AffectBand>;
}

/**
 * Ensure dynamic meters exist; optionally snap missing ones to character baselines.
 */
export function hydrateDurablePressures(unit: DetailedUnit): DetailedUnit {
  const profile = resolveCharacterPressureProfile(
    unit.socialStats.static.temperament,
    unit.socialStats.static.pressureMods
  );
  const d = unit.socialStats.dynamic;
  const next = { ...d };
  for (const id of PERSONALIZED_PRESSURES) {
    if (id === 'lust') {
      // lust lives in lewdStats.dynamic
      continue;
    }
    const key = id as Exclude<PersonalizedPressureId, 'lust'>;
    if (next[key] == null || Number.isNaN(next[key])) {
      next[key] = profile[id].baseline;
    }
  }
  // Keep legacy stress if already set; only fill when undefined
  if (d.stress == null) next.stress = profile.stress.baseline;
  return {
    ...unit,
    socialStats: { ...unit.socialStats, dynamic: next },
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
  const bands = {} as DurablePressureSnapshot['bands'];
  for (const id of PERSONALIZED_PRESSURES) {
    values[id] = readPersonalizedValue(unit, id);
    bands[id] = bandFrom100(values[id]);
  }
  const painLoad = derivePainLoad(unit.combatStats.itemizedHealth);
  bands.painLoad = bandFrom100(painLoad);
  return { profile, values, painLoad, bands };
}

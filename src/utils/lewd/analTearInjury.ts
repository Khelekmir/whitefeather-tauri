/**
 * Apply orifice tear from rubbed-raw fatigue onto itemizedHealth.
 * Anal → anus; vaginal → groin.
 */

import type {
  BodyPartId,
  Unit as DetailedUnit,
} from '../../types/characters';
import { refreshBleedAfterInjury } from '../combat/deriveHealthPool';
import { LEWD_TUNING as T } from './lewdTuning';

export function applyOrificeTearInjury(
  unit: DetailedUnit,
  part: BodyPartId,
  healthLoss: number,
  opts?: {
    tearBleedExternal?: number;
    tearBleedInternal?: number;
    label?: string;
  }
): { unit: DetailedUnit; note: string; healthAfter: number } {
  const loss = Math.max(0, healthLoss);
  const existing = unit.combatStats.itemizedHealth[part];
  if (loss <= 1e-6 || !existing) {
    return {
      unit,
      note: '',
      healthAfter: existing?.health ?? 1,
    };
  }

  const external = opts?.tearBleedExternal ?? 0.75;
  const internal = opts?.tearBleedInternal ?? 0.25;
  const itemized = {
    ...unit.combatStats.itemizedHealth,
    [part]: { ...existing },
  };
  const before = itemized[part]!.health;
  itemized[part]!.health = Math.max(0, Math.min(1, before - loss));
  refreshBleedAfterInjury(itemized, part, {
    damagePercent: Math.min(1, loss),
    split: { external, internal },
  });

  const next: DetailedUnit = {
    ...unit,
    combatStats: {
      ...unit.combatStats,
      itemizedHealth: itemized,
    },
  };
  const healthAfter = itemized[part]!.health;
  const label = opts?.label ?? `${part} tear`;
  const note = `${label} · ${part} health ${(before * 100).toFixed(0)}%→${(healthAfter * 100).toFixed(0)}% · bleed ${(itemized[part]!.bleed * 100).toFixed(0)}%`;
  return { unit: next, note, healthAfter };
}

export function applyAnalTearInjury(
  unit: DetailedUnit,
  healthLoss: number
): { unit: DetailedUnit; note: string; healthAfter: number } {
  const R = T.orificePlay.analRaw;
  return applyOrificeTearInjury(unit, 'anus', healthLoss, {
    tearBleedExternal: R.tearBleedExternal,
    tearBleedInternal: R.tearBleedInternal,
    label: 'anal tear',
  });
}

export function applyVaginalTearInjury(
  unit: DetailedUnit,
  healthLoss: number
): { unit: DetailedUnit; note: string; healthAfter: number } {
  const R = T.orificePlay.vaginalRaw;
  return applyOrificeTearInjury(unit, 'groin', healthLoss, {
    tearBleedExternal: R.tearBleedExternal,
    tearBleedInternal: R.tearBleedInternal,
    label: 'vaginal tear',
  });
}

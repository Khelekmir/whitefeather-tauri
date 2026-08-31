import { itemizedLewdForCastId } from '../../data/lewd/castItemizedLewd';
import { lewdBits, type LewdSexKey } from '../../data/lewd/lewdCatalog';
import type { ItemizedLewd, Sex, Unit as DetailedUnit } from '../../types/characters';

function sexKey(sex: Sex): LewdSexKey {
  return sex === 'M' ? 'male' : 'female';
}

/**
 * Fill missing itemizedLewd entries from catalog defaults.
 * preference 1–10 (5 = neutral), prefIntensity ~3–6 from intimacy, maxIntensity from sens.
 */
export function defaultItemizedLewdForSex(sex: Sex): ItemizedLewd {
  const bits = lewdBits[sexKey(sex)];
  const out: ItemizedLewd = {};
  for (const [id, bit] of Object.entries(bits)) {
    const prefIntensity = Math.max(
      2,
      Math.min(7, Math.round(2 + bit.intimacy * 0.35))
    );
    const maxIntensity = Math.max(
      prefIntensity + 1,
      Math.min(10, Math.round(5 + bit.sensitivity * 0.35))
    );
    out[id] = {
      // Slight bias: more intimate parts preferred a bit higher by default
      preference: Math.max(2, Math.min(9, Math.round(4 + bit.intimacy * 0.25))),
      sensitivity: 1, // character multiplier on catalog sensitivity
      prefIntensity,
      maxIntensity,
    };
  }
  return out;
}

export function hydrateItemizedLewd(unit: DetailedUnit): DetailedUnit {
  const castProfile = itemizedLewdForCastId(unit.id);
  const defaults = castProfile ?? defaultItemizedLewdForSex(unit.sex);
  const existing = unit.lewdStats.itemizedLewd ?? {};
  const merged: ItemizedLewd = { ...defaults };
  // Explicit unit overrides still win over cast profile / catalog defaults.
  for (const [id, row] of Object.entries(existing)) {
    merged[id] = {
      preference: row.preference ?? defaults[id]?.preference ?? 5,
      sensitivity: row.sensitivity ?? defaults[id]?.sensitivity ?? 1,
      prefIntensity: row.prefIntensity ?? defaults[id]?.prefIntensity ?? 3,
      maxIntensity: row.maxIntensity ?? defaults[id]?.maxIntensity ?? 8,
    };
  }
  return {
    ...unit,
    lewdStats: {
      ...unit.lewdStats,
      itemizedLewd: merged,
      dynamic: { ...unit.lewdStats.dynamic },
    },
  };
}

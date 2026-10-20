import { getItemTemplate } from '../../data/catalog/itemTemplates';
import {
  formatCloakSizeLabel,
  meanCloakRainMitigation,
  type CloakSize,
} from '../../data/world/cloakRainCoverage';
import { COMBAT_CAST_INVENTORIES } from '../../data/starters/combatCastInventory';
import type { Unit as DetailedUnit } from '../../types/characters';
import type { Item } from '../../types/items';
import type { WorldWeather } from '../../types/world';

export interface WeatherExposureOpts {
  /** Indoors / tent / under solid cover — nulls rain exposure. */
  sheltered?: boolean;
  /** Optional instance bank (Battleground). SocialLab uses cast kits. */
  itemsById?: Record<string, Item>;
}

export interface WeatherExposure {
  /** Ambient after shelter softening (still °F). */
  effectiveAmbientF: number;
  /** 0–1 rain hitting the body (0 if sheltered). Mean under-cloak exposure. */
  rainExposure01: number;
  /** 0–1 mean slot shelter from worn cloak rain wrap. */
  cloakMitigation: number;
  /** Worn cloak rain size, if any. */
  cloakSize: CloakSize | null;
  /**
   * Combined wet pressure for body-temp cooling and future cloth soak.
   * Higher = faster core/skin cooling under rain / surface wet.
   */
  wetPressure01: number;
  sheltered: boolean;
  hasCloak: boolean;
  cloakName: string | null;
}

function resolveBackItem(
  unit: DetailedUnit,
  itemsById?: Record<string, Item>
): Item | null {
  const backId = unit.equipment.back;
  if (!backId) return null;
  if (itemsById?.[backId]) return itemsById[backId]!;
  const kit = (COMBAT_CAST_INVENTORIES as Record<string, { items: Record<string, Item> }>)[
    unit.id
  ];
  if (kit?.items?.[backId]) return kit.items[backId]!;
  return null;
}

function resolveCloakSizeFromItem(item: Item | null): CloakSize | null {
  if (!item || item.slot !== 'back') return null;
  const tpl = getItemTemplate(item.templateId);
  if (tpl?.cloakSize) return tpl.cloakSize;
  if (/cloak/i.test(item.name) || /cloak/i.test(item.templateId)) return 'medium';
  return null;
}

function cloakInfoForUnit(
  unit: DetailedUnit,
  itemsById?: Record<string, Item>
): {
  mitigation: number;
  name: string | null;
  size: CloakSize | null;
} {
  const item = resolveBackItem(unit, itemsById);
  if (item) {
    const size = resolveCloakSizeFromItem(item);
    if (size) {
      return {
        mitigation: meanCloakRainMitigation(size),
        name: `${item.name} (${formatCloakSizeLabel(size)})`,
        size,
      };
    }
  }
  // Fallback: equipment value is itself a template id
  const backId = unit.equipment.back;
  if (backId && getItemTemplate(backId)) {
    const tpl = getItemTemplate(backId)!;
    const size = tpl.cloakSize ?? (/cloak/i.test(tpl.name) ? 'medium' : null);
    if (size) {
      return {
        mitigation: meanCloakRainMitigation(size),
        name: `${tpl.name} (${formatCloakSizeLabel(size)})`,
        size,
      };
    }
  }
  return { mitigation: 0, name: null, size: null };
}

/**
 * How weather hits a unit right now.
 * Returns driver numbers for advanceBodyTemperature (does not mutate).
 * Garment slot soak uses cloak rain coverage presets separately.
 */
export function assessWeatherExposure(
  unit: DetailedUnit,
  weather: WorldWeather,
  opts?: WeatherExposureOpts
): WeatherExposure {
  const sheltered = !!opts?.sheltered;
  const {
    mitigation: cloakMitigation,
    name: cloakName,
    size: cloakSize,
  } = cloakInfoForUnit(unit, opts?.itemsById);
  const hasCloak = cloakMitigation > 0;

  const rainExposure01 = sheltered
    ? 0
    : Math.max(0, Math.min(1, weather.precip01 * (1 - cloakMitigation)));

  // Shelter: slightly milder than raw outdoor ambient (placeholder toward 68°F).
  let effectiveAmbientF = weather.ambientF;
  if (sheltered) {
    effectiveAmbientF = weather.ambientF + (68 - weather.ambientF) * 0.35;
  } else if (hasCloak && weather.precip01 > 0) {
    effectiveAmbientF += 2.5 * cloakMitigation;
  }
  effectiveAmbientF = Math.round(effectiveAmbientF * 10) / 10;

  const wetPressure01 = Math.max(
    0,
    Math.min(
      1,
      weather.surfaceWet01 * 0.45 +
        rainExposure01 * 0.55 +
        (sheltered ? 0 : weather.wind01 * weather.precip01 * 0.15)
    )
  );

  return {
    effectiveAmbientF,
    rainExposure01: Math.round(rainExposure01 * 1000) / 1000,
    cloakMitigation,
    cloakSize,
    wetPressure01: Math.round(wetPressure01 * 1000) / 1000,
    sheltered,
    hasCloak,
    cloakName,
  };
}

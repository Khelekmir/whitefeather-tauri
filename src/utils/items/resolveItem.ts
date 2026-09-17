import { ARMOR_LAYERS } from '../../data/combat/armorLayers';
import { getArmorSlotSize } from '../../data/combat/armorSlotSize';
import {
  CHEST_COVERAGE_PRESETS,
  DEFAULT_SLOT_COVERAGE,
  FOOTWEAR_LENGTH_COVERAGE,
  GARMENT_LENGTH_COVERAGE,
  GARMENT_SLEEVE_COVERAGE,
  HEADWEAR_COVERAGE,
  type CoverageMap,
} from '../../data/combat/coveragePresets';
import {
  getUnderwearStyleCoverage,
  getUndershirtStyleCoverage,
} from '../../data/combat/undergarmentCoverage';
import { getMaterial, type MaterialStats } from '../../data/combat/materials';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import type { BodyPartId } from '../../types/characters';
import type {
  EquipmentLoadout,
  Item,
  ItemSlot,
  ItemTemplate,
} from '../../types/items';

export interface ResolvedItem {
  instance: Item;
  template: ItemTemplate;
  material: MaterialStats;
  weight: number;
  coverage: CoverageMap;
  durabilityRatio: number;
}

/**
 * Effective coverage for an armor template:
 * explicit coverage → underwearStyle → undershirtStyle → headwearStyle →
 * garmentLength (+ optional sleeveStyle merge) → footwearLength →
 * chest sizePreset → slot default.
 *
 * Hem (`garmentLength`) and sleeves (`sleeveStyle`) are orthogonal: e.g.
 * Serra long + none, Amberyl tunic + long, Florina short + short.
 */
export function getTemplateCoverage(template: ItemTemplate): CoverageMap {
  if (template.coverage) return template.coverage;
  if (template.underwearStyle) {
    const map = getUnderwearStyleCoverage(template.underwearStyle);
    if (map) return map;
  }
  if (template.undershirtStyle) {
    const map = getUndershirtStyleCoverage(template.undershirtStyle);
    if (map) return map;
  }
  if (template.headwearStyle) {
    return HEADWEAR_COVERAGE[template.headwearStyle];
  }
  if (template.garmentLength || template.sleeveStyle) {
    const hem = template.garmentLength
      ? GARMENT_LENGTH_COVERAGE[template.garmentLength]
      : template.slot === 'shirt'
        ? GARMENT_LENGTH_COVERAGE.tunic
        : {};
    const sleeves =
      template.sleeveStyle != null
        ? GARMENT_SLEEVE_COVERAGE[template.sleeveStyle]
        : {};
    return { ...hem, ...sleeves };
  }
  if (template.footwearLength) {
    return FOOTWEAR_LENGTH_COVERAGE[template.footwearLength];
  }
  if (template.slot === 'chest' && template.sizePreset) {
    return CHEST_COVERAGE_PRESETS[template.sizePreset];
  }
  return DEFAULT_SLOT_COVERAGE[template.slot] ?? {};
}

export function calcItemWeight(template: ItemTemplate): number {
  if (template.flags?.unequipped) return 0;
  const material = getMaterial(template.material);
  if (template.itemType === 'armor') {
    const size = getArmorSlotSize(template.slot);
    return (size / 5) * material.weight;
  }
  // Weapons / shields: simple material weight for now (type size factors later)
  return material.weight;
}

export function resolveItem(instance: Item): ResolvedItem | null {
  const template = getItemTemplate(instance.templateId);
  if (!template) return null;
  const material = getMaterial(template.material);
  const coverage =
    template.itemType === 'armor' ? getTemplateCoverage(template) : {};
  const maxD = instance.maxDurability || 1;
  return {
    instance,
    template,
    material,
    weight: calcItemWeight(template),
    coverage,
    durabilityRatio: Math.max(0, Math.min(1, instance.durability / maxD)),
  };
}

/**
 * Layers that protect a body part for a given loadout, outer → inner.
 * Hybrid rule: slot must be in ARMOR_LAYERS[part] AND coverage[part] > 0 when coverage exists.
 */
export function getProtectingArmor(
  part: BodyPartId,
  equipment: EquipmentLoadout,
  itemsById: Record<string, Item>
): ResolvedItem[] {
  const slots = ARMOR_LAYERS[part] ?? [];
  const layers: ResolvedItem[] = [];

  for (const slot of slots) {
    const itemId = equipment[slot];
    if (!itemId) continue;
    const instance = itemsById[itemId];
    if (!instance || instance.itemType !== 'armor') continue;
    const resolved = resolveItem(instance);
    if (!resolved) continue;

    const cov = resolved.coverage[part];
    // No coverage keys at all → treat as covering (slot default empty map)
    const coverageKeys = Object.keys(resolved.coverage);
    if (coverageKeys.length > 0 && !(cov && cov > 0)) continue;

    layers.push(resolved);
  }

  return layers;
}

export function listEquippedResolved(
  equipment: EquipmentLoadout,
  itemsById: Record<string, Item>
): { slot: ItemSlot; resolved: ResolvedItem }[] {
  const out: { slot: ItemSlot; resolved: ResolvedItem }[] = [];
  for (const [slot, itemId] of Object.entries(equipment) as [ItemSlot, string | null][]) {
    if (!itemId) continue;
    const instance = itemsById[itemId];
    if (!instance) continue;
    const resolved = resolveItem(instance);
    if (!resolved) continue;
    out.push({ slot, resolved });
  }
  return out;
}

export function sumEquippedWeight(
  equipment: EquipmentLoadout,
  itemsById: Record<string, Item>
): number {
  return listEquippedResolved(equipment, itemsById).reduce(
    (sum, { resolved }) => sum + resolved.weight,
    0
  );
}

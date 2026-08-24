import { getCombatCastInventory } from '../../data/starters/combatCastInventory';
import type { StanceId, Unit as DetailedUnit } from '../../types/characters';
import type { Item, ItemSlot } from '../../types/items';
import {
  listEquippedResolved,
  resolveItem,
  sumEquippedWeight,
  type ResolvedItem,
} from '../items/resolveItem';

/** Snapshot of one fighter for battleground / future combat sim. */
export interface CombatantSnapshot {
  unit: DetailedUnit;
  itemsById: Record<string, Item>;
  equipped: { slot: ItemSlot; resolved: ResolvedItem }[];
  gearWeight: number;
  mainhand: ResolvedItem | null;
  offhand: ResolvedItem | null;
  /** Average durability ratio across equipped armor (0–1). */
  avgArmorDurability: number;
  /** Top weapon skills (rank > 1), highest first. */
  trainedWeaponSkills: { type: string; rank: number }[];
  /** Stance ranks above baseline, highest first. */
  trainedStanceSkills: { id: StanceId; rank: number }[];
}

/**
 * @param itemsByIdOverride — pass live Battleground item bank after durability changes;
 *   defaults to the static starter kit for this unit id.
 */
export function compileCombatant(
  unit: DetailedUnit,
  itemsByIdOverride?: Record<string, Item>
): CombatantSnapshot {
  const kit = getCombatCastInventory(unit.id);
  const itemsById = itemsByIdOverride ?? kit?.items ?? {};
  const equipped = listEquippedResolved(unit.equipment, itemsById);
  const gearWeight = sumEquippedWeight(unit.equipment, itemsById);

  const mainId = unit.equipment.mainhand;
  const offId = unit.equipment.offhand;
  const mainhand =
    mainId && itemsById[mainId] ? resolveItem(itemsById[mainId]) : null;
  const offhand =
    offId && itemsById[offId] ? resolveItem(itemsById[offId]) : null;

  const armorPieces = equipped.filter((e) => e.resolved.instance.itemType === 'armor');
  const avgArmorDurability =
    armorPieces.length === 0
      ? 1
      : armorPieces.reduce((s, e) => s + e.resolved.durabilityRatio, 0) /
        armorPieces.length;

  const trainedWeaponSkills = Object.entries(unit.combatStats.weaponSkill)
    .filter(([, rank]) => rank > 1)
    .map(([type, rank]) => ({ type, rank }))
    .sort((a, b) => b.rank - a.rank);

  const trainedStanceSkills = (
    Object.entries(unit.combatStats.stanceSkill) as [StanceId, number][]
  )
    .filter(([, rank]) => rank > 1)
    .map(([id, rank]) => ({ id, rank }))
    .sort((a, b) => b.rank - a.rank);

  return {
    unit,
    itemsById,
    equipped,
    gearWeight,
    mainhand,
    offhand,
    avgArmorDurability,
    trainedWeaponSkills,
    trainedStanceSkills,
  };
}

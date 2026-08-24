import type { ItemSlot } from '../../types/items';

/**
 * Relative mass / coverage bulk by equipment slot
 * (from utils_old CombatConfig.armorSizeMultipliers).
 * Used for weight: (multiplier / 5) * material.weight
 */
export const ARMOR_SLOT_SIZE: Partial<Record<ItemSlot, number>> = {
  head: 5,
  shoulder: 5,
  back: 5,
  chest: 8,
  shirt: 10,
  undershirt: 2,
  waist: 4,
  underwear: 2,
  hand: 5,
  wrist: 3,
  leg: 10,
  shin: 5,
  foot: 6,
  neck: 2,
};

export function getArmorSlotSize(slot: ItemSlot): number {
  return ARMOR_SLOT_SIZE[slot] ?? 1;
}

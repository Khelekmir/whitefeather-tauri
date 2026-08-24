/**
 * Shared material table (ported from utils_old CombatConfig.equipmentMaterial).
 * Armor/weapon templates reference these by MaterialId.
 */

import type { MaterialId } from '../../types/items';

export const MATERIALS: Record<
  MaterialId,
  { weight: number; strength: number; durability: number; description: string }
> = {
  unequipped: {
    weight: 0,
    strength: 0,
    durability: 0,
    description: 'Nothing!',
  },
  body: {
    weight: 0,
    strength: 2,
    durability: 2,
    description: 'The human body. Not suited for prolonged combat.',
  },
  cloth: {
    weight: 1,
    strength: 1,
    durability: 1,
    description: 'Protection from the elements, but not much else.',
  },
  leather: {
    weight: 2,
    strength: 2,
    durability: 2,
    description: 'Light and flexible, but not very durable.',
  },
  wood: {
    weight: 2,
    strength: 2,
    durability: 2,
    description: 'Very light and easy to carry, but weak and prone to damage.',
  },
  iron: {
    weight: 6,
    strength: 5,
    durability: 4,
    description: 'Heavy and strong, but rust-prone and relatively brittle.',
  },
  lowGradeSteel: {
    weight: 5,
    strength: 6,
    durability: 5,
    description: 'A modest improvement over iron; standard issue gear.',
  },
  highGradeSteel: {
    weight: 5,
    strength: 7,
    durability: 7,
    description: 'Durable and well-balanced; typical of elite armaments.',
  },
  springSteel: {
    weight: 5,
    strength: 8,
    durability: 8,
    description: 'Retains shape under stress; ideal for impact-absorbing designs.',
  },
  mithril: {
    weight: 2,
    strength: 7,
    durability: 9,
    description:
      'Mystical light-metal; strong as steel but featherweight and near-impervious to wear.',
  },
  adamantite: {
    weight: 4,
    strength: 10,
    durability: 10,
    description: 'Heavy-duty alloy; incredibly strong and virtually indestructible.',
  },
};

export type MaterialStats = (typeof MATERIALS)[MaterialId];

export function getMaterial(id: MaterialId): MaterialStats {
  return MATERIALS[id];
}

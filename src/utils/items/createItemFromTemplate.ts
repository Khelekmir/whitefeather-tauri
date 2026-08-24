import { getItemTemplate } from '../../data/catalog/itemTemplates';
import {
  EMPTY_COMBAT_BONUS,
  EMPTY_LEWD_BONUS,
  type Item,
  type ItemSlot,
} from '../../types/items';

let seq = 0;

function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}_${seq}_${Date.now().toString(36)}`;
}

export interface CreateItemOptions {
  /** Stable id for fixtures / tests (recommended for starter kits). */
  id?: string;
  ownerId?: string;
  equippedSlot?: ItemSlot | null;
  durability?: number;
}

/**
 * Spawn a runtime Item from a catalog template.
 * Prefer stable `id` when wiring known starter loadouts.
 */
export function createItemFromTemplate(
  templateId: string,
  options: CreateItemOptions = {}
): Item {
  const template = getItemTemplate(templateId);
  if (!template) {
    throw new Error(`Unknown item template: ${templateId}`);
  }

  const maxDurability = template.maxDurability;
  return {
    id: options.id ?? nextId(template.templateId),
    templateId: template.templateId,
    name: template.name,
    itemType: template.itemType,
    slot: template.slot,
    description: template.description,
    material: template.material,
    weaponType: template.weaponType,
    combatStats: template.combatBonus ?? { ...EMPTY_COMBAT_BONUS },
    lewdStats: template.lewdBonus ?? { ...EMPTY_LEWD_BONUS },
    flags: { ...template.flags },
    durability: options.durability ?? maxDurability,
    maxDurability,
    ownerId: options.ownerId,
    equippedSlot: options.equippedSlot ?? null,
  };
}

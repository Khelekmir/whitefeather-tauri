import { getItemTemplate } from '../../data/catalog/itemTemplates';
import type { BodyPartId } from '../../types/characters';
import {
  EMPTY_COMBAT_BONUS,
  EMPTY_LEWD_BONUS,
  type Item,
  type ItemSlot,
  type PanelDurabilityMap,
} from '../../types/items';
import {
  applyPanelWearFractions,
  deriveItemDurability,
  initPanelDurability,
} from './panelDurability';
import { getTemplateCoverage } from './resolveItem';

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
  /**
   * Scalar durability override. For armor with panels, used as fallback when
   * no panel map is built; otherwise panels drive the derived scalar.
   */
  durability?: number;
  /** Explicit panel map (absolute remaining). Armor only. */
  panelDurability?: PanelDurabilityMap;
  /**
   * Per-part remaining fraction 0–1 applied onto freshly init panels.
   * Ignored if `panelDurability` is provided.
   */
  panelWear?: Partial<Record<BodyPartId, number>>;
}

/**
 * Spawn a runtime Item from a catalog template.
 * Prefer stable `id` when wiring known starter loadouts.
 * Armor gets sparse `panelDurability` from resolved coverage (shields excluded).
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
  const isArmor = template.itemType === 'armor';

  let panelDurability: PanelDurabilityMap | undefined;
  let durability = options.durability ?? maxDurability;

  if (isArmor) {
    const coverage = getTemplateCoverage(template);
    if (options.panelDurability) {
      panelDurability = { ...options.panelDurability };
    } else {
      panelDurability = initPanelDurability(coverage, maxDurability);
      if (options.panelWear) {
        panelDurability = applyPanelWearFractions(
          panelDurability,
          maxDurability,
          options.panelWear
        );
      } else if (options.durability != null && maxDurability > 0) {
        // Legacy STARTER_WEAR scalar: spread evenly across all panels.
        const frac = Math.max(0, Math.min(1, options.durability / maxDurability));
        panelDurability = applyPanelWearFractions(
          panelDurability,
          maxDurability,
          Object.fromEntries(
            Object.keys(panelDurability).map((p) => [p, frac])
          ) as Partial<Record<BodyPartId, number>>
        );
      }
    }
    durability = deriveItemDurability(
      panelDurability,
      coverage,
      maxDurability,
      options.durability ?? maxDurability
    );
  }

  return {
    id: options.id ?? nextId(template.templateId),
    templateId: template.templateId,
    name: template.name,
    itemType: template.itemType,
    slot: template.slot,
    description: template.description,
    material: template.material,
    weaponType: template.weaponType,
    shieldType: template.shieldType,
    projectileMass: template.projectileMass,
    tipFactor: template.tipFactor,
    shaftGrade: template.shaftGrade,
    arrowHeadStyle: template.arrowHeadStyle,
    combatStats: template.combatBonus ?? { ...EMPTY_COMBAT_BONUS },
    lewdStats: template.lewdBonus ?? { ...EMPTY_LEWD_BONUS },
    flags: { ...template.flags },
    durability,
    maxDurability,
    ...(panelDurability ? { panelDurability } : {}),
    ownerId: options.ownerId,
    equippedSlot: options.equippedSlot ?? null,
  };
}

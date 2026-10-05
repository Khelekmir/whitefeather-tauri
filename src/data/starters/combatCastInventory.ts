import { getItemTemplate } from '../catalog/itemTemplates';
import { createItemFromTemplate } from '../../utils/items/createItemFromTemplate';
import {
  createEmptyEquipmentLoadout,
  type EquipmentLoadout,
  type Item,
  type ItemSlot,
} from '../../types/items';

export type CombatCastId =
  | 'unit_amberyl'
  | 'unit_sain'
  | 'unit_lyn'
  | 'unit_kent'
  | 'unit_serra'
  | 'unit_florina'
  | 'unit_wil'
  | 'unit_sapphira'
  | 'unit_matthew'
  | 'unit_dorcas'
  | 'unit_natalie'
  | 'unit_brigand';

type SlotTemplateMap = Partial<Record<ItemSlot, string>>;

/**
 * Remaining durability as a fraction of max (1 = pristine, 0 = ruined).
 * Omit a slot to leave that piece at full maxDurability.
 *
 * Passed into createItemFromTemplate as:
 *   durability: fraction * template.maxDurability
 */
type SlotWearMap = Partial<Record<ItemSlot, number>>;

/** templateId per worn slot — unequipped slots omitted (null). */
const STARTER_LOADOUTS: Record<CombatCastId, SlotTemplateMap> = {
  unit_amberyl: {
    head: 'wool-hood',
    back: 'wool-cloak',
    shirt: 'linen-tunic-sand',
    undershirt: 'fine-linen-undershirt',
    hand: 'doeskin-gloves',
    waist: 'leather-belt',
    underwear: 'fine-linen-underwear',
    leg: 'doeskin-wool-pants',
    foot: 'doeskin-leather-boots',
    // Decorative dagger only — no dual-wield at outset (empty offhand for pressure/care).
    mainhand: 'decorative-dagger',
  },
  unit_sain: {
    head: 'linen-headband',
    shoulder: 'caelin-pauldrons',
    back: 'wool-cloak',
    chest: 'caelin-breastplate',
    shirt: 'linen-tunic',
    wrist: 'steel-bracers',
    hand: 'leather-gloves',
    waist: 'leather-belt',
    underwear: 'linen-underwear',
    leg: 'wool-pants',
    shin: 'steel-greaves',
    foot: 'leather-boots',
    mainhand: 'caelin-lance',
  },
  unit_lyn: {
    head: 'leather-hair-tie',
    back: 'wool-cloak',
    shirt: 'fine-sacaen-tunic',
    undershirt: 'linen-breastcloth',
    wrist: 'sacaen-bracelets',
    hand: 'fine-sacaen-gloves',
    waist: 'linen-sash',
    underwear: 'linen-smallcloth',
    foot: 'embroidered-doeskin-boots',
    mainhand: 'sacaen-sword',
  },
  unit_kent: {
    shoulder: 'caelin-pauldrons',
    back: 'wool-cloak',
    chest: 'caelin-breastplate',
    shirt: 'linen-tunic',
    wrist: 'steel-bracers',
    hand: 'leather-gloves',
    waist: 'leather-belt',
    underwear: 'linen-underwear',
    leg: 'wool-pants',
    shin: 'steel-greaves',
    foot: 'leather-boots',
    mainhand: 'caelin-sword',
    offhand: 'caelin-steel-heater',
  },
  unit_serra: {
    head: 'silk-twintail-ties',
    back: 'wool-cloak',
    shirt: 'fine-linen-dress',
    undershirt: 'cotton-chemise',
    hand: 'fine-linen-gloves',
    waist: 'fine-linen-sash',
    underwear: 'cotton-underwear',
    foot: 'soft-leather-shoes',
    mainhand: 'elimine-staff',
  },
  unit_florina: {
    head: 'ilian-circlet',
    shoulder: 'ilian-pauldrons',
    back: 'wool-cloak',
    chest: 'ilian-breastplate',
    shirt: 'ilian-wool-tunic-short',
    undershirt: 'ilian-linen-breastcloth',
    hand: 'ilian-wool-gloves',
    waist: 'leather-belt',
    underwear: 'ilian-linen-underwear',
    foot: 'ilian-leather-riding-boots',
    mainhand: 'ilian-lance',
  },
  // Archer — light kit, two-hand shortbow (empty offhand).
  unit_wil: {
    head: 'linen-headband',
    back: 'wool-cloak',
    shirt: 'linen-tunic',
    undershirt: 'male-linen-undershirt',
    hand: 'doeskin-gloves',
    waist: 'leather-belt',
    underwear: 'linen-underwear',
    leg: 'doeskin-wool-pants',
    foot: 'doeskin-leather-boots',
    mainhand: 'pherae-shortbow',
  },
  // Noble archer — soft travel clothes + hunting recurve.
  unit_sapphira: {
    head: 'silk-twintail-ties',
    back: 'wool-cloak',
    shirt: 'fine-linen-dress',
    undershirt: 'cotton-chemise',
    hand: 'fine-linen-gloves',
    waist: 'fine-linen-sash',
    underwear: 'cotton-underwear',
    foot: 'soft-leather-shoes',
    mainhand: 'araphen-hunting-bow',
  },
  // Dagger tester — soft kit, no breastplate (organ pierce lab).
  unit_matthew: {
    head: 'linen-headband',
    back: 'wool-cloak',
    shirt: 'linen-tunic',
    undershirt: 'male-linen-undershirt',
    hand: 'doeskin-gloves',
    waist: 'leather-belt',
    underwear: 'linen-underwear',
    leg: 'doeskin-wool-pants',
    foot: 'doeskin-leather-boots',
    mainhand: 'steel-dagger',
  },
  // Village fighter — soft leather/wool kit, iron hand axe (empty offhand → two-hand grip).
  unit_dorcas: {
    head: 'linen-headband',
    back: 'wool-cloak',
    shirt: 'linen-tunic',
    undershirt: 'male-linen-undershirt',
    hand: 'leather-gloves',
    waist: 'leather-belt',
    underwear: 'linen-underwear',
    leg: 'wool-pants',
    foot: 'leather-boots',
    mainhand: 'bern-hand-axe',
  },
  // Civilian caregiver — soft dress, no weapon; limp-friendly soft shoes.
  unit_natalie: {
    back: 'wool-cloak',
    shirt: 'linen-tunic-sand',
    undershirt: 'cotton-chemise',
    waist: 'linen-sash',
    underwear: 'cotton-underwear',
    foot: 'soft-leather-shoes',
  },
  // Generic brigand — mail hauberk + ragged soft kit, two-hand greataxe (mail glance tester).
  unit_brigand: {
    head: 'linen-headband',
    back: 'wool-cloak',
    chest: 'iron-chain-hauberk',
    shirt: 'linen-tunic',
    undershirt: 'male-linen-undershirt',
    hand: 'leather-gloves',
    waist: 'leather-belt',
    underwear: 'linen-underwear',
    leg: 'wool-pants',
    foot: 'leather-boots',
    mainhand: 'brigand-greataxe',
  },
};

/**
 * Flavor wear for the detailed cast (travel mud / road scuffs / battle nicks).
 * Only lists pieces that are not pristine — everything else stays at 100%.
 */
const STARTER_WEAR: Record<CombatCastId, SlotWearMap> = {
  // Road dust and brush — soft kit takes travel wear, not battle scars
  unit_amberyl: {
    foot: 0.78, // miles on the road
    leg: 0.88,
    back: 0.92, // cloak snagged on brush
    hand: 0.85,
    shirt: 0.9,
  },
  // Recent skirmish — plate and weapon show combat loss
  unit_sain: {
    chest: 0.72, // breastplate took hits
    shoulder: 0.8,
    shin: 0.75,
    mainhand: 0.68, // lance tip stressed
    foot: 0.86,
    shirt: 0.9, // tunic under plate rubbed
  },
  // Light travel + a few sword drills
  unit_lyn: {
    foot: 0.8,
    mainhand: 0.84, // Sacaen sword edge work
    shirt: 0.91,
    back: 0.94,
  },
  // Shield wall veteran — shield and sword more worn than Sain's
  unit_kent: {
    offhand: 0.55, // heater chewed up
    mainhand: 0.7,
    chest: 0.78,
    hand: 0.82,
    wrist: 0.85,
    shin: 0.8,
    foot: 0.88,
  },
  // Soft clerical clothes — travel hem wear, shoes muddy
  unit_serra: {
    foot: 0.74,
    shirt: 0.86, // dress hem
    back: 0.9,
    hand: 0.93,
  },
  // Flight practice + lance work — riding boots and plate scored
  unit_florina: {
    foot: 0.7, // riding boots hard-used
    chest: 0.81,
    shoulder: 0.77,
    mainhand: 0.73, // Ilian lance
    shirt: 0.88, // short tunic
    hand: 0.9,
  },
  // Road marches + string wear
  unit_wil: {
    foot: 0.76,
    hand: 0.84,
    mainhand: 0.8, // bow limbs worked
    shirt: 0.9,
    back: 0.93,
  },
  // Estate roads + practice yard
  unit_sapphira: {
    foot: 0.82,
    shirt: 0.88,
    mainhand: 0.86,
    back: 0.94,
  },
  // Knife work + road wear
  unit_matthew: {
    foot: 0.8,
    hand: 0.86,
    mainhand: 0.88,
    shirt: 0.91,
    back: 0.94,
  },
  // Village labor + axe work — boots and gloves chewed, axe edge used
  unit_dorcas: {
    foot: 0.72,
    hand: 0.78,
    mainhand: 0.7,
    leg: 0.84,
    shirt: 0.86,
    back: 0.9,
  },
  // Quiet village wear — shoes favored for the limp, hem dust
  unit_natalie: {
    foot: 0.7,
    shirt: 0.88,
    back: 0.94,
  },
  // Road ambush kit — filthy clothes, scored mail, nicked greataxe
  unit_brigand: {
    foot: 0.65,
    hand: 0.7,
    mainhand: 0.62,
    chest: 0.78,
    leg: 0.75,
    shirt: 0.78,
    back: 0.82,
  },
};

export interface CharacterInventoryKit {
  unitId: CombatCastId;
  /**
   * Owned instance bank (equipped + unequipped-owned).
   * Starters begin fully equipped; `equipGear` can leave items here with
   * `equippedSlot: null` until re-equipped or discarded.
   */
  items: Record<string, Item>;
  /** Slot → instance id */
  equipment: EquipmentLoadout;
}

/** Unequipped care stock every cast starts with (consumed on use). */
const STARTER_CARE: { templateId: string; count: number }[] = [
  { templateId: 'field-bandage', count: 2 },
  { templateId: 'vulnerary-salve', count: 1 },
];

/**
 * Extra care stock for caregivers (Natalie). Counts stack on top of STARTER_CARE.
 */
const STARTER_CARE_EXTRA: Partial<
  Record<CombatCastId, { templateId: string; count: number }[]>
> = {
  unit_natalie: [
    { templateId: 'field-bandage', count: 6 },
    { templateId: 'vulnerary-salve', count: 3 },
  ],
};

/** Archer ammo seed (owned bank). */
const STARTER_ARROWS: { templateId: string; count: number }[] = [
  { templateId: 'arrow-hunting', count: 12 },
  { templateId: 'arrow-practice', count: 5 },
  { templateId: 'arrow-war', count: 5 },
  { templateId: 'arrow-bodkin', count: 5 },
];

const ARCHER_UNITS = new Set<CombatCastId>(['unit_wil', 'unit_sapphira']);

function addCareStock(
  unitId: CombatCastId,
  items: Record<string, Item>,
  packs: { templateId: string; count: number }[],
  idPrefix: string
) {
  for (const { templateId, count } of packs) {
    for (let i = 0; i < count; i += 1) {
      const instanceId = `${unitId}__${idPrefix}_${templateId}_${i + 1}`;
      items[instanceId] = createItemFromTemplate(templateId, {
        id: instanceId,
        ownerId: unitId,
        equippedSlot: null,
      });
    }
  }
}

function buildKit(unitId: CombatCastId): CharacterInventoryKit {
  const map = STARTER_LOADOUTS[unitId];
  const wear = STARTER_WEAR[unitId] ?? {};
  const items: Record<string, Item> = {};
  const equipPatch: Partial<Record<ItemSlot, string | null>> = {};

  for (const [slot, templateId] of Object.entries(map) as [ItemSlot, string][]) {
    const template = getItemTemplate(templateId);
    if (!template) {
      throw new Error(`Unknown template ${templateId} for ${unitId}.${slot}`);
    }

    const remainingFraction = wear[slot];
    // Absolute durability on the instance (same units as maxDurability, usually 0–1)
    const durability =
      remainingFraction !== undefined
        ? Math.max(0, Math.min(1, remainingFraction)) * template.maxDurability
        : undefined;

    const instanceId = `${unitId}__${slot}`;
    const item = createItemFromTemplate(templateId, {
      id: instanceId,
      ownerId: unitId,
      equippedSlot: slot,
      durability, // omit → createItemFromTemplate uses full maxDurability
    });
    items[instanceId] = item;
    equipPatch[slot] = instanceId;
  }

  addCareStock(unitId, items, STARTER_CARE, 'care');
  const extraCare = STARTER_CARE_EXTRA[unitId];
  if (extraCare) {
    addCareStock(unitId, items, extraCare, 'care_extra');
  }

  if (ARCHER_UNITS.has(unitId)) {
    for (const { templateId, count } of STARTER_ARROWS) {
      for (let i = 0; i < count; i += 1) {
        const instanceId = `${unitId}__ammo_${templateId}_${i + 1}`;
        items[instanceId] = createItemFromTemplate(templateId, {
          id: instanceId,
          ownerId: unitId,
          equippedSlot: null,
        });
      }
    }
  }

  return {
    unitId,
    items,
    equipment: createEmptyEquipmentLoadout(equipPatch),
  };
}

export const COMBAT_CAST_INVENTORIES: Record<CombatCastId, CharacterInventoryKit> = {
  unit_amberyl: buildKit('unit_amberyl'),
  unit_sain: buildKit('unit_sain'),
  unit_lyn: buildKit('unit_lyn'),
  unit_kent: buildKit('unit_kent'),
  unit_serra: buildKit('unit_serra'),
  unit_florina: buildKit('unit_florina'),
  unit_wil: buildKit('unit_wil'),
  unit_sapphira: buildKit('unit_sapphira'),
  unit_matthew: buildKit('unit_matthew'),
  unit_dorcas: buildKit('unit_dorcas'),
  unit_natalie: buildKit('unit_natalie'),
  unit_brigand: buildKit('unit_brigand'),
};

/** Flat bank of every starter instance (for lookup by id). */
export const DETAILED_ITEM_BANK: Record<string, Item> = Object.values(
  COMBAT_CAST_INVENTORIES
).reduce<Record<string, Item>>((acc, kit) => {
  Object.assign(acc, kit.items);
  return acc;
}, {});

export function getCombatCastInventory(
  unitId: string
): CharacterInventoryKit | undefined {
  return COMBAT_CAST_INVENTORIES[unitId as CombatCastId];
}

export function getDetailedItem(itemId: string): Item | undefined {
  return DETAILED_ITEM_BANK[itemId];
}

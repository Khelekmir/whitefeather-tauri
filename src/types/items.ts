import type { BodyPartId, WeaponTypeId } from './characters';

export type ItemType =
  | 'weapon'
  | 'shield'
  | 'armor'
  | 'amulet'
  | 'trinket'
  | 'ring'
  | 'consumable'
  | 'other';

/** Matches keys in data/combat/materials.ts */
export type MaterialId =
  | 'unequipped'
  | 'body'
  | 'cloth'
  | 'leather'
  | 'wood'
  | 'iron'
  | 'lowGradeSteel'
  | 'highGradeSteel'
  | 'springSteel'
  | 'mithril'
  | 'adamantite';

/** How far a chest piece extends over the torso. */
export type ArmorSizePreset = 'small' | 'medium' | 'large';

/**
 * How far a shirt-slot garment hangs (tunics, dresses, robes).
 * Casters often wear short/mid dresses or long robes with bare legs underneath.
 */
export type GarmentLengthPreset = 'tunic' | 'short' | 'long' | 'full';

/**
 * How high footwear rises (foot slot).
 * - slipper: below the ankle
 * - shoe: above the ankle
 * - boot: about mid-calf
 * - kneeHigh: just below the knee
 * - riding: above the knee (pegasus / cavalry)
 */
export type FootwearLengthPreset =
  | 'slipper'
  | 'shoe'
  | 'boot'
  | 'kneeHigh'
  | 'riding';

/**
 * Head-slot coverage style.
 * - fullHelmet: enclosed — head, face, eyes, ears
 * - halfHelm: open-face / nasal — head + partial face/ears
 * - hat: crown / brim — mainly scalp, light ears
 * - hairOrnament: ribbons, ties, circlets — negligible combat coverage
 *   (value comes from flags / lewd / presentation later)
 */
export type HeadwearStyle = 'fullHelmet' | 'halfHelm' | 'hat' | 'hairOrnament';

/** Female underwear-slot styles (panties, tribal cloth, slip skirts). */
export type FemaleUnderwearStyle =
  | 'pegasusPanty'
  | 'tribalCloth'
  | 'modestPanty'
  | 'risquePanty'
  | 'longSlipSkirt'
  | 'shortSlipSkirt';

/** Male underwear-slot styles. */
export type MaleUnderwearStyle = 'briefs' | 'loincloth' | 'shorts';

export type UnderwearStyle = FemaleUnderwearStyle | MaleUnderwearStyle;

/** Female undershirt-slot styles (slips, bras, breast cloth). */
export type FemaleUndershirtStyle =
  | 'fullSlip'
  | 'slip'
  | 'shortSlip'
  | 'tribalBreastCloth'
  | 'modestBra'
  | 'risqueBra'
  | 'pegasusBra';

/** Male undershirt-slot styles. */
export type MaleUndershirtStyle = 'undershirt' | 'binding';

export type UndershirtStyle = FemaleUndershirtStyle | MaleUndershirtStyle;

/** Hit-location coverage strength 0–1 */
export type CoverageMap = Partial<Record<BodyPartId, number>>;

/**
 * Canonical equipment slots on every character (and valid item equip targets).
 * Order is the authoring / display order for loadouts.
 */
export const EQUIPMENT_SLOTS = [
  'undershirt',
  'underwear',
  'offhand',
  'head',
  'neck',
  'shoulder',
  'back',
  'chest',
  'shirt',
  'wrist',
  'hand',
  'waist',
  'leg',
  'shin',
  'foot',
  'ring1',
  'ring2',
  'trinket1',
  'trinket2',
  'mainhand',
] as const;

export type ItemSlot = (typeof EQUIPMENT_SLOTS)[number];

/** Alias used on character loadouts. */
export type EquipmentSlotId = ItemSlot;

/** Full loadout: every slot present; null = empty. Values are Item.id. */
export type EquipmentLoadout = Record<EquipmentSlotId, string | null>;

/** Sparse overrides when building a character (only equipped slots). */
export type EquipmentLoadoutPatch = Partial<Record<EquipmentSlotId, string | null>>;

export function createEmptyEquipmentLoadout(
  overrides?: EquipmentLoadoutPatch
): EquipmentLoadout {
  const result = {} as EquipmentLoadout;
  for (const slot of EQUIPMENT_SLOTS) {
    result[slot] = overrides?.[slot] !== undefined ? overrides[slot]! : null;
  }
  return result;
}

/** Human-readable slot label for UI. */
export function formatEquipmentSlotLabel(slot: EquipmentSlotId): string {
  const special: Partial<Record<EquipmentSlotId, string>> = {
    undershirt: 'Undershirt',
    underwear: 'Underwear',
    offhand: 'Off-hand',
    mainhand: 'Main-hand',
    ring1: 'Ring 1',
    ring2: 'Ring 2',
    trinket1: 'Trinket 1',
    trinket2: 'Trinket 2',
  };
  if (special[slot]) return special[slot]!;
  return slot.replace(/^./, (c) => c.toUpperCase());
}

export interface CombatBonus {
  chance: {
    parry: number;
    dodge: number;
    block: number;
    hit: number;
    critical: number;
    resist?: Record<string, number>;
  };
  value: {
    block: number;
    damage: number;
    critical: number;
    effectiveMultiplier: number;
    armor?: number;
    resist?: Record<string, number>;
  };
}

export interface LewdBonus {
  bonus: {
    allure: number;
    charisma: number;
    libido: number;
    dominance: number;
  };
  soiled?: {
    blood: number;
    sweat: number;
    semen: number;
    urine: number;
    vaginalDischarge: number;
    arousalFluid: number;
  };
}

export interface ItemFlags {
  starter?: string | string[];
  prf?: string[];
  effective?: Record<string, boolean>;
  indestructible?: boolean;
  unequipped?: boolean;
  twoHandOptional?: boolean;
  healing?: boolean;
  erotic?: boolean;
  visible?: boolean;
  sex?: 'male' | 'female' | 'any';
}

export const EMPTY_COMBAT_BONUS: CombatBonus = {
  chance: { parry: 0, dodge: 0, block: 0, hit: 0, critical: 0 },
  value: { block: 0, damage: 0, critical: 0, effectiveMultiplier: 1 },
};

export const EMPTY_LEWD_BONUS: LewdBonus = {
  bonus: { allure: 0, charisma: 0, libido: 0, dominance: 0 },
};

/**
 * Static blueprint — authored in the catalog, not saved per playthrough.
 */
export interface ItemTemplate {
  templateId: string;
  name: string;
  itemType: ItemType;
  slot: ItemSlot;
  description: string;
  material: MaterialId;

  /** Weapons / some shields */
  weaponType?: WeaponTypeId;

  /**
   * Armor torso reach. Ignored if `coverage` is set explicitly.
   * Caelin breastplate = large (covers stomach).
   */
  sizePreset?: ArmorSizePreset;

  /**
   * Shirt-slot garment hang length (tunic / short dress / long robe / full).
   * Used when `coverage` is omitted. See GARMENT_LENGTH_COVERAGE.
   */
  garmentLength?: GarmentLengthPreset;

  /**
   * Foot-slot rise height (slipper → riding).
   * Used when `coverage` is omitted. See FOOTWEAR_LENGTH_COVERAGE.
   */
  footwearLength?: FootwearLengthPreset;

  /**
   * Head-slot style (full helmet → hair ornament).
   * See HEADWEAR_COVERAGE. Hair ornaments have negligible combat coverage.
   */
  headwearStyle?: HeadwearStyle;

  /**
   * Underwear-slot style (sex-split panties / slip skirts / briefs).
   * See FEMALE_UNDERWEAR_COVERAGE / MALE_UNDERWEAR_COVERAGE.
   */
  underwearStyle?: UnderwearStyle;

  /**
   * Undershirt-slot style (sex-split slips / bras / male undershirt).
   * See FEMALE_UNDERSHIRT_COVERAGE / MALE_UNDERSHIRT_COVERAGE.
   */
  undershirtStyle?: UndershirtStyle;

  /** Explicit hit-location coverage (0–1). Overrides length/size presets when set. */
  coverage?: CoverageMap;

  combatBonus?: CombatBonus;
  lewdBonus?: LewdBonus;
  flags?: ItemFlags;

  /** Fresh instance max durability (fraction scale, typically 1). */
  maxDurability: number;
}

/**
 * Runtime / saveable instance of a template.
 */
export interface Item {
  id: string;
  templateId: string;
  /** Denormalized for UI; always match template unless renamed later */
  name: string;
  itemType: ItemType;
  slot: ItemSlot;
  description: string;
  material: MaterialId;
  weaponType?: WeaponTypeId;

  combatStats: CombatBonus;
  lewdStats: LewdBonus;
  flags: ItemFlags;

  durability: number;
  maxDurability: number;
  ownerId?: string;
  equippedSlot?: ItemSlot | null;
}

export interface EquipmentSlot {
  slot: ItemSlot;
  itemId: string | null;
}

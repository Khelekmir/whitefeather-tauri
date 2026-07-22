export type ItemType = 'weapon' | 'shield' | 'armor' | 'amulet' | 'trinket' | 'ring' | 'consumable' | 'other';

export type ItemSlot =
  | 'mainhand' | 'offhand'
  | 'head' | 'neck' | 'shoulder' | 'back' | 'chest' | 'shirt' | 'undershirt'
  | 'wrist' | 'hand' | 'waist' | 'underwear' | 'leg' | 'shin' | 'foot'
  | 'ring1' | 'ring2' | 'trinket1' | 'trinket2';

export interface CombatBonus {
  chance: {
    parry: number;
    dodge: number;
    block: number;
    hit: number;
    critical: number;
    resist?: Record<string, number>; // e.g. omni, light, dark...
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
  prf?: string[];                    // proficient characters
  effective?: Record<string, boolean>; // e.g. { wyvern: true }
  indestructible?: boolean;
  unequipped?: boolean;
  twoHandOptional?: boolean;
  healing?: boolean;
  erotic?: boolean;
  visible?: boolean;
  sex?: 'male' | 'female' | 'any';
  Stecker?: boolean;
  // Add more as needed
}

export interface Item {
  id: string;                    // Unique runtime ID (UUID)
  templateId: string;            // Links back to CSV-style base item (e.g. "caelin-lance")
  itemType: ItemType;
  name: string;
  slot: ItemSlot;
  description: string;

  combatStats: CombatBonus;
  lewdStats: LewdBonus;
  flags: ItemFlags;
  misc?: Record<string, any>;    // For rare future fields

  // Instance-specific data
  durability: number;
  maxDurability: number;
  ownerId?: string;              // Which character currently holds it
  equippedSlot?: ItemSlot;       // Which slot it's currently in (for quick lookup)
}

export interface EquipmentSlot {
  slot: ItemSlot;
  itemId: string | null;         // null = empty
}
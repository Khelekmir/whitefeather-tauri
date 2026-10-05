/**
 * Attacker weapon-type feel: dodge/parry chance shifts and armor-wear bias.
 * Numbers live in COMBAT_TUNING.weaponTypeFeel.
 */

import { COMBAT_TUNING } from './combatTuning';

export interface WeaponTypeFeelMods {
  /** Added to final dodge chance (0–1), then clamped. */
  dodgeChanceAdd: number;
  /** Added to final parry chance (0–1), then clamped. */
  parryChanceAdd: number;
  /** Multiplier on hard-armor durability loss from this weapon. */
  armorWearMult: number;
  /** Multiplier on soft / outfit durability loss (defaults to armorWearMult). */
  softArmorWearMult: number;
}

const DEFAULTS: WeaponTypeFeelMods = {
  dodgeChanceAdd: 0,
  parryChanceAdd: 0,
  armorWearMult: 1,
  softArmorWearMult: 1,
};

function fromTuningEntry(
  entry: Partial<WeaponTypeFeelMods> | undefined
): WeaponTypeFeelMods {
  if (!entry) return { ...DEFAULTS };
  const armor = entry.armorWearMult ?? 1;
  return {
    dodgeChanceAdd: entry.dodgeChanceAdd ?? 0,
    parryChanceAdd: entry.parryChanceAdd ?? 0,
    armorWearMult: armor,
    softArmorWearMult: entry.softArmorWearMult ?? armor,
  };
}

/** Resolve feel mods for an attacker weapon type id. */
export function getWeaponTypeFeelMods(
  weaponType: string | null | undefined
): WeaponTypeFeelMods {
  const key = weaponType || 'unequipped';
  const table = COMBAT_TUNING.weaponTypeFeel.byWeaponType as Record<
    string,
    Partial<WeaponTypeFeelMods>
  >;
  return fromTuningEntry(table[key] ?? table.unequipped);
}

/**
 * Convert a flat chance add into a QTE band/duration scale.
 * Positive add → easier window; negative → tighter. Floored so taxes never zero the band.
 */
export function weaponFeelQteScale(chanceAdd: number): {
  bandMult: number;
  durationMult: number;
} {
  const tun = COMBAT_TUNING.weaponTypeFeel;
  const bandMult = Math.max(
    tun.qteBandMultFloor,
    1 + chanceAdd * tun.qteBandPerChancePoint
  );
  const durationMult = Math.max(
    tun.qteDurationMultFloor,
    1 + chanceAdd * tun.qteDurationPerChancePoint
  );
  return { bandMult, durationMult };
}

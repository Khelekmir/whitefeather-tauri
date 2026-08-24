import type { WeaponTypeId } from '../../types/characters';

export interface WeaponTypeInfo {
  sizeFactor: number;
  powerMultiplier: number;
  range: number;
  twoHanded: boolean;
  damageType: string;
}

/** Ported from utils_old CombatConfig.weaponTypes (combat weapons only). */
export const WEAPON_TYPES_INFO: Record<string, WeaponTypeInfo> = {
  punch: {
    sizeFactor: 0.5,
    powerMultiplier: 0.6,
    range: 1,
    twoHanded: false,
    damageType: 'melee',
  },
  unequipped: {
    sizeFactor: 0.5,
    powerMultiplier: 0.6,
    range: 1,
    twoHanded: false,
    damageType: 'melee',
  },
  dagger: {
    sizeFactor: 0.5,
    powerMultiplier: 0.6,
    range: 1,
    twoHanded: false,
    damageType: 'piercing',
  },
  throwingKnife: {
    sizeFactor: 0.4,
    powerMultiplier: 0.5,
    range: 1,
    twoHanded: false,
    damageType: 'piercing',
  },
  '1hSword': {
    sizeFactor: 1,
    powerMultiplier: 1,
    range: 1,
    twoHanded: false,
    damageType: 'slashing',
  },
  '2hSword': {
    sizeFactor: 1.7,
    powerMultiplier: 1.9,
    range: 1,
    twoHanded: true,
    damageType: 'slashing',
  },
  '1hAxe': {
    sizeFactor: 1.3,
    powerMultiplier: 1.4,
    range: 1,
    twoHanded: false,
    damageType: 'chopping',
  },
  '2hAxe': {
    sizeFactor: 2.2,
    powerMultiplier: 2.3,
    range: 1,
    twoHanded: true,
    damageType: 'chopping',
  },
  throwingAxe: {
    sizeFactor: 0.8,
    powerMultiplier: 0.9,
    range: 1,
    twoHanded: false,
    damageType: 'chopping',
  },
  shortbow: {
    sizeFactor: 1,
    powerMultiplier: 0.8,
    range: 2,
    twoHanded: true,
    damageType: 'piercing',
  },
  recurveBow: {
    sizeFactor: 1.2,
    powerMultiplier: 1.2,
    range: 2,
    twoHanded: true,
    damageType: 'piercing',
  },
  longbow: {
    sizeFactor: 1.6,
    powerMultiplier: 1.6,
    range: 3,
    twoHanded: true,
    damageType: 'piercing',
  },
  ilianLance: {
    sizeFactor: 1.4,
    powerMultiplier: 1.4,
    range: 1,
    twoHanded: false,
    damageType: 'piercing',
  },
  lance: {
    sizeFactor: 2,
    powerMultiplier: 2,
    range: 1,
    twoHanded: true,
    damageType: 'piercing',
  },
  javelin: {
    sizeFactor: 1,
    powerMultiplier: 1,
    range: 2,
    twoHanded: true,
    damageType: 'piercing',
  },
  '1hMace': {
    sizeFactor: 1.7,
    powerMultiplier: 1.6,
    range: 1,
    twoHanded: false,
    damageType: 'crushing',
  },
  '2hMace': {
    sizeFactor: 2.5,
    powerMultiplier: 2.4,
    range: 1,
    twoHanded: true,
    damageType: 'crushing',
  },
  flail: {
    sizeFactor: 1.5,
    powerMultiplier: 1.7,
    range: 1,
    twoHanded: false,
    damageType: 'crushing',
  },
  staff: {
    sizeFactor: 2,
    powerMultiplier: 2,
    range: 1,
    twoHanded: true,
    damageType: 'crushing',
  },
  shield: {
    sizeFactor: 1.2,
    powerMultiplier: 0.4,
    range: 1,
    twoHanded: false,
    damageType: 'crushing',
  },
};

export function getWeaponTypeInfo(weaponType: string): WeaponTypeInfo {
  return WEAPON_TYPES_INFO[weaponType] ?? WEAPON_TYPES_INFO.punch;
}

export type { WeaponTypeId };

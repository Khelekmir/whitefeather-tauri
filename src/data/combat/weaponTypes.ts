import type { WeaponTypeId } from '../../types/characters';
import type { AttackMode } from '../../utils/combat/damageTypes';

export interface WeaponTypeInfo {
  sizeFactor: number;
  powerMultiplier: number;
  range: number;
  twoHanded: boolean;
  /** Primary delivery flavor — slash / thrust / blunt (aligned with AttackMode). */
  damageType: AttackMode;
}

/** Ported from utils_old CombatConfig.weaponTypes (combat weapons only). */
export const WEAPON_TYPES_INFO: Record<string, WeaponTypeInfo> = {
  punch: {
    sizeFactor: 0.5,
    powerMultiplier: 0.6,
    range: 1,
    twoHanded: false,
    damageType: 'blunt',
  },
  unequipped: {
    sizeFactor: 0.5,
    powerMultiplier: 0.6,
    range: 1,
    twoHanded: false,
    damageType: 'blunt',
  },
  dagger: {
    sizeFactor: 0.5,
    powerMultiplier: 0.6,
    range: 1,
    twoHanded: false,
    damageType: 'thrust',
  },
  throwingKnife: {
    sizeFactor: 0.4,
    powerMultiplier: 0.5,
    range: 1,
    twoHanded: false,
    damageType: 'thrust',
  },
  '1hSword': {
    sizeFactor: 1,
    powerMultiplier: 1,
    range: 1,
    twoHanded: false,
    damageType: 'slash',
  },
  '2hSword': {
    sizeFactor: 1.7,
    powerMultiplier: 1.9,
    range: 1,
    twoHanded: true,
    damageType: 'slash',
  },
  '1hAxe': {
    sizeFactor: 1.3,
    powerMultiplier: 1.4,
    range: 1,
    twoHanded: false,
    damageType: 'slash',
  },
  '2hAxe': {
    sizeFactor: 2.2,
    powerMultiplier: 2.3,
    range: 1,
    twoHanded: true,
    damageType: 'slash',
  },
  throwingAxe: {
    sizeFactor: 0.8,
    powerMultiplier: 0.9,
    range: 1,
    twoHanded: false,
    damageType: 'slash',
  },
  shortbow: {
    sizeFactor: 1,
    powerMultiplier: 0.8,
    range: 2,
    twoHanded: true,
    damageType: 'projectile',
  },
  recurveBow: {
    sizeFactor: 1.2,
    powerMultiplier: 1.2,
    range: 2,
    twoHanded: true,
    damageType: 'projectile',
  },
  longbow: {
    sizeFactor: 1.6,
    powerMultiplier: 1.6,
    range: 3,
    twoHanded: true,
    damageType: 'projectile',
  },
  ilianLance: {
    sizeFactor: 1.4,
    powerMultiplier: 1.4,
    range: 1,
    twoHanded: false,
    damageType: 'thrust',
  },
  lance: {
    sizeFactor: 2,
    powerMultiplier: 2,
    range: 1,
    twoHanded: true,
    damageType: 'thrust',
  },
  javelin: {
    sizeFactor: 1,
    powerMultiplier: 1,
    range: 2,
    twoHanded: true,
    damageType: 'thrust',
  },
  '1hMace': {
    sizeFactor: 1.7,
    powerMultiplier: 1.6,
    range: 1,
    twoHanded: false,
    damageType: 'blunt',
  },
  '2hMace': {
    sizeFactor: 2.5,
    powerMultiplier: 2.4,
    range: 1,
    twoHanded: true,
    damageType: 'blunt',
  },
  flail: {
    sizeFactor: 1.5,
    powerMultiplier: 1.7,
    range: 1,
    twoHanded: false,
    damageType: 'blunt',
  },
  staff: {
    sizeFactor: 2,
    powerMultiplier: 2,
    range: 1,
    twoHanded: true,
    damageType: 'blunt',
  },
  /**
   * Tomes — light held books; power stub until MAG replaces STR in attack math.
   * twoHanded: casting posture (empty offhand), like bows.
   */
  anima: {
    sizeFactor: 0.6,
    powerMultiplier: 1.1,
    range: 2,
    twoHanded: true,
    damageType: 'magical',
  },
  light: {
    sizeFactor: 0.55,
    powerMultiplier: 1.05,
    range: 2,
    twoHanded: true,
    damageType: 'magical',
  },
  dark: {
    sizeFactor: 0.65,
    powerMultiplier: 1.15,
    range: 2,
    twoHanded: true,
    damageType: 'magical',
  },
  /** Staff magic school — casting channel; distinct from blunt melee `staff`. */
  staffMagic: {
    sizeFactor: 0.7,
    powerMultiplier: 1.0,
    range: 1,
    twoHanded: true,
    damageType: 'magical',
  },
  shield: {
    sizeFactor: 1.2,
    powerMultiplier: 0.4,
    range: 1,
    twoHanded: false,
    damageType: 'blunt',
  },
};

export function getWeaponTypeInfo(weaponType: string): WeaponTypeInfo {
  return WEAPON_TYPES_INFO[weaponType] ?? WEAPON_TYPES_INFO.punch;
}

export type { WeaponTypeId };

import type { WeaponTypeId } from '../../types/characters';

/**
 * Weapon families for rhythm-competence transfer floors.
 * A swordsman picking up a dagger gets a partial floor from lightBlades;
 * specialization (specific rank) still dominates when higher.
 */
export const WEAPON_FAMILY_IDS = [
  'lightBlades',
  'greatBlades',
  'axes',
  'blunt',
  'polearms',
  'bows',
  'shield',
  'unarmed',
] as const;

export type WeaponFamilyId = (typeof WEAPON_FAMILY_IDS)[number];

export const WEAPON_FAMILIES: Record<WeaponFamilyId, readonly WeaponTypeId[]> = {
  lightBlades: ['dagger', 'throwingKnife', '1hSword'],
  greatBlades: ['2hSword'],
  axes: ['1hAxe', '2hAxe', 'throwingAxe'],
  blunt: ['1hMace', '2hMace', 'flail', 'staff'],
  polearms: ['lance', 'javelin', 'ilianLance'],
  bows: ['shortbow', 'longbow', 'recurveBow'],
  shield: ['shield'],
  unarmed: ['unequipped'],
};

const WEAPON_TO_FAMILY: Record<string, WeaponFamilyId> = (() => {
  const map: Record<string, WeaponFamilyId> = {};
  for (const familyId of WEAPON_FAMILY_IDS) {
    for (const weapon of WEAPON_FAMILIES[familyId]) {
      map[weapon] = familyId;
    }
  }
  return map;
})();

export function getWeaponFamily(weaponType: string): WeaponFamilyId {
  return WEAPON_TO_FAMILY[weaponType] ?? 'unarmed';
}

export function getWeaponsInFamily(weaponType: string): readonly WeaponTypeId[] {
  return WEAPON_FAMILIES[getWeaponFamily(weaponType)];
}

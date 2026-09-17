/**
 * Port of utils_old CombatConfig.shieldTypes.
 * sizeFactor → weight / wear; blockMultiplier → absorb strength.
 */
export type ShieldTypeId =
  | 'buckler'
  | 'targe'
  | 'heater'
  | 'kite'
  | 'round'
  | 'tower';

export interface ShieldTypeInfo {
  sizeFactor: number;
  blockMultiplier: number;
  description: string;
}

export const SHIELD_TYPES: Record<ShieldTypeId, ShieldTypeInfo> = {
  buckler: {
    sizeFactor: 0.5,
    blockMultiplier: 0.4,
    description:
      'Small fist shield — more parry aid than full-body cover.',
  },
  targe: {
    sizeFactor: 1,
    blockMultiplier: 0.9,
    description: 'Small round arm-strapped shield; mobile cover.',
  },
  heater: {
    sizeFactor: 1.3,
    blockMultiplier: 1.2,
    description: 'Classic knight shield — balance of cover and agility.',
  },
  kite: {
    sizeFactor: 1.6,
    blockMultiplier: 1.5,
    description: 'Long tapering shield; strong vertical cover.',
  },
  round: {
    sizeFactor: 1.8,
    blockMultiplier: 1.7,
    description: 'Broad circular shield with good coverage.',
  },
  tower: {
    sizeFactor: 2.6,
    blockMultiplier: 2.3,
    description: 'Massive pavise-style cover; heavy and cumbersome.',
  },
};

export function getShieldTypeInfo(
  id: string | undefined | null
): ShieldTypeInfo {
  if (id && id in SHIELD_TYPES) {
    return SHIELD_TYPES[id as ShieldTypeId];
  }
  return SHIELD_TYPES.heater;
}

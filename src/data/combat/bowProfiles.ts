/**
 * Bow draw / reach profiles — lab bands 1–5, meters under the hood.
 * Effective reach = maxRangeBand × drawFrac(STR / optimalDrawStr).
 */

export interface BowProfile {
  weaponType: string;
  /** Rated draw weight (lbs-equivalent abstract). */
  drawWeightRated: number;
  /** STR needed for a full, stable draw. */
  optimalDrawStr: number;
  /** Max engagement band at full draw (1–5). */
  maxRangeBand: number;
}

export const BOW_PROFILES: Record<string, BowProfile> = {
  shortbow: {
    weaponType: 'shortbow',
    drawWeightRated: 45,
    optimalDrawStr: 9,
    maxRangeBand: 3,
  },
  recurveBow: {
    weaponType: 'recurveBow',
    drawWeightRated: 55,
    optimalDrawStr: 11,
    maxRangeBand: 4,
  },
  longbow: {
    weaponType: 'longbow',
    drawWeightRated: 70,
    optimalDrawStr: 14,
    maxRangeBand: 5,
  },
};

export function getBowProfile(weaponType: string): BowProfile | null {
  return BOW_PROFILES[weaponType] ?? null;
}

export function isBowWeaponType(weaponType: string): boolean {
  return weaponType in BOW_PROFILES;
}

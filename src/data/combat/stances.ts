import type {
  BodyPartId,
  CoverStanceId,
  StrikeStanceId,
} from '../../types/characters';

/** High / mid / low line shared by cover and strike. */
export type StanceLine = 'high' | 'mid' | 'low';

export type StanceRelation = 'same' | 'adjacent' | 'opposite';

export const COVER_LINE: Record<CoverStanceId, StanceLine> = {
  coverHigh: 'high',
  coverMid: 'mid',
  coverLow: 'low',
};

export const STRIKE_LINE: Record<StrikeStanceId, StanceLine> = {
  strikeHigh: 'high',
  strikeMid: 'mid',
  strikeLow: 'low',
};

export type StanceRegion = 'high' | 'mid' | 'low' | 'arms';

/**
 * Which region a body part belongs to for cover remapping.
 * High-guard tucks the skull/shoulders and presents the arms as extra targets.
 */
export const BODY_PART_REGION: Record<BodyPartId, StanceRegion> = {
  head: 'high',
  face: 'high',
  eyeLeft: 'high',
  eyeRight: 'high',
  earLeft: 'high',
  earRight: 'high',
  neck: 'high',
  shoulderLeft: 'high',
  shoulderRight: 'high',
  chestLeft: 'mid',
  chestRight: 'mid',
  obliqueLeft: 'mid',
  obliqueRight: 'mid',
  stomachUpper: 'mid',
  stomachLower: 'mid',
  groin: 'low',
  anus: 'low',
  hipLeft: 'low',
  hipRight: 'low',
  buttockLeft: 'low',
  buttockRight: 'low',
  thighInnerLeft: 'low',
  thighInnerRight: 'low',
  thighOuterLeft: 'low',
  thighOuterRight: 'low',
  kneeLeft: 'low',
  kneeRight: 'low',
  lowerLegLeft: 'low',
  lowerLegRight: 'low',
  footLeft: 'low',
  footRight: 'low',
  upperArmLeft: 'arms',
  upperArmRight: 'arms',
  lowerArmLeft: 'arms',
  lowerArmRight: 'arms',
  handLeft: 'arms',
  handRight: 'arms',
};

export interface CoverRegionWeights {
  high: number;
  mid: number;
  low: number;
  arms: number;
}

/**
 * Multipliers applied to an aim zone's hitRatio, then renormalized.
 * < 1 = tucked / harder to present; > 1 = exposed / more often presented.
 */
export const COVER_REGION_WEIGHTS: Record<CoverStanceId, CoverRegionWeights> = {
  coverHigh: { high: 0.35, mid: 1.15, low: 1.35, arms: 1.5 },
  coverMid: { high: 1.15, mid: 0.45, low: 1.15, arms: 1.1 },
  coverLow: { high: 1.35, mid: 1.1, low: 0.35, arms: 0.9 },
};

export interface WeaponStanceProfile {
  preferredStrike: StrikeStanceId;
  /** Ranged: same-line penalty is weaker; opposite-line bonus a bit stronger. */
  ranged: boolean;
}

export const WEAPON_STANCE_PROFILE: Record<string, WeaponStanceProfile> = {
  punch: { preferredStrike: 'strikeMid', ranged: false },
  unequipped: { preferredStrike: 'strikeMid', ranged: false },
  kick: { preferredStrike: 'strikeMid', ranged: false },
  strike: { preferredStrike: 'strikeMid', ranged: false },
  scratch: { preferredStrike: 'strikeHigh', ranged: false },
  slap: { preferredStrike: 'strikeHigh', ranged: false },
  dagger: { preferredStrike: 'strikeLow', ranged: false },
  throwingKnife: { preferredStrike: 'strikeLow', ranged: true },
  '1hSword': { preferredStrike: 'strikeMid', ranged: false },
  '2hSword': { preferredStrike: 'strikeMid', ranged: false },
  '1hAxe': { preferredStrike: 'strikeHigh', ranged: false },
  '2hAxe': { preferredStrike: 'strikeHigh', ranged: false },
  throwingAxe: { preferredStrike: 'strikeHigh', ranged: true },
  shortbow: { preferredStrike: 'strikeMid', ranged: true },
  recurveBow: { preferredStrike: 'strikeMid', ranged: true },
  longbow: { preferredStrike: 'strikeMid', ranged: true },
  ilianLance: { preferredStrike: 'strikeMid', ranged: false },
  lance: { preferredStrike: 'strikeMid', ranged: false },
  javelin: { preferredStrike: 'strikeMid', ranged: true },
  '1hMace': { preferredStrike: 'strikeHigh', ranged: false },
  '2hMace': { preferredStrike: 'strikeHigh', ranged: false },
  flail: { preferredStrike: 'strikeHigh', ranged: false },
  staff: { preferredStrike: 'strikeMid', ranged: false },
  shield: { preferredStrike: 'strikeMid', ranged: false },
};

export function getWeaponStanceProfile(weaponType: string): WeaponStanceProfile {
  return (
    WEAPON_STANCE_PROFILE[weaponType] ?? {
      preferredStrike: 'strikeMid',
      ranged: false,
    }
  );
}

export function stanceLineOfCover(cover: CoverStanceId): StanceLine {
  return COVER_LINE[cover];
}

export function stanceLineOfStrike(strike: StrikeStanceId): StanceLine {
  return STRIKE_LINE[strike];
}

export function stanceRelation(
  strike: StrikeStanceId,
  cover: CoverStanceId
): StanceRelation {
  const s = STRIKE_LINE[strike];
  const c = COVER_LINE[cover];
  if (s === c) return 'same';
  if (s === 'mid' || c === 'mid') return 'adjacent';
  return 'opposite';
}

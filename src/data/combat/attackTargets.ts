import type { BodyPartId } from '../../types/characters';

export type AttackTargetKey =
  | 'head'
  | 'chest'
  | 'stomach'
  | 'armLeft'
  | 'armRight'
  | 'groin'
  | 'legLeft'
  | 'legRight';

export interface AttackTarget {
  /** Ignored when assuming 100% hit — kept for later attack-rhythm work. */
  avoidanceRating: number;
  hitRatio: Partial<Record<BodyPartId, number>>;
}

/** Ported from utils_old CombatConfig.attackTargets */
export const ATTACK_TARGETS: Record<AttackTargetKey, AttackTarget> = {
  head: {
    avoidanceRating: 0.4,
    hitRatio: {
      head: 0.15,
      neck: 0.075,
      face: 0.075,
      earLeft: 0.05,
      earRight: 0.05,
      eyeLeft: 0.05,
      eyeRight: 0.05,
      upperArmLeft: 0.05,
      upperArmRight: 0.05,
      lowerArmLeft: 0.1,
      lowerArmRight: 0.1,
      handLeft: 0.1,
      handRight: 0.1,
    },
  },
  chest: {
    avoidanceRating: 0.1,
    hitRatio: {
      shoulderLeft: 0.125,
      shoulderRight: 0.125,
      chestLeft: 0.125,
      chestRight: 0.125,
      upperArmLeft: 0.1,
      upperArmRight: 0.1,
      lowerArmLeft: 0.1,
      lowerArmRight: 0.1,
      handLeft: 0.05,
      handRight: 0.05,
    },
  },
  stomach: {
    avoidanceRating: 0.1,
    hitRatio: {
      obliqueLeft: 0.125,
      obliqueRight: 0.125,
      stomachUpper: 0.125,
      stomachLower: 0.125,
      upperArmLeft: 0.1,
      upperArmRight: 0.1,
      lowerArmLeft: 0.1,
      lowerArmRight: 0.1,
      handLeft: 0.05,
      handRight: 0.05,
    },
  },
  armRight: {
    avoidanceRating: 0.3,
    hitRatio: {
      shoulderRight: 0.2,
      upperArmRight: 0.3,
      lowerArmRight: 0.3,
      handRight: 0.2,
    },
  },
  armLeft: {
    avoidanceRating: 0.3,
    hitRatio: {
      shoulderLeft: 0.2,
      upperArmLeft: 0.3,
      lowerArmLeft: 0.3,
      handLeft: 0.2,
    },
  },
  groin: {
    avoidanceRating: 0.2,
    hitRatio: {
      groin: 0.1,
      thighInnerRight: 0.1,
      thighInnerLeft: 0.1,
      buttockLeft: 0.15,
      buttockRight: 0.15,
      hipLeft: 0.2,
      hipRight: 0.2,
    },
  },
  legRight: {
    avoidanceRating: 0.2,
    hitRatio: {
      thighInnerRight: 0.15,
      thighOuterRight: 0.25,
      kneeRight: 0.2,
      lowerLegRight: 0.2,
      footRight: 0.2,
    },
  },
  legLeft: {
    avoidanceRating: 0.2,
    hitRatio: {
      thighInnerLeft: 0.15,
      thighOuterLeft: 0.25,
      kneeLeft: 0.2,
      lowerLegLeft: 0.2,
      footLeft: 0.2,
    },
  },
};

/**
 * Pick a body part from an attack aim zone.
 * Does NOT apply avoidanceRating miss — Battleground assumes 100% hit for now.
 */
export function pickBodyPartFromTarget(targetKey: AttackTargetKey): BodyPartId {
  const target = ATTACK_TARGETS[targetKey];
  const entries = Object.entries(target.hitRatio) as [BodyPartId, number][];
  const roll = Math.random();
  let cumulative = 0;
  for (const [zone, ratio] of entries) {
    cumulative += ratio;
    if (roll < cumulative) return zone;
  }
  return entries[entries.length - 1]?.[0] ?? 'chestLeft';
}

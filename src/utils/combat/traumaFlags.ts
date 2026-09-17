import {
  BODY_PARTS,
  type BodyPartHealth,
  type BodyPartId,
  type ItemizedHealth,
} from '../../types/characters';
import { COMBAT_TUNING } from './combatTuning';
import { roundToThousandths } from './penalties';

export type TraumaLevel = 'none' | 'sprain' | 'fracture' | 'broken';

const T = () => COMBAT_TUNING.traumaFlags;

/** Lower body — mobility / dodge. */
export const TRAUMA_LOWER_BODY: { part: BodyPartId; weight: number }[] = [
  { part: 'footLeft', weight: 1.2 },
  { part: 'footRight', weight: 1.2 },
  { part: 'kneeLeft', weight: 1 },
  { part: 'kneeRight', weight: 1 },
  { part: 'lowerLegLeft', weight: 0.9 },
  { part: 'lowerLegRight', weight: 0.9 },
  { part: 'thighOuterLeft', weight: 0.8 },
  { part: 'thighOuterRight', weight: 0.8 },
  { part: 'thighInnerLeft', weight: 0.7 },
  { part: 'thighInnerRight', weight: 0.7 },
  { part: 'hipLeft', weight: 0.6 },
  { part: 'hipRight', weight: 0.6 },
  { part: 'buttockLeft', weight: 0.35 },
  { part: 'buttockRight', weight: 0.35 },
];

/** Arms — attack / parry / block (L/R equal v1). */
export const TRAUMA_ARMS: { part: BodyPartId; weight: number }[] = [
  { part: 'shoulderLeft', weight: 0.85 },
  { part: 'shoulderRight', weight: 0.85 },
  { part: 'upperArmLeft', weight: 1 },
  { part: 'upperArmRight', weight: 1 },
  { part: 'lowerArmLeft', weight: 1 },
  { part: 'lowerArmRight', weight: 1 },
  { part: 'handLeft', weight: 1.1 },
  { part: 'handRight', weight: 1.1 },
];

/** Chest breathing — only `broken` triggers stamina/global. */
export const TRAUMA_CHEST: BodyPartId[] = [
  'chestLeft',
  'chestRight',
  'obliqueLeft',
  'obliqueRight',
];

export function highestTrauma(state: BodyPartHealth | undefined): TraumaLevel {
  if (!state) return 'none';
  if (state.broken) return 'broken';
  if (state.fracture) return 'fracture';
  if (state.sprain) return 'sprain';
  return 'none';
}

export function traumaSeverityPoints(level: TraumaLevel): number {
  if (level === 'none') return 0;
  return T().severity[level];
}

function regionPoints(
  itemized: ItemizedHealth,
  parts: { part: BodyPartId; weight: number }[]
): number {
  let points = 0;
  for (const { part, weight } of parts) {
    const sev = traumaSeverityPoints(highestTrauma(itemized[part]));
    if (sev > 0) points += weight * sev;
  }
  return points;
}

function factorFromPoints(
  points: number,
  perPoint: number,
  floor: number
): number {
  return roundToThousandths(Math.max(floor, 1 - points * perPoint));
}

export interface TraumaPenalties {
  mobilityMult: number;
  dodgeMult: number;
  attackMult: number;
  parryMult: number;
  blockMult: number;
  staminaDrainMult: number;
  globalCombatMult: number;
  lowerPoints: number;
  armPoints: number;
  chestBroken: boolean;
  /** Parts with any trauma flag (for UI). */
  flagged: { part: BodyPartId; level: TraumaLevel }[];
}

export function calcTraumaPenalties(
  itemized: ItemizedHealth
): TraumaPenalties {
  const lowerPoints = regionPoints(itemized, TRAUMA_LOWER_BODY);
  const armPoints = regionPoints(itemized, TRAUMA_ARMS);
  const chestBroken = TRAUMA_CHEST.some(
    (p) => highestTrauma(itemized[p]) === 'broken'
  );

  const lb = T().lowerBody;
  const arms = T().arms;
  const chest = T().chestBroken;

  const mobilityMult = factorFromPoints(
    lowerPoints,
    lb.mobilityPerPoint,
    lb.floor
  );
  const dodgeMult = factorFromPoints(lowerPoints, lb.dodgePerPoint, lb.floor);
  const attackMult = factorFromPoints(armPoints, arms.attackPerPoint, arms.floor);
  const parryMult = factorFromPoints(armPoints, arms.parryPerPoint, arms.floor);
  const blockMult = factorFromPoints(armPoints, arms.blockPerPoint, arms.floor);

  const flagged: TraumaPenalties['flagged'] = [];
  for (const part of BODY_PARTS) {
    const level = highestTrauma(itemized[part]);
    if (level !== 'none') flagged.push({ part, level });
  }

  return {
    mobilityMult,
    dodgeMult,
    attackMult,
    parryMult,
    blockMult,
    staminaDrainMult: chestBroken ? chest.staminaDrainMult : 1,
    globalCombatMult: chestBroken ? chest.globalCombatMult : 1,
    lowerPoints: roundToThousandths(lowerPoints),
    armPoints: roundToThousandths(armPoints),
    chestBroken,
    flagged,
  };
}

/** Lab / narrative: set one trauma level (clears lower/higher on that part). */
export function setTraumaFlag(
  itemized: ItemizedHealth,
  part: BodyPartId,
  level: TraumaLevel
): void {
  const s = itemized[part];
  if (!s) return;
  s.sprain = level === 'sprain';
  s.fracture = level === 'fracture';
  s.broken = level === 'broken';
}

export function clearTraumaFlag(
  itemized: ItemizedHealth,
  part: BodyPartId
): void {
  setTraumaFlag(itemized, part, 'none');
}

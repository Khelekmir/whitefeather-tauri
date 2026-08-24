import type { BodyPartId } from '../../types/characters';

/** Ported from utils_old bodypartAttributes.size */
export const BODYPART_SIZES: Record<BodyPartId, number> = {
  head: 1,
  face: 1,
  eyeLeft: 0.5,
  eyeRight: 0.5,
  earLeft: 0.5,
  earRight: 0.5,
  neck: 1,
  shoulderLeft: 2,
  shoulderRight: 2,
  upperArmLeft: 2,
  upperArmRight: 2,
  lowerArmLeft: 2,
  lowerArmRight: 2,
  handLeft: 1.5,
  handRight: 1.5,
  chestLeft: 3,
  chestRight: 3,
  obliqueLeft: 2.5,
  obliqueRight: 2.5,
  stomachUpper: 3,
  stomachLower: 3,
  hipLeft: 2.5,
  hipRight: 2.5,
  groin: 0.5,
  anus: 0.3,
  buttockLeft: 2.5,
  buttockRight: 2.5,
  thighInnerLeft: 2,
  thighInnerRight: 2,
  thighOuterLeft: 2.5,
  thighOuterRight: 2.5,
  kneeLeft: 1.5,
  kneeRight: 1.5,
  lowerLegLeft: 2.5,
  lowerLegRight: 2.5,
  footLeft: 1.5,
  footRight: 1.5,
};

export function getBodypartSize(part: BodyPartId): number {
  return BODYPART_SIZES[part] ?? 1;
}

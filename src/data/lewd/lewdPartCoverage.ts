import type { BodyPartId } from '../../types/characters';

/**
 * Map lewd catalog targetPart ids → combat BodyPartId(s) for clothing coverage.
 * Barrier queries use the max effective coverage across returned parts.
 */
const LEWD_TARGET_TO_BODY: Record<string, BodyPartId[]> = {
  // Head / face — usually bare
  head: ['head'],
  ear: ['earLeft', 'earRight'],
  forehead: ['face'],
  nose: ['face'],
  cheeks: ['face'],
  lips: ['face'],
  teeth: ['face'],
  tongue: ['face'],
  mouthShallow: ['face'],
  mouthDeep: ['face'],
  mouthThroat: ['face'],
  chin: ['face'],

  neckNape: ['neck'],
  neckSide: ['neck'],
  throat: ['neck'],
  clavicle: ['chestLeft', 'chestRight'],

  breast: ['chestLeft', 'chestRight'],
  areola: ['chestLeft', 'chestRight'],
  nipple: ['chestLeft', 'chestRight'],
  sternum: ['chestLeft', 'chestRight'],

  shoulder: ['shoulderLeft', 'shoulderRight'],
  armPit: ['upperArmLeft', 'upperArmRight'],
  armUpper: ['upperArmLeft', 'upperArmRight'],
  armLower: ['lowerArmLeft', 'lowerArmRight'],
  wrist: ['handLeft', 'handRight'],
  handBack: ['handLeft', 'handRight'],
  handPalm: ['handLeft', 'handRight'],
  handFinger: ['handLeft', 'handRight'],

  bellyUpper: ['stomachUpper'],
  bellyButton: ['stomachUpper'],
  bellyLower: ['stomachLower'],
  backUpper: ['chestLeft', 'chestRight'],
  backLower: ['stomachLower'],
  oblique: ['obliqueLeft', 'obliqueRight'],
  iliacRegion: ['hipLeft', 'hipRight'],

  monsVenus: ['groin'],
  labiaMajora: ['groin'],
  labiaMinora: ['groin'],
  clitoris: ['groin'],
  urethra: ['groin'],
  vaginaShallow: ['groin'],
  vaginaDeep: ['groin'],
  perinium: ['groin'],
  penisHead: ['groin'],
  penisHeadUnderside: ['groin'],
  penisShaft: ['groin'],
  penisShaftUnderside: ['groin'],
  testicles: ['groin'],

  buttockMain: ['buttockLeft', 'buttockRight'],
  buttockUnderside: ['buttockLeft', 'buttockRight'],
  anus: ['anus'],
  rectumShallow: ['anus'],
  rectumDeep: ['anus'],

  hip: ['hipLeft', 'hipRight'],
  thighInner: ['thighInnerLeft', 'thighInnerRight'],
  thighBack: ['thighOuterLeft', 'thighOuterRight'],
  thighFront: ['thighOuterLeft', 'thighOuterRight'],
  kneeFront: ['kneeLeft', 'kneeRight'],
  kneeBack: ['kneeLeft', 'kneeRight'],
  calf: ['lowerLegLeft', 'lowerLegRight'],
  ankle: ['footLeft', 'footRight'],
  footTop: ['footLeft', 'footRight'],
  footBottom: ['footLeft', 'footRight'],
  footToe: ['footLeft', 'footRight'],
};

export function lewdTargetToBodyParts(targetPart: string): BodyPartId[] {
  return LEWD_TARGET_TO_BODY[targetPart] ?? [];
}

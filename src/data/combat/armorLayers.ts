import type { BodyPartId } from '../../types/characters';
import type { ItemSlot } from '../../types/items';

/**
 * Hit location → equipment slots that may protect it, outer → inner.
 *
 * Includes shirt / undershirt / underwear / foot so dresses, slips, slip skirts,
 * and riding boots can apply when their coverage presets include the part.
 */
export const ARMOR_LAYERS: Record<BodyPartId, ItemSlot[]> = {
  head: ['head'],
  face: ['head'],
  eyeLeft: ['head'],
  eyeRight: ['head'],
  earLeft: ['head'],
  earRight: ['head'],
  neck: ['shoulder', 'head'],
  shoulderLeft: ['shoulder'],
  shoulderRight: ['shoulder'],
  upperArmLeft: ['shoulder'],
  upperArmRight: ['shoulder'],
  lowerArmLeft: ['wrist', 'hand'],
  lowerArmRight: ['wrist', 'hand'],
  handLeft: ['hand'],
  handRight: ['hand'],
  chestLeft: ['chest', 'shirt', 'undershirt'],
  chestRight: ['chest', 'shirt', 'undershirt'],
  obliqueLeft: ['chest', 'shirt', 'undershirt'],
  obliqueRight: ['chest', 'shirt', 'undershirt'],
  stomachUpper: ['chest', 'shirt', 'undershirt'],
  stomachLower: ['waist', 'chest', 'shirt', 'undershirt'],
  hipLeft: ['waist', 'leg', 'shirt', 'undershirt', 'underwear'],
  hipRight: ['waist', 'leg', 'shirt', 'undershirt', 'underwear'],
  groin: ['leg', 'shirt', 'undershirt', 'underwear'],
  anus: ['leg', 'shirt', 'undershirt', 'underwear'],
  buttockLeft: ['leg', 'shirt', 'undershirt', 'underwear'],
  buttockRight: ['leg', 'shirt', 'undershirt', 'underwear'],
  thighInnerLeft: ['leg', 'shirt', 'undershirt', 'underwear', 'foot'],
  thighInnerRight: ['leg', 'shirt', 'undershirt', 'underwear', 'foot'],
  thighOuterLeft: ['leg', 'shirt', 'undershirt', 'underwear', 'foot'],
  thighOuterRight: ['leg', 'shirt', 'undershirt', 'underwear', 'foot'],
  kneeLeft: ['shin', 'leg', 'shirt', 'undershirt', 'underwear', 'foot'],
  kneeRight: ['shin', 'leg', 'shirt', 'undershirt', 'underwear', 'foot'],
  lowerLegLeft: ['shin', 'foot', 'leg', 'shirt', 'undershirt', 'underwear'],
  lowerLegRight: ['shin', 'foot', 'leg', 'shirt', 'undershirt', 'underwear'],
  footLeft: ['foot', 'leg', 'shirt', 'undershirt', 'underwear'],
  footRight: ['foot', 'leg', 'shirt', 'undershirt', 'underwear'],
};

export function getArmorLayersForPart(part: BodyPartId): ItemSlot[] {
  return ARMOR_LAYERS[part] ?? [];
}

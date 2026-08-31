import {
  genderSpecificParts,
  lewdActionList,
  lewdActionParts,
  lewdBits,
  type LewdActionDef,
  type LewdBit,
  type LewdSexKey,
} from '../../data/lewd/lewdCatalog';
import type { Sex } from '../../types/characters';

export function toLewdSexKey(sex: Sex): LewdSexKey {
  return sex === 'M' ? 'male' : 'female';
}

export function getLewdBit(sex: Sex, partId: string): LewdBit | null {
  const table = lewdBits[toLewdSexKey(sex)] as Record<string, LewdBit>;
  return table[partId] ?? null;
}

export function listBodyPartsForSex(sex: Sex): string[] {
  return Object.keys(lewdBits[toLewdSexKey(sex)]);
}

export function getLewdAction(actionId: string): LewdActionDef | null {
  return (lewdActionList as Record<string, LewdActionDef>)[actionId] ?? null;
}

/** Actor parts that have at least one action for this sex. */
export function listActorParts(sex: Sex): string[] {
  const uni = Object.keys(lewdActionParts.unisex);
  const gendered =
    sex === 'F'
      ? Object.keys(lewdActionParts.female)
      : Object.keys(lewdActionParts.male);
  return [...uni, ...gendered];
}

export function actionsForActorPart(sex: Sex, actorPart: string): string[] {
  const uni = (lewdActionParts.unisex as Record<string, string[]>)[actorPart];
  if (uni) return [...uni];
  if (sex === 'F') {
    return [...((lewdActionParts.female as Record<string, string[]>)[actorPart] ?? [])];
  }
  return [...((lewdActionParts.male as Record<string, string[]>)[actorPart] ?? [])];
}

export function validTargetsForAction(actionId: string, recipientSex: Sex): string[] {
  const action = getLewdAction(actionId);
  if (!action) return [];
  const parts = new Set(listBodyPartsForSex(recipientSex));
  const banned =
    recipientSex === 'F'
      ? new Set(genderSpecificParts.male)
      : new Set(genderSpecificParts.female);
  return action.targets.filter((t) => parts.has(t) && !banned.has(t));
}

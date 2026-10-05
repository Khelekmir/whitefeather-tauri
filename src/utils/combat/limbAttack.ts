import type {
  BodyPartId,
  DominantHand,
  ItemizedHealth,
  Unit as DetailedUnit,
} from '../../types/characters';
import type { Item } from '../../types/items';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import { getWeaponTypeInfo } from '../../data/combat/weaponTypes';
import { calcItemWeight } from '../items/resolveItem';
import { COMBAT_TUNING } from './combatTuning';
import { roundToThousandths } from './penalties';

function itemIsBrokenWeapon(item: Item | null | undefined): boolean {
  if (!item || item.itemType !== 'weapon') return false;
  const max = Math.max(0.001, item.maxDurability);
  const ratio = Math.max(0, item.durability / max);
  return ratio <= COMBAT_TUNING.weaponDurabilityAttack.brokenRatio;
}

const L = () => COMBAT_TUNING.limbAttack;

export type ArmSide = 'left' | 'right';
export type AttackWeaponSlot = 'mainhand' | 'offhand';

export type LimbAttackMode = 'oneHand' | 'twoHand' | 'oneHandFallback';

const ARM_PARTS: Record<ArmSide, readonly BodyPartId[]> = {
  left: ['shoulderLeft', 'upperArmLeft', 'lowerArmLeft', 'handLeft'],
  right: ['shoulderRight', 'upperArmRight', 'lowerArmRight', 'handRight'],
};

export function armPartsForSide(side: ArmSide): readonly BodyPartId[] {
  return ARM_PARTS[side];
}

export function dominantArmSide(hand: DominantHand | null | undefined): ArmSide {
  return hand === 'left' ? 'left' : 'right';
}

export function offArmSide(hand: DominantHand | null | undefined): ArmSide {
  return dominantArmSide(hand) === 'right' ? 'left' : 'right';
}

/** Which arm chain a weapon slot uses given handedness. */
export function armSideForWeaponSlot(
  slot: AttackWeaponSlot,
  dominantHand: DominantHand | null | undefined
): ArmSide {
  return slot === 'mainhand'
    ? dominantArmSide(dominantHand)
    : offArmSide(dominantHand);
}

function partHealth(itemized: ItemizedHealth, part: BodyPartId): number {
  return Math.max(0, Math.min(1, itemized[part]?.health ?? 1));
}

/**
 * Integrity of one arm chain (shoulder → hand).
 * Geometric mean of health^exp so mild multi-part chips accumulate gently;
 * any part at/under ruinedPartCutoff crushes the side toward useless.
 */
export function calcArmSideIntegrity(
  itemized: ItemizedHealth,
  side: ArmSide
): number {
  const parts = ARM_PARTS[side];
  const exp = L().partHealthExp;
  const healths = parts.map((p) => partHealth(itemized, p));
  const minH = Math.min(...healths);
  if (minH <= L().ruinedPartCutoff) return 0;

  let logSum = 0;
  for (const h of healths) {
    const powered = Math.pow(Math.max(1e-6, h), exp);
    logSum += Math.log(powered);
  }
  const geo = Math.exp(logSum / healths.length);

  // Crush when the worst part is in the "significant injury" band.
  const crushSpan = Math.max(
    1e-6,
    L().significantPartHealth - L().ruinedPartCutoff
  );
  const crush = Math.max(
    0,
    Math.min(1, (minH - L().ruinedPartCutoff) / crushSpan)
  );

  return roundToThousandths(
    Math.max(L().limbMultFloor, Math.min(1, geo * crush))
  );
}

/**
 * Offhand slot skill factor: base offhandSkillMult … 1 as offhandTraining → 1.
 */
export function calcOffhandSkillFactor(offhandTraining = 0): number {
  const base = L().offhandSkillMult;
  const t = Math.max(0, Math.min(1, offhandTraining));
  return roundToThousandths(base + (1 - base) * t);
}

export interface LimbAttackMultInput {
  itemized: ItemizedHealth;
  dominantHand: DominantHand;
  /** Slot holding the attacking weapon. */
  attackSlot: AttackWeaponSlot;
  /** True when this swing/draw is a two-hand grip (empty offhand + 2h / optional). */
  twoHandGrip: boolean;
  weaponWeight: number;
  strength: number;
  constitution: number;
}

export interface LimbAttackMultResult {
  mult: number;
  mode: LimbAttackMode;
  /** Primary side for one-hand; for two-hand the worse side. */
  side: ArmSide;
  leftIntegrity: number;
  rightIntegrity: number;
  oneHandFeasible: boolean;
  offhandSkillFactor: number;
}

/**
 * Attack-power multiplier from weapon-arm health (+ optional one-hand 2h fallback).
 */
export function calcLimbAttackMult(
  input: LimbAttackMultInput
): LimbAttackMultResult {
  const leftIntegrity = calcArmSideIntegrity(input.itemized, 'left');
  const rightIntegrity = calcArmSideIntegrity(input.itemized, 'right');
  const offhandSkillFactor = 1; // filled by caller context when slot is offhand

  if (!input.twoHandGrip) {
    const side = armSideForWeaponSlot(input.attackSlot, input.dominantHand);
    const integrity = side === 'left' ? leftIntegrity : rightIntegrity;
    return {
      mult: integrity,
      mode: 'oneHand',
      side,
      leftIntegrity,
      rightIntegrity,
      oneHandFeasible: false,
      offhandSkillFactor,
    };
  }

  // Two-hand: worse arm dominates.
  const worse = Math.min(leftIntegrity, rightIntegrity);
  const better = Math.max(leftIntegrity, rightIntegrity);
  const betterSide: ArmSide =
    leftIntegrity >= rightIntegrity ? 'left' : 'right';

  if (worse > L().oneHandFallbackBelow) {
    return {
      mult: worse,
      mode: 'twoHand',
      side: leftIntegrity <= rightIntegrity ? 'left' : 'right',
      leftIntegrity,
      rightIntegrity,
      oneHandFeasible: false,
      offhandSkillFactor,
    };
  }

  // One-hand fallback: healthy arm + STR/CON vs weight.
  const capacity =
    Math.max(1, input.strength) + 0.35 * Math.max(0, input.constitution);
  const need = Math.max(0.1, input.weaponWeight) * L().oneHandBurdenFactor;
  const feasible = capacity >= need;
  const feasibility =
    need <= 0
      ? 1
      : Math.max(
          L().oneHandFeasibilityFloor,
          Math.min(1, capacity / need)
        );

  if (!feasible || better <= L().ruinedPartCutoff) {
    return {
      mult: worse,
      mode: 'twoHand',
      side: leftIntegrity <= rightIntegrity ? 'left' : 'right',
      leftIntegrity,
      rightIntegrity,
      oneHandFeasible: false,
      offhandSkillFactor,
    };
  }

  const mult = roundToThousandths(
    Math.max(
      L().limbMultFloor,
      Math.min(1, better * L().oneHandPowerMult * feasibility)
    )
  );

  return {
    mult,
    mode: 'oneHandFallback',
    side: betterSide,
    leftIntegrity,
    rightIntegrity,
    oneHandFeasible: true,
    offhandSkillFactor,
  };
}

export interface ResolvedAttackWeapon {
  slot: AttackWeaponSlot;
  weapon: Item | null;
  /** True when the weapon sits in the non-dominant slot. */
  isOffhandSlot: boolean;
  offhandSkillFactor: number;
  armSide: ArmSide;
}

/**
 * Prefer mainhand weapon; if empty/broken-as-empty, allow offhand weapon
 * (not shield) so fighters can swap a blade into the healthy hand.
 */
export function resolveAttackWeapon(
  unit: DetailedUnit,
  itemsById: Record<string, Item>,
  opts?: { treatBrokenAsEmpty?: boolean }
): ResolvedAttackWeapon {
  const dominant = unit.combatStats.dominantHand ?? 'right';
  const training = unit.combatStats.offhandTraining ?? 0;
  const offFactor = calcOffhandSkillFactor(training);

  const mainId = unit.equipment.mainhand;
  const offId = unit.equipment.offhand;
  const main = mainId ? itemsById[mainId] ?? null : null;
  const off = offId ? itemsById[offId] ?? null : null;

  const treatBroken = opts?.treatBrokenAsEmpty !== false;
  const mainUsable =
    !!main &&
    main.itemType === 'weapon' &&
    !(treatBroken && itemIsBrokenWeapon(main));
  const offUsable =
    !!off &&
    off.itemType === 'weapon' &&
    !(treatBroken && itemIsBrokenWeapon(off));

  if (mainUsable) {
    return {
      slot: 'mainhand',
      weapon: main,
      isOffhandSlot: false,
      offhandSkillFactor: 1,
      armSide: armSideForWeaponSlot('mainhand', dominant),
    };
  }

  if (offUsable) {
    return {
      slot: 'offhand',
      weapon: off,
      isOffhandSlot: true,
      offhandSkillFactor: offFactor,
      armSide: armSideForWeaponSlot('offhand', dominant),
    };
  }

  // Punch / empty — dominant fist.
  return {
    slot: 'mainhand',
    weapon: null,
    isOffhandSlot: false,
    offhandSkillFactor: 1,
    armSide: armSideForWeaponSlot('mainhand', dominant),
  };
}

/** Whether this attack uses a two-hand grip given equipped offhand. */
export function isTwoHandGrip(
  weapon: Item | null,
  offhandOccupied: boolean
): boolean {
  if (!weapon) return false;
  const template = getItemTemplate(weapon.templateId);
  const typeInfo = getWeaponTypeInfo(
    weapon.weaponType ?? template?.weaponType ?? 'punch'
  );
  if (offhandOccupied) return false;
  if (typeInfo.twoHanded) return true;
  if (template?.flags?.twoHandOptional) return true;
  return false;
}

export function weaponWeightOf(weapon: Item | null): number {
  if (!weapon) return 0.5;
  const template = getItemTemplate(weapon.templateId);
  if (!template) return 1;
  return Math.max(0.1, calcItemWeight(template));
}

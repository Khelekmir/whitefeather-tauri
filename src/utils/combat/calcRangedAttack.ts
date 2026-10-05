import type { BodyPartId, Unit as DetailedUnit } from '../../types/characters';
import type { Item } from '../../types/items';
import {
  ATTACK_TARGETS,
  type AttackTargetKey,
} from '../../data/combat/attackTargets';
import { getBowProfile, isBowWeaponType } from '../../data/combat/bowProfiles';
import { mixChestPrimaryFringe } from '../../data/combat/rangedAimTables';
import { deriveArrowImpactStats } from '../../data/combat/arrowHeadStyles';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import { COMBAT_TUNING } from './combatTuning';
import { calcTraumaPenalties } from './traumaFlags';
import {
  calcHealthPenaltySimple,
  calcStaminaPenalty,
  roundToThousandths,
} from './penalties';
import { getBloodStatus, calcBloodCombatPenalties } from './bloodVolume';
import { getWeaponStanceProfile } from '../../data/combat/stances';
import { calcSensoryPerformance } from './sensoryPerformance';
import {
  calcLimbAttackMult,
  isTwoHandGrip,
  resolveAttackWeapon,
  weaponWeightOf,
} from './limbAttack';

const R = () => COMBAT_TUNING.ranged;

function bandT(distanceBand: number): number {
  const b = Math.max(1, Math.min(5, distanceBand));
  return (b - 1) / 4;
}

function skillFactor01(weaponSkill: number): number {
  const pivot = R().accuracySkillPivot;
  return Math.min(
    1,
    Math.log10(Math.max(1, weaponSkill) + 1) / Math.log10(pivot + 1)
  );
}

/**
 * Extra accuracy multiplier for non-chest aims.
 * Chest → 1. Mild at band 1, harsh at band 5; skill shrinks the tax.
 */
export function calcRangedAimPrecisionMult(input: {
  aim: AttackTargetKey;
  weaponSkill: number;
  distanceBand: number;
}): number {
  if (input.aim === 'chest') return 1;
  const P = R().aimPrecision;
  const difficulty = P.difficulty[input.aim] ?? 0.6;
  const t = bandT(input.distanceBand);
  const raw =
    (P.closeMaxPenalty + (P.farMaxPenalty - P.closeMaxPenalty) * t) *
    difficulty;
  const mitigated =
    raw * (1 - skillFactor01(input.weaponSkill) * P.skillRelief);
  return roundToThousandths(
    Math.max(P.precisionFloor, Math.min(1, 1 - mitigated))
  );
}

/**
 * Fringe share of chest hit mass that can clip extremities.
 */
export function calcChestFringeShare(input: {
  weaponSkill: number;
  distanceBand: number;
}): number {
  const S = R().chestSplash;
  const t = bandT(input.distanceBand);
  const base = S.fringeClose + (S.fringeFar - S.fringeClose) * t;
  return roundToThousandths(
    Math.max(
      0.02,
      base * (1 - skillFactor01(input.weaponSkill) * S.groupingRelief)
    )
  );
}

/**
 * Ranged hit-ratio for the selected aim (chest uses skill/band splash).
 */
export function buildRangedAimHitRatio(input: {
  aim: AttackTargetKey;
  weaponSkill: number;
  distanceBand: number;
}): Partial<Record<BodyPartId, number>> {
  if (input.aim === 'chest') {
    return mixChestPrimaryFringe(
      calcChestFringeShare({
        weaponSkill: input.weaponSkill,
        distanceBand: input.distanceBand,
      })
    );
  }
  return { ...(ATTACK_TARGETS[input.aim]?.hitRatio ?? { chestLeft: 1 }) };
}

export function isRangedWeaponItem(item: Item | null | undefined): boolean {
  if (!item || item.itemType !== 'weapon' || !item.weaponType) return false;
  return (
    isBowWeaponType(item.weaponType) ||
    !!getWeaponStanceProfile(item.weaponType).ranged
  );
}

export function isBowItem(item: Item | null | undefined): boolean {
  return !!item?.weaponType && isBowWeaponType(item.weaponType);
}

export function bandToMeters(band: number): number {
  const b = Math.max(1, Math.min(5, Math.round(band)));
  return R().bandMeters[b] ?? R().bandMeters[1]!;
}

export interface DrawAssessment {
  drawFrac: number;
  maxEngageBand: number;
  optimalDrawStr: number;
  drawWeightRated: number;
  bowMaxBand: number;
}

export function assessDraw(
  strength: number,
  weaponType: string
): DrawAssessment | null {
  const profile = getBowProfile(weaponType);
  if (!profile) return null;
  const str = Math.max(1, strength);
  const drawFrac = Math.max(
    R().drawFracMin,
    Math.min(1, str / profile.optimalDrawStr)
  );
  const maxEngageBand = Math.max(
    1,
    Math.min(5, Math.floor(profile.maxRangeBand * drawFrac + 1e-9))
  );
  return {
    drawFrac: roundToThousandths(drawFrac),
    maxEngageBand,
    optimalDrawStr: profile.optimalDrawStr,
    drawWeightRated: profile.drawWeightRated,
    bowMaxBand: profile.maxRangeBand,
  };
}

export function canEngageAtBand(
  strength: number,
  weaponType: string,
  distanceBand: number
): { ok: boolean; draw: DrawAssessment | null; message: string } {
  const draw = assessDraw(strength, weaponType);
  if (!draw) {
    return { ok: false, draw: null, message: 'Not a bow weapon.' };
  }
  if (distanceBand > draw.maxEngageBand) {
    return {
      ok: false,
      draw,
      message: `Out of draw reach (band ${distanceBand} > max ${draw.maxEngageBand} at ${(draw.drawFrac * 100).toFixed(0)}% draw).`,
    };
  }
  return { ok: true, draw, message: 'In range.' };
}

export function calcRangedAccuracy(input: {
  unit: DetailedUnit;
  weaponType: string;
  distanceBand: number;
  drawFrac: number;
  maxEngageBand: number;
  /** When set, applies non-chest aim precision tax. */
  aim?: AttackTargetKey;
}): number {
  const base = input.unit.combatStats.base;
  const skill =
    (input.unit.combatStats.weaponSkill as Record<string, number>)[
      input.weaponType
    ] ?? 1;
  const skillFactor = Math.min(
    1.15,
    Math.log10(Math.max(1, skill) + 1) /
      Math.log10(R().accuracySkillPivot + 1)
  );
  const sklFactor = Math.min(
    1.1,
    Math.log10(Math.max(1, base.skill) + 1) / Math.log10(12 + 1)
  );
  const agiFactor = Math.min(
    1.05,
    Math.log10(Math.max(1, base.agility) + 1) / Math.log10(10 + 1)
  );

  let acc =
    0.25 +
    0.55 * skillFactor +
    0.2 * sklFactor +
    R().accuracyAgiWeight * (agiFactor - 0.5);

  const rangeRatio = input.distanceBand / Math.max(1, input.maxEngageBand);
  const distFactor =
    1 - (1 - R().accuracyAtMaxRange) * Math.min(1, Math.max(0, rangeRatio));
  acc *= distFactor;

  const drawAcc =
    R().accuracyDrawFloor +
    (1 - R().accuracyDrawFloor) * input.drawFrac;
  acc *= drawAcc;

  if (input.aim != null && input.aim !== 'chest') {
    acc *= calcRangedAimPrecisionMult({
      aim: input.aim,
      weaponSkill: skill,
      distanceBand: input.distanceBand,
    });
  }

  const sensory = calcSensoryPerformance(input.unit.combatStats.itemizedHealth);
  acc *= sensory.focusMult;

  return roundToThousandths(
    Math.max(R().accuracyMin, Math.min(R().accuracyMax, acc))
  );
}

export function calcRangedAttackValue(input: {
  unit: DetailedUnit;
  weaponType: string;
  draw: DrawAssessment;
  arrow: Item;
  distanceBand: number;
  critMultiplier?: number;
  itemsById?: Record<string, Item>;
}): {
  attackValue: number;
  drawEnergy: number;
  falloff: number;
  meters: number;
  maxMeters: number;
  limbAttackMult: number;
} {
  const base = input.unit.combatStats.base;
  const itemized = input.unit.combatStats.itemizedHealth;
  const blood = getBloodStatus(input.unit);
  const bloodPen = calcBloodCombatPenalties(blood.remainingFraction);
  const trauma = calcTraumaPenalties(itemized, input.unit.combatStats.organs);

  const mass = input.arrow.projectileMass ?? 1;
  const tip = input.arrow.tipFactor ?? 1;
  const meters = bandToMeters(input.distanceBand);
  const maxMeters = bandToMeters(input.draw.maxEngageBand);

  const drawEnergy =
    input.draw.drawWeightRated *
    input.draw.drawFrac *
    input.draw.drawFrac *
    R().drawEnergyScale;

  const massCoupling = R().massCouplingBias + mass;
  let falloff = Math.pow(
    Math.max(0.05, 1 - R().falloffK * (meters / Math.max(1, maxMeters))),
    R().falloffP
  );
  if (mass > 1.1) {
    falloff *= 1 - R().heavyMassFalloffExtra * (meters / Math.max(1, maxMeters));
  }
  falloff = Math.max(0.08, falloff);

  let attackValue =
    drawEnergy * tip * massCoupling * falloff;

  let limbAttackMult = 1;
  if (input.itemsById) {
    const resolved = resolveAttackWeapon(input.unit, input.itemsById);
    const offId = input.unit.equipment.offhand;
    const off = offId ? input.itemsById[offId] : null;
    const offOccupied =
      !!off &&
      (off.itemType === 'shield' ||
        (off.itemType === 'weapon' && resolved.slot === 'mainhand'));
    const limb = calcLimbAttackMult({
      itemized,
      dominantHand: input.unit.combatStats.dominantHand ?? 'right',
      attackSlot: resolved.slot,
      twoHandGrip: isTwoHandGrip(resolved.weapon, offOccupied),
      weaponWeight: weaponWeightOf(resolved.weapon),
      strength: base.strength,
      constitution: base.constitution,
    });
    limbAttackMult = limb.mult;
  }

  attackValue *=
    calcHealthPenaltySimple(itemized) *
    calcStaminaPenalty(base.staminaCap, base.staminaCurrent) *
    bloodPen.stamina *
    bloodPen.attack *
    trauma.attackMult *
    trauma.globalCombatMult *
    limbAttackMult;

  if (input.critMultiplier != null && input.critMultiplier > 1) {
    attackValue *= input.critMultiplier;
  }

  return {
    attackValue: roundToThousandths(attackValue),
    drawEnergy: roundToThousandths(drawEnergy),
    falloff: roundToThousandths(falloff),
    meters,
    maxMeters,
    limbAttackMult: roundToThousandths(limbAttackMult),
  };
}

export function calcDrawStaminaCost(input: {
  constitution: number;
  drawWeightRated: number;
  drawFrac: number;
}): number {
  const con = Math.max(1, input.constitution);
  const raw =
    (input.drawWeightRated * input.drawFrac * R().drawStaminaScale) /
    Math.sqrt(con / 6);
  return roundToThousandths(Math.max(R().drawStaminaMin, raw));
}

export function listOwnedArrows(
  itemsById: Record<string, Item>
): { templateId: string; name: string; count: number; sample: Item }[] {
  const map = new Map<
    string,
    { templateId: string; name: string; count: number; sample: Item }
  >();
  for (const item of Object.values(itemsById)) {
    if (item.itemType !== 'consumable') continue;
    if (item.projectileMass == null && !item.templateId.startsWith('arrow-')) {
      continue;
    }
    if (!item.templateId.startsWith('arrow-')) continue;
    const cur = map.get(item.templateId);
    if (cur) cur.count += 1;
    else {
      map.set(item.templateId, {
        templateId: item.templateId,
        name: item.name,
        count: 1,
        sample: item,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function takeOneArrow(
  itemsById: Record<string, Item>,
  templateId: string
): Item | null {
  const found = Object.values(itemsById).find(
    (i) => i.templateId === templateId && i.itemType === 'consumable'
  );
  if (!found) return null;
  delete itemsById[found.id];
  return found;
}

export function resolveArrowStats(item: Item): {
  mass: number;
  tipFactor: number;
} {
  const t = getItemTemplate(item.templateId);
  const derived = deriveArrowImpactStats({
    shaftGrade: item.shaftGrade ?? t?.shaftGrade,
    arrowHeadStyle: item.arrowHeadStyle ?? t?.arrowHeadStyle,
    material: item.material ?? t?.material,
  });
  return {
    mass: item.projectileMass ?? t?.projectileMass ?? derived.mass,
    tipFactor: item.tipFactor ?? t?.tipFactor ?? derived.tipFactor,
  };
}

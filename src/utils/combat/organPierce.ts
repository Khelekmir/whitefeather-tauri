/**
 * Heart / lung pierce from thrust that is not turned by hard chest armor.
 * Dagger→heart: opposite stance only; SKL 1–30 linear hard cap;
 * dagger proficiency soft-caps with diminishing returns.
 */

import type {
  BodyPartId,
  Unit as DetailedUnit,
  VitalOrganId,
  VitalOrgans,
} from '../../types/characters';
import type { EquipmentLoadout, Item } from '../../types/items';
import type { StanceRelation } from '../../data/combat/stances';
import { getProtectingArmor } from '../items/resolveItem';
import { COMBAT_TUNING, isSoftMaterial } from './combatTuning';
import { roundToThousandths } from './penalties';
import { applyBruiseFromHit } from './bruise';
import { BLEED_SPLIT_THRUST } from './bleedSplit';

const O = () => COMBAT_TUNING.organPierce;

export type OrganPierceKind = 'heart' | 'lungLeft' | 'lungRight';

export interface OrganPierceEvent {
  organ: OrganPierceKind;
  /** Chance that was rolled against. */
  chance: number;
  roll: number;
  /** Integrity after applying damage. */
  integrityAfter: number;
  daggerHeartSpecial?: boolean;
}

export interface OrganPierceResult {
  deterred: boolean;
  deterReason?: string;
  events: OrganPierceEvent[];
  incapacitated: boolean;
  log: string[];
}

/** Parts that can reach heart/lungs on a thrust. */
export function organEligibleParts(part: BodyPartId): OrganPierceKind[] {
  switch (part) {
    case 'chestLeft':
      return ['heart', 'lungLeft'];
    case 'chestRight':
      return ['heart', 'lungRight'];
    case 'stomachUpper':
      return ['heart', 'lungLeft', 'lungRight'];
    default:
      return [];
  }
}

/**
 * Hard chest-slot armor with remaining durability covering this panel
 * turns aside organ pierces. Soft cloth/leather does not.
 */
export function hardChestArmorDeters(
  part: BodyPartId,
  equipment: EquipmentLoadout,
  itemsById: Record<string, Item>
): { deterred: boolean; reason?: string } {
  const layers = getProtectingArmor(part, equipment, itemsById);
  for (const layer of layers) {
    if (layer.instance.slot !== 'chest') continue;
    if (isSoftMaterial(layer.instance.material)) continue;
    const ratio = layer.durabilityRatio;
    if (ratio <= 0) continue;
    return {
      deterred: true,
      reason: `${layer.instance.name} turns the point from vital organs`,
    };
  }
  return { deterred: false };
}

/** SKL 1–30 → linear hard cap fraction of max heart chance. */
export function skillHardCapFraction(skill: number): number {
  const { skillMin, skillMax } = O();
  const s = Math.max(skillMin, Math.min(skillMax, skill));
  return (s - skillMin) / (skillMax - skillMin);
}

/**
 * Dagger proficiency with diminishing returns up to soft cap.
 * Returns 0–1.
 */
export function daggerProficiencyFactor(daggerRank: number): number {
  const soft = O().daggerProfSoftCap;
  return Math.min(
    1,
    Math.log10(Math.max(1, daggerRank) + 1) / Math.log10(soft + 1)
  );
}

/** Opposite-stance dagger thrust heart chance (before armor gate). */
export function calcDaggerHeartChance(input: {
  skill: number;
  daggerRank: number;
}): number {
  const hard = skillHardCapFraction(input.skill) * O().daggerHeartMaxAtSkill30;
  return roundToThousandths(hard * daggerProficiencyFactor(input.daggerRank));
}

function pierceFeel(weaponType: string): number {
  return O().pierceFeel[weaponType] ?? 0.5;
}

function applyOrganDamage(
  organs: VitalOrgans,
  organ: OrganPierceKind,
  amount: number
): number {
  const next = Math.max(0, (organs[organ] ?? 1) - amount);
  organs[organ] = roundToThousandths(next);
  return organs[organ];
}

/**
 * Roll organ pierces after a connected thrust hit.
 * Mutates defender organs, itemized bleed, and incapacitated flag.
 */
export function resolveOrganPierce(input: {
  defender: DetailedUnit;
  itemsById: Record<string, Item>;
  bodypart: BodyPartId;
  damagePercent: number;
  attackMode: string;
  weaponType: string;
  stanceRelation: StanceRelation;
  attackerSkill: number;
  attackerWeaponSkill: number;
  rng?: () => number;
}): OrganPierceResult {
  const log: string[] = [];
  const events: OrganPierceEvent[] = [];
  const rng = input.rng ?? Math.random;

  if (
    (input.attackMode !== 'thrust' && input.attackMode !== 'projectile') ||
    input.damagePercent <= 0
  ) {
    return {
      deterred: false,
      events,
      incapacitated: input.defender.combatStats.incapacitated,
      log,
    };
  }

  const eligible = organEligibleParts(input.bodypart);
  if (eligible.length === 0) {
    return {
      deterred: false,
      events,
      incapacitated: input.defender.combatStats.incapacitated,
      log,
    };
  }

  const armor = hardChestArmorDeters(
    input.bodypart,
    input.defender.equipment,
    input.itemsById
  );
  if (armor.deterred) {
    log.push(`${armor.reason}.`);
    return {
      deterred: true,
      deterReason: armor.reason,
      events,
      incapacitated: input.defender.combatStats.incapacitated,
      log,
    };
  }

  const organs = input.defender.combatStats.organs;
  const partState = input.defender.combatStats.itemizedHealth[input.bodypart];
  const feel = pierceFeel(input.weaponType);
  const dmg = Math.max(0, Math.min(1, input.damagePercent));

  // —— Dagger heart special (opposite thrust only) ——
  let daggerHeartTried = false;
  if (
    input.weaponType === 'dagger' &&
    input.stanceRelation === 'opposite' &&
    eligible.includes('heart')
  ) {
    daggerHeartTried = true;
    const chance = calcDaggerHeartChance({
      skill: input.attackerSkill,
      daggerRank: input.attackerWeaponSkill,
    });
    const roll = rng();
    if (roll < chance) {
      const after = applyOrganDamage(organs, 'heart', O().organDamageOnPierce);
      events.push({
        organ: 'heart',
        chance,
        roll,
        integrityAfter: after,
        daggerHeartSpecial: true,
      });
      // Severe external + internal bleed; incapacitate (not instant death).
      if (partState) {
        partState.bleed = roundToThousandths(
          Math.min(
            1,
            Math.max(partState.bleed, partState.bleed + O().heartExternalBleedSpike)
          )
        );
        partState.internalBleed = roundToThousandths(
          Math.min(
            1,
            Math.max(
              partState.internalBleed,
              partState.internalBleed + O().heartInternalBleedSpike
            )
          )
        );
        applyBruiseFromHit(partState, 0.9, BLEED_SPLIT_THRUST);
      }
      input.defender.combatStats.incapacitated = true;
      log.push(
        `HEART PIERCED (dagger opposite thrust · p=${chance.toFixed(2)}, roll=${roll.toFixed(2)}) — integrity ${(after * 100).toFixed(0)}%. Severe hemorrhage; ${input.defender.name} is incapacitated.`
      );
    } else {
      log.push(
        `Dagger heart line fails (p=${chance.toFixed(2)}, roll=${roll.toFixed(2)}).`
      );
    }
  }

  // —— General lung / rare heart (if heart not already pierced this hit) ——
  const heartAlready = events.some((e) => e.organ === 'heart');
  for (const organ of eligible) {
    if (organ === 'heart') {
      if (heartAlready || daggerHeartTried) continue;
      const chance = roundToThousandths(
        O().generalHeartChancePerDamage * dmg * feel
      );
      const roll = rng();
      if (roll < chance) {
        const after = applyOrganDamage(organs, 'heart', O().organDamageOnPierce);
        events.push({ organ: 'heart', chance, roll, integrityAfter: after });
        if (partState) {
          partState.bleed = roundToThousandths(
            Math.min(
              1,
              Math.max(
                partState.bleed,
                partState.bleed + O().heartExternalBleedSpike
              )
            )
          );
          partState.internalBleed = roundToThousandths(
            Math.min(
              1,
              Math.max(
                partState.internalBleed,
                partState.internalBleed + O().heartInternalBleedSpike
              )
            )
          );
          applyBruiseFromHit(partState, 0.9, BLEED_SPLIT_THRUST);
        }
        input.defender.combatStats.incapacitated = true;
        log.push(
          `HEART PIERCED (p=${chance.toFixed(2)}, roll=${roll.toFixed(2)}) — integrity ${(after * 100).toFixed(0)}%. Severe hemorrhage; ${input.defender.name} is incapacitated.`
        );
      }
      continue;
    }

    // Lungs
    const chance = roundToThousandths(
      O().lungChancePerDamage * dmg * feel
    );
    const roll = rng();
    if (roll < chance) {
      const after = applyOrganDamage(organs, organ, O().organDamageOnPierce);
      events.push({ organ, chance, roll, integrityAfter: after });
      if (partState) {
        partState.bleed = roundToThousandths(
          Math.min(
            1,
            Math.max(
              partState.bleed,
              partState.bleed + O().lungExternalBleedSpike
            )
          )
        );
        partState.internalBleed = roundToThousandths(
          Math.min(
            1,
            Math.max(
              partState.internalBleed,
              partState.internalBleed + O().lungInternalBleedSpike
            )
          )
        );
        applyBruiseFromHit(partState, 0.6, BLEED_SPLIT_THRUST);
      }
      const label = organ === 'lungLeft' ? 'left lung' : 'right lung';
      log.push(
        `${label.toUpperCase()} PIERCED (p=${chance.toFixed(2)}, roll=${roll.toFixed(2)}) — integrity ${(after * 100).toFixed(0)}%. Breathing labored.`
      );
    }
  }

  return {
    deterred: false,
    events,
    incapacitated: input.defender.combatStats.incapacitated,
    log,
  };
}

/** Strong stamina drain from compromised lungs. */
export function lungStaminaDrainMult(organs: VitalOrgans | null | undefined): number {
  if (!organs) return 1;
  const injL = Math.max(0, 1 - (organs.lungLeft ?? 1));
  const injR = Math.max(0, 1 - (organs.lungRight ?? 1));
  const raw =
    1 +
    injL * O().lungStaminaDrainPerInjury +
    injR * O().lungStaminaDrainPerInjury;
  return roundToThousandths(Math.min(O().lungStaminaDrainMax, raw));
}

export function formatOrgansSummary(organs: VitalOrgans): string | null {
  const bits: string[] = [];
  if (organs.heart < 0.999)
    bits.push(`heart ${(organs.heart * 100).toFixed(0)}%`);
  if (organs.lungLeft < 0.999)
    bits.push(`L lung ${(organs.lungLeft * 100).toFixed(0)}%`);
  if (organs.lungRight < 0.999)
    bits.push(`R lung ${(organs.lungRight * 100).toFixed(0)}%`);
  return bits.length ? bits.join(' · ') : null;
}

export function organLabel(id: VitalOrganId): string {
  switch (id) {
    case 'heart':
      return 'Heart';
    case 'lungLeft':
      return 'Left lung';
    case 'lungRight':
      return 'Right lung';
  }
}

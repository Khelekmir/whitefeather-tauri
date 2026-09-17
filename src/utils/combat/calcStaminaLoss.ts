import { getBodypartVitality } from '../../data/combat/bodypartVitality';
import type { BodyPartId, Unit as DetailedUnit } from '../../types/characters';
import type { Item } from '../../types/items';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import { calcItemWeight } from '../items/resolveItem';
import { isSoftMaterial, COMBAT_TUNING } from './combatTuning';
import { roundToThousandths } from './penalties';
import { calcTraumaPenalties } from './traumaFlags';

const S = COMBAT_TUNING.stamina;

export type DefenderSurface = 'bare' | 'soft' | 'hard';

export function classifyDefenderSurface(
  outermostMaterial: string | null | undefined
): DefenderSurface {
  if (!outermostMaterial || outermostMaterial === 'unequipped' || outermostMaterial === 'body') {
    return 'bare';
  }
  if (isSoftMaterial(outermostMaterial as Parameters<typeof isSoftMaterial>[0])) {
    return 'soft';
  }
  return 'hard';
}

/**
 * Attacker stamina to throw a basic main-hand swing.
 * Port spirit of old CalcStaminaLoss("attack") with clearer weight/STR effort.
 */
export function calcAttackerSwingStamina(input: {
  attacker: DetailedUnit;
  mainhand: Item | null;
  offhandWeight: number;
  twoHanding: boolean;
}): number {
  const { attacker, mainhand, offhandWeight, twoHanding } = input;
  const bodyWeight = Math.max(40, attacker.weight);
  const mainTemplate = mainhand ? getItemTemplate(mainhand.templateId) : null;
  const mainWeight = mainhand && mainTemplate ? calcItemWeight(mainTemplate) : 0.5;
  const gearWeight = mainWeight + Math.max(0, offhandWeight);

  // Old: max(1, 1 + gear/body − 0.25)
  const gearBurden = Math.max(
    1,
    1 + (gearWeight / bodyWeight) * S.attackGearBurden - 0.25
  );

  // Extra tax when the weapon outclasses strength (heavy lance in weak hands)
  const strength = Math.max(1, attacker.combatStats.base.strength);
  const oversize = Math.max(0, mainWeight / strength - 0.35);
  const oversizeTax = 1 + oversize * S.attackOversizeScale;

  const twoHandTax = twoHanding ? S.attackTwoHandMult : 1;

  const trauma = calcTraumaPenalties(attacker.combatStats.itemizedHealth);
  const loss =
    S.attackBasic *
    gearBurden *
    oversizeTax *
    twoHandTax *
    trauma.staminaDrainMult;
  return roundToThousandths(Math.max(S.attackMin, loss));
}

/**
 * Defender stamina for absorbing a landed hit (no successful dodge/parry yet).
 * Graded by part vitality criticality, attack force, CON mismatch, and surface.
 */
export function calcDefenderHitStamina(input: {
  attacker: DetailedUnit;
  defender: DetailedUnit;
  bodypart: BodyPartId;
  attackValue: number;
  damagePercent: number;
  surface: DefenderSurface;
}): number {
  const { attacker, defender, bodypart, attackValue, damagePercent, surface } =
    input;

  const atkCon = Math.max(1, attacker.combatStats.base.constitution);
  const defCon = Math.max(1, defender.combatStats.base.constitution);
  const conRatio = Math.sqrt(atkCon / defCon);

  const vit = getBodypartVitality(bodypart);
  // Normalize vitality weight (~1–14) into a ~0.5–1.6 shock band
  const partShock =
    0.55 + (vit.vitalityWeight / 14) * S.takeHitVitalityScale * 1.2;

  const forceShock = 1 + Math.sqrt(Math.max(0, attackValue)) * S.takeHitForceScale;
  // Fresh damage on the part also shocks more than a tap on already-dead meat
  const woundShock = 0.75 + Math.min(1, damagePercent) * 0.5;

  const surfaceMult =
    surface === 'bare'
      ? S.takeHitSoftShockMult * 1.1
      : surface === 'soft'
        ? S.takeHitSoftShockMult
        : S.takeHitHardShockMult;

  const trauma = calcTraumaPenalties(defender.combatStats.itemizedHealth);
  const loss =
    S.takeHitBasic *
    conRatio *
    partShock *
    forceShock *
    woundShock *
    surfaceMult *
    trauma.staminaDrainMult;

  return roundToThousandths(Math.max(S.takeHitMin, loss));
}

/** Successful shield block — old attackBlocked spirit. */
export function calcBlockStamina(input: {
  attackerCon: number;
  defenderCon: number;
  /** Chest-broken breathing tax (default 1). */
  staminaDrainMult?: number;
}): number {
  const atk = Math.max(1, input.attackerCon);
  const def = Math.max(1, input.defenderCon);
  const conRatio = Math.sqrt(atk / def);
  const loss =
    S.blockBasic *
    (1 + (conRatio - 1) * S.blockConDiffScale) *
    (input.staminaDrainMult ?? 1);
  return roundToThousandths(Math.max(S.blockMin, loss));
}

export function calcDodgeStamina(
  quality: 'precise' | 'sloppy',
  staminaDrainMult = 1
): number {
  const base = quality === 'precise' ? S.dodgePrecise : S.dodgeSloppy;
  return roundToThousandths(base * staminaDrainMult);
}

export function calcParryStamina(input: {
  quality: 'clean' | 'edge';
  attackerCon: number;
  defenderCon: number;
  staminaDrainMult?: number;
}): number {
  const base = input.quality === 'clean' ? S.parryClean : S.parryEdge;
  const ratio = Math.sqrt(
    Math.max(1, input.attackerCon) / Math.max(1, input.defenderCon)
  );
  return roundToThousandths(
    base *
      Math.max(1, ratio * S.parryConDiffScale) *
      (input.staminaDrainMult ?? 1)
  );
}

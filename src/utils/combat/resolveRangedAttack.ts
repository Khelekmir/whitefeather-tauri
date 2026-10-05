import type { AttackTargetKey } from '../../data/combat/attackTargets';
import {
  assessDraw,
  buildRangedAimHitRatio,
  calcChestFringeShare,
  calcDrawStaminaCost,
  calcRangedAccuracy,
  calcRangedAimPrecisionMult,
  calcRangedAttackValue,
  canEngageAtBand,
  isBowItem,
  listOwnedArrows,
  resolveArrowStats,
  takeOneArrow,
} from './calcRangedAttack';
import { roundToThousandths } from './penalties';
import {
  resolveBasicAttack,
  type BasicAttackResult,
  type FighterState,
} from './resolveBasicAttack';
import { BLEED_SPLIT_THRUST } from './bleedSplit';
import {
  describeLodgedArrow,
  lodgeArrowInPart,
} from './lodgedArrow';
import { formatBodyPartLabel } from '../../types/characters';
import { formatArrowComposition } from '../../data/combat/arrowHeadStyles';

export interface ResolveRangedAttackOptions {
  distanceBand: number;
  arrowTemplateId: string;
  aim?: AttackTargetKey;
  rng?: () => number;
  critMultiplier?: number;
}

export type RangedAttackResult =
  | {
      kind: 'out_of_range' | 'no_bow' | 'no_arrow' | 'miss';
      log: string[];
      attacker: FighterState;
      defender: FighterState;
      accuracy?: number;
      drawFrac?: number;
      maxEngageBand?: number;
    }
  | ({ kind: 'hit' } & BasicAttackResult & {
      accuracy: number;
      drawFrac: number;
      maxEngageBand: number;
      arrowName: string;
    });

/**
 * Lab ranged shot: range gate → consume arrow → accuracy roll → damage.
 */
export function resolveRangedAttack(
  attackerIn: FighterState,
  defenderIn: FighterState,
  opts: ResolveRangedAttackOptions
): RangedAttackResult {
  const attacker: FighterState = {
    unit: structuredClone(attackerIn.unit),
    itemsById: { ...attackerIn.itemsById },
  };
  const defender = defenderIn;
  const log: string[] = [];

  const mainId = attacker.unit.equipment.mainhand;
  const bow = mainId ? attacker.itemsById[mainId] : null;
  const weaponType = bow?.weaponType;
  if (!bow || !weaponType) {
    return {
      kind: 'no_bow',
      log: [`${attacker.unit.name} has no bow in hand.`],
      attacker,
      defender,
    };
  }

  const engage = canEngageAtBand(
    attacker.unit.combatStats.base.strength,
    weaponType,
    opts.distanceBand
  );
  if (!engage.ok || !engage.draw) {
    return {
      kind: 'out_of_range',
      log: [engage.message],
      attacker,
      defender,
      drawFrac: engage.draw?.drawFrac,
      maxEngageBand: engage.draw?.maxEngageBand,
    };
  }

  const arrow = takeOneArrow(attacker.itemsById, opts.arrowTemplateId);
  if (!arrow) {
    return {
      kind: 'no_arrow',
      log: [`${attacker.unit.name} has no ${opts.arrowTemplateId} left.`],
      attacker,
      defender,
      drawFrac: engage.draw.drawFrac,
      maxEngageBand: engage.draw.maxEngageBand,
    };
  }

  // Ensure projectile stats even if denormalized fields missing
  const arrowStats = resolveArrowStats(arrow);
  arrow.projectileMass = arrowStats.mass;
  arrow.tipFactor = arrowStats.tipFactor;

  const drawCost = calcDrawStaminaCost({
    constitution: attacker.unit.combatStats.base.constitution,
    drawWeightRated: engage.draw.drawWeightRated,
    drawFrac: engage.draw.drawFrac,
  });

  const aim = opts.aim ?? 'chest';
  const weaponSkill =
    (attacker.unit.combatStats.weaponSkill as Record<string, number>)[
      weaponType
    ] ?? 1;
  const precisionMult = calcRangedAimPrecisionMult({
    aim,
    weaponSkill,
    distanceBand: opts.distanceBand,
  });

  const accuracy = calcRangedAccuracy({
    unit: attacker.unit,
    weaponType,
    distanceBand: opts.distanceBand,
    drawFrac: engage.draw.drawFrac,
    maxEngageBand: engage.draw.maxEngageBand,
    aim,
  });

  const rng = opts.rng ?? Math.random;
  const roll = rng();
  log.push(
    `${attacker.unit.name} draws ${bow.name} (${(engage.draw.drawFrac * 100).toFixed(0)}% draw · band ${opts.distanceBand}/${engage.draw.maxEngageBand}) with ${arrow.name}.`
  );
  if (precisionMult < 1) {
    log.push(
      `Aim precision ×${precisionMult.toFixed(2)} (${aim} @ band ${opts.distanceBand}).`
    );
  } else if (aim === 'chest') {
    const fringe = calcChestFringeShare({
      weaponSkill,
      distanceBand: opts.distanceBand,
    });
    log.push(
      `Center-mass aim (chest) · extremity splash ${(fringe * 100).toFixed(0)}%.`
    );
  }
  log.push(
    `Accuracy ${(accuracy * 100).toFixed(0)}% (roll ${roll.toFixed(2)}).`
  );

  if (roll >= accuracy) {
    const b = attacker.unit.combatStats.base;
    b.staminaCurrent = Math.max(
      0,
      roundToThousandths(b.staminaCurrent - drawCost)
    );
    log.push(
      `Miss — arrow spent. Draw stamina −${drawCost} → ${b.staminaCurrent}.`
    );
    return {
      kind: 'miss',
      log,
      attacker,
      defender,
      accuracy,
      drawFrac: engage.draw.drawFrac,
      maxEngageBand: engage.draw.maxEngageBand,
    };
  }

  const energy = calcRangedAttackValue({
    unit: attacker.unit,
    weaponType,
    draw: engage.draw,
    arrow,
    distanceBand: opts.distanceBand,
    critMultiplier: opts.critMultiplier,
    itemsById: attacker.itemsById,
  });

  log.push(
    `Impact energy ${energy.attackValue} (${energy.meters.toFixed(0)} m / max ${energy.maxMeters.toFixed(0)} m · falloff ×${energy.falloff.toFixed(2)}${
      energy.limbAttackMult < 0.999
        ? ` · arm ×${energy.limbAttackMult.toFixed(2)}`
        : ''
    }).`
  );

  const hitRatioOverride = buildRangedAimHitRatio({
    aim,
    weaponSkill,
    distanceBand: opts.distanceBand,
  });

  const hit = resolveBasicAttack(attacker, defender, aim, {
    attackMode: 'projectile',
    bleedSplit: BLEED_SPLIT_THRUST, // projectile mirrors thrust channels for now
    arrowHeadStyle: arrow.arrowHeadStyle ?? null,
    overrideAttackValue: energy.attackValue,
    attackerStaminaOverride: drawCost,
    rng: opts.rng,
    prependLog: log,
    hitRatioOverride,
  });

  const lodge = lodgeArrowInPart(
    hit.defender.unit.combatStats.itemizedHealth,
    hit.bodypart,
    arrow
  );
  if (lodge.ok) {
    if (lodge.alreadyOccupied) {
      hit.log.push(
        `${formatBodyPartLabel(hit.bodypart)} already holds a shaft — ${describeLodgedArrow(lodge.lodged)}; new arrow does not lodge.`
      );
    } else {
      hit.log.push(
        `Arrow lodges in ${formatBodyPartLabel(hit.bodypart)} (${formatArrowComposition(lodge.lodged)}) — external bleed plugged while shaft remains.`
      );
    }
  }

  return {
    kind: 'hit',
    ...hit,
    accuracy,
    drawFrac: engage.draw.drawFrac,
    maxEngageBand: engage.draw.maxEngageBand,
    arrowName: arrow.name,
  };
}

export function getMainhandWeaponType(fighter: FighterState): string | null {
  const id = fighter.unit.equipment.mainhand;
  if (!id) return null;
  return fighter.itemsById[id]?.weaponType ?? null;
}

export { assessDraw, canEngageAtBand, listOwnedArrows, isBowItem };

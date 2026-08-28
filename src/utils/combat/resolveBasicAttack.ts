import { type AttackTargetKey } from '../../data/combat/attackTargets';
import {
  formatBodyPartLabel,
  type BodyPartId,
  type Unit as DetailedUnit,
  type WeaponTypeId,
} from '../../types/characters';
import {
  evaluateStanceMatchupFromSkills,
  formatMatchupPreview,
  pickBodyPartWithStance,
  summarizeRemappedAim,
  type StanceMatchupResult,
} from './calcStanceMatchup';
import type { Item } from '../../types/items';
import { getProtectingArmor, calcItemWeight } from '../items/resolveItem';
import { calcMainhandAttackValue } from './calcAttackValue';
import { calcCombatDamage } from './calcCombatDamage';
import {
  calcArmorDurabilityLoss,
  calcWeaponDurabilityLoss,
  classifyWeaponWearTarget,
} from './calcDurabilityLoss';
import {
  calcAttackerSwingStamina,
  calcDefenderHitStamina,
  classifyDefenderSurface,
} from './calcStaminaLoss';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import { COMBAT_TUNING, isOutfitSlot, isSoftMaterial } from './combatTuning';
import {
  calcBloodCombatPenalties,
  getBloodStatus,
} from './bloodVolume';
import {
  deriveHealthFromItemized,
  refreshBleedAfterInjury,
} from './deriveHealthPool';
import { roundToThousandths } from './penalties';
import { getBodypartVitality } from '../../data/combat/bodypartVitality';

export interface FighterState {
  unit: DetailedUnit;
  itemsById: Record<string, Item>;
}

export interface BasicAttackResult {
  log: string[];
  bodypart: BodyPartId;
  damagePercent: number;
  attackValue: number;
  totalMitigation: number;
  mitigationMultiplier: number;
  armorLosses: {
    slot: string;
    name: string;
    loss: number;
    remaining: number;
    softOutfit: boolean;
    ruined: boolean;
  }[];
  /** Soft outfit pieces that hit 0 durability this strike (erotic battlefield beat). */
  outfitsRuined: string[];
  weaponLoss: number;
  attackerStaminaLoss: number;
  defenderStaminaLoss: number;
  /** Mutated copies — assign back into Battleground state */
  attacker: FighterState;
  defender: FighterState;
  stance: StanceMatchupResult;
}

function deepCloneFighter(f: FighterState): FighterState {
  return {
    unit: structuredClone(f.unit),
    itemsById: structuredClone(f.itemsById),
  };
}

export interface ResolveBasicAttackOptions {
  /**
   * When &gt; 1 (rhythm crit), multiplies attack value before damage.
   * Misses are handled outside this function.
   */
  critMultiplier?: number;
}

/**
 * Resolve a basic main-hand attack that has already connected.
 * Hit/miss/crit gating is owned by Battleground attack-rhythm (or the 100% bypass).
 * Applies body-part damage, pool HP drain, armor + weapon durability, stamina.
 */
export function resolveBasicAttack(
  attackerIn: FighterState,
  defenderIn: FighterState,
  attackTarget: AttackTargetKey = 'chest',
  opts: ResolveBasicAttackOptions = {}
): BasicAttackResult {
  const attacker = deepCloneFighter(attackerIn);
  const defender = deepCloneFighter(defenderIn);
  const log: string[] = [];
  const critMultiplier =
    opts.critMultiplier != null && opts.critMultiplier > 1
      ? opts.critMultiplier
      : 1;

  const atkBase = attacker.unit.combatStats.base;
  const defBase = defender.unit.combatStats.base;

  const mainId = attacker.unit.equipment.mainhand;
  const offId = attacker.unit.equipment.offhand;
  const mainhand = mainId ? attacker.itemsById[mainId] ?? null : null;
  const offhand = offId ? attacker.itemsById[offId] ?? null : null;
  const offhandIsShield = offhand?.itemType === 'shield';
  const offTemplate = offhand ? getItemTemplate(offhand.templateId) : null;
  const offhandWeight =
    offhand && offTemplate ? calcItemWeight(offTemplate) : 0;

  const atkBlood = getBloodStatus(attacker.unit);
  const atkBloodPen = calcBloodCombatPenalties(atkBlood.remainingFraction);
  const atk = calcMainhandAttackValue(
    atkBase,
    attacker.unit.combatStats.itemizedHealth,
    attacker.unit.combatStats.weaponSkill,
    mainhand,
    offhandIsShield,
    offhandWeight,
    {
      bloodRemainingFraction: atkBlood.remainingFraction,
      bloodStaminaFactor: atkBloodPen.stamina,
      bloodAttackFactor: atkBloodPen.attack,
    }
  );
  if (critMultiplier > 1) {
    atk.attackValue = roundToThousandths(atk.attackValue * critMultiplier);
  }

  const atkStance = attacker.unit.combatStats.currentStance;
  const defStance = defender.unit.combatStats.currentStance;
  const stance = evaluateStanceMatchupFromSkills(
    atkStance.strike,
    defStance.cover,
    attacker.unit.combatStats.stanceSkill,
    defender.unit.combatStats.stanceSkill,
    atk.weaponType
  );
  const bodypart = pickBodyPartWithStance(attackTarget, defStance.cover);
  const presented = summarizeRemappedAim(attackTarget, defStance.cover, 4);
  log.push(
    `${attacker.unit.name} ${atkStance.strike} (rank ${stance.strikeRank}) vs ${defender.unit.name} ${defStance.cover} (rank ${stance.coverRank}).`
  );
  log.push(formatMatchupPreview(stance));
  log.push(
    `${attackTarget} aim vs ${defStance.cover} presents: ${presented
      .map((p) => `${formatBodyPartLabel(p.part)} ${(p.ratio * 100).toFixed(0)}%`)
      .join(', ')}.`
  );
  log.push(
    `${attacker.unit.name} attacks ${defender.unit.name} (${attackTarget} aim) → hits ${formatBodyPartLabel(bodypart)}${
      critMultiplier > 1 ? ` [CRIT ×${critMultiplier}]` : ''
    }.`
  );
  log.push(
    `Attack value ${roundToThousandths(atk.attackValue)} with ${atk.weaponType} (${atk.damageType})${
      critMultiplier > 1 ? ` (crit applied)` : ''
    }.`
  );

  const dmg = calcCombatDamage(
    atk.attackValue,
    defBase.health,
    bodypart,
    defender.unit.equipment,
    defender.itemsById
  );

  log.push(
    `Armor mitigation ${dmg.totalMitigation} → multiplier ${dmg.mitigationMultiplier}; damage to part ${(dmg.damagePercent * 100).toFixed(1)}%.`
  );

  // —— Apply itemized injury; pool HP is compiled from weighted parts ——
  const part = defender.unit.combatStats.itemizedHealth[bodypart];
  const prevPart = part.health;
  const prevPool = defBase.healthCurrent;
  part.health = Math.max(0, roundToThousandths(part.health - dmg.damagePercent));
  refreshBleedAfterInjury(defender.unit.combatStats.itemizedHealth, bodypart);

  const blood = getBloodStatus(defender.unit);
  const bloodPen = calcBloodCombatPenalties(blood.remainingFraction);
  const derived = deriveHealthFromItemized(
    defender.unit.combatStats.itemizedHealth,
    defBase.health,
    defBase.bloodLoss ?? 0,
    bloodPen.vitality
  );
  defBase.healthCurrent = derived.healthCurrent;

  const vit = getBodypartVitality(bodypart);
  log.push(
    `${formatBodyPartLabel(bodypart)} health ${prevPart.toFixed(2)} → ${part.health.toFixed(2)} (vitality weight ${vit.vitalityWeight}, bleed ${vit.bleedCriticality}).`
  );
  log.push(
    `Compiled HP ${prevPool.toFixed(1)} → ${defBase.healthCurrent.toFixed(1)}/${defBase.health} (part vitality ${(derived.vitalityRatio * 100).toFixed(1)}%, blood ${(blood.remainingFraction * 100).toFixed(0)}% of ${blood.volumeLiters.toFixed(2)} L).`
  );
  if (derived.totalBleedRate > 0) {
    log.push(
      `Bleed rate now ${derived.totalBleedRate.toFixed(2)} (${vit.bleedCriticality} tier on ${formatBodyPartLabel(bodypart)}).`
    );
  }

  // —— Gear pressure: soft outfit wrecks hard; plate paced + metal clash ——
  const layers = getProtectingArmor(
    bodypart,
    defender.unit.equipment,
    defender.itemsById
  );
  const armorLosses: BasicAttackResult['armorLosses'] = [];
  const outfitsRuined: string[] = [];

  layers.forEach((layer, index) => {
    const item = defender.itemsById[layer.instance.id];
    if (!item || item.itemType !== 'armor') return;

    const softOutfit =
      isSoftMaterial(item.material) && isOutfitSlot(item.slot);
    const wasIntact = item.durability > 0;

    const loss = calcArmorDurabilityLoss(item, {
      attackerAtkValue: atk.attackValue,
      attackerWeaponHardness: atk.weaponHardness,
      layerIndex: index,
      isOutermost: index === 0,
    });
    if (loss <= 0) return;

    item.durability = Math.max(0, roundToThousandths(item.durability - loss));
    const ruined = wasIntact && item.durability <= 0 && softOutfit;
    if (ruined) outfitsRuined.push(item.name);

    armorLosses.push({
      slot: item.slot,
      name: item.name,
      loss,
      remaining: item.durability,
      softOutfit,
      ruined,
    });

    if (softOutfit) {
      log.push(
        ruined
          ? `${defender.unit.name}'s ${item.name} is ruined — fabric gives way (${item.slot}).`
          : `${defender.unit.name}'s ${item.name} is torn (−${loss} → ${item.durability.toFixed(3)}).`
      );
    } else {
      log.push(
        `${item.name} (${item.slot}) durability −${loss} → ${item.durability.toFixed(3)}.`
      );
    }
  });

  if (layers.length === 0) {
    log.push(
      `${defender.unit.name} has no armor on that zone — the blow lands on bare flesh.`
    );
  }

  // —— Weapon durability (costly vs plate; cheap vs cloth/flesh) ——
  let weaponLoss = 0;
  if (mainhand) {
    const outerMat = layers[0]?.instance.material ?? null;
    const defendingHardness = layers[0]?.material.durability ?? 1;
    const wearTarget = classifyWeaponWearTarget(outerMat);
    weaponLoss = calcWeaponDurabilityLoss(
      mainhand,
      atk.attackBase,
      defendingHardness,
      wearTarget
    );
    if (weaponLoss > 0) {
      mainhand.durability = Math.max(
        0,
        roundToThousandths(mainhand.durability - weaponLoss)
      );
      log.push(
        `${mainhand.name} durability −${weaponLoss} → ${mainhand.durability.toFixed(3)} (vs ${wearTarget}).`
      );
    }
  }

  // —— Stamina: formulaic swing cost + hit absorption ——
  const twoHanding =
    !!(
      mainhand &&
      getItemTemplate(mainhand.templateId)?.flags?.twoHandOptional
    ) &&
    !offhandIsShield &&
    offhandWeight <= 0;
  const attackerStaminaLoss = calcAttackerSwingStamina({
    attacker: attacker.unit,
    mainhand,
    offhandWeight,
    twoHanding,
  });
  const surface = classifyDefenderSurface(layers[0]?.instance.material);
  const defenderStaminaLoss = calcDefenderHitStamina({
    attacker: attacker.unit,
    defender: defender.unit,
    bodypart,
    attackValue: atk.attackValue,
    damagePercent: dmg.damagePercent,
    surface,
  });
  atkBase.staminaCurrent = Math.max(
    0,
    roundToThousandths(atkBase.staminaCurrent - attackerStaminaLoss)
  );
  defBase.staminaCurrent = Math.max(
    0,
    roundToThousandths(defBase.staminaCurrent - defenderStaminaLoss)
  );
  log.push(
    `Stamina: ${attacker.unit.name} swing −${attackerStaminaLoss} → ${atkBase.staminaCurrent}; ${defender.unit.name} hit (${surface}, ${formatBodyPartLabel(bodypart)}) −${defenderStaminaLoss} → ${defBase.staminaCurrent}.`
  );

  // Skill gains on connect — flat additives from COMBAT_TUNING.training
  const train = COMBAT_TUNING.training;
  const skillKey = atk.weaponType as WeaponTypeId;
  const prevSkill = attacker.unit.combatStats.weaponSkill[skillKey] ?? 1;
  attacker.unit.combatStats.weaponSkill[skillKey] = roundToThousandths(
    prevSkill + train.weaponSkillBumpOnHit
  );

  const prevStrike = attacker.unit.combatStats.stanceSkill[atkStance.strike] ?? 1;
  attacker.unit.combatStats.stanceSkill[atkStance.strike] = roundToThousandths(
    prevStrike + train.strikeSkillBumpOnHit
  );
  const prevCover = defender.unit.combatStats.stanceSkill[defStance.cover] ?? 1;
  defender.unit.combatStats.stanceSkill[defStance.cover] = roundToThousandths(
    prevCover + train.coverSkillBumpOnHit
  );

  return {
    log,
    bodypart,
    damagePercent: dmg.damagePercent,
    attackValue: atk.attackValue,
    totalMitigation: dmg.totalMitigation,
    mitigationMultiplier: dmg.mitigationMultiplier,
    armorLosses,
    outfitsRuined,
    weaponLoss,
    attackerStaminaLoss,
    defenderStaminaLoss,
    attacker,
    defender,
    stance,
  };
}

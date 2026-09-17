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
import { applyArmorPanelHitWear } from '../items/panelDurability';
import { getProtectingArmor, calcItemWeight } from '../items/resolveItem';
import { calcMainhandAttackValue } from './calcAttackValue';
import { calcCombatDamage } from './calcCombatDamage';
import {
  calcArmorDurabilityLoss,
  calcShieldDurabilityLoss,
  calcWeaponDurabilityLoss,
  classifyWeaponWearTarget,
} from './calcDurabilityLoss';
import { calcBlockStats } from './calcBlockStats';
import {
  calcAttackerSwingStamina,
  calcBlockStamina,
  calcDefenderHitStamina,
  classifyDefenderSurface,
} from './calcStaminaLoss';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import { getMaterial } from '../../data/combat/materials';
import { bruiseFlavor } from './bruise';
import {
  ATTACK_MODE_LABELS,
  resolveBleedSplitForAttack,
} from './damageTypes';
import { calcTraumaPenalties } from './traumaFlags';
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
    /** Coverage-scaled chip applied to the hit panel. */
    loss: number;
    /** Derived whole-item durability after the hit. */
    remaining: number;
    /** Remaining integrity of the struck panel. */
    panelRemaining: number;
    bodypart: BodyPartId;
    coverageScale: number;
    softOutfit: boolean;
    /** Soft outfit: struck panel went to 0 this hit. */
    ruined: boolean;
  }[];
  /** Soft outfit pieces whose hit-location panel shredded this strike. */
  outfitsRuined: string[];
  weaponLoss: number;
  shieldLoss: number;
  blocked: boolean;
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
  /** Injected RNG (block roll); default Math.random. */
  rng?: () => number;
  /**
   * External vs internal bleed split for this hit.
   * If omitted, derived from attackMode / weapon default.
   */
  bleedSplit?: import('./bleedSplit').BleedSplit;
  /** Slash / thrust / blunt / unarmed — drives bleed split when bleedSplit omitted. */
  attackMode?: import('./damageTypes').AttackMode;
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
  if (atk.weaponBroken && mainhand) {
    log.push(
      `${mainhand.name} is broken (dur ≤ ${(COMBAT_TUNING.weaponDurabilityAttack.brokenRatio * 100).toFixed(0)}%) — swing collapses to unequipped/punch.`
    );
  } else if (mainhand && atk.durabilityAttackMult < 0.999) {
    log.push(
      `Weapon wear flavor ×${atk.durabilityAttackMult.toFixed(3)} (intact; soft until broken).`
    );
  }
  const { mode: attackMode, split: bleedSplit } = resolveBleedSplitForAttack(
    atk.weaponType,
    { attackMode: opts.attackMode, bleedSplit: opts.bleedSplit }
  );
  log.push(
    `Attack value ${roundToThousandths(atk.attackValue)} with ${atk.weaponType} · ${ATTACK_MODE_LABELS[attackMode].toLowerCase()} (${(bleedSplit.external * 100).toFixed(0)}% ext / ${(bleedSplit.internal * 100).toFixed(0)}% int)${
      critMultiplier > 1 ? ` (crit applied)` : ''
    }.`
  );

  const blockStats = calcBlockStats(defender.unit, defender.itemsById);
  const dmg = calcCombatDamage(
    atk.attackValue,
    defBase.health,
    bodypart,
    defender.unit.equipment,
    defender.itemsById,
    {
      blockChance: blockStats.chance,
      blockValue: blockStats.value,
      rng: opts.rng,
    }
  );

  if (dmg.blocked) {
    log.push(
      `${defender.unit.name} BLOCKS with shield (p=${blockStats.chance.toFixed(2)}, roll=${dmg.blockRoll.toFixed(2)}, absorb ${blockStats.value.toFixed(2)}) — through-block ${dmg.damageThroughBlock.toFixed(2)}; armor mit skipped.`
    );
  } else if (blockStats.hasShield) {
    log.push(
      `${defender.unit.name} fails to block (p=${blockStats.chance.toFixed(2)}, roll=${dmg.blockRoll.toFixed(2)}).`
    );
  }

  log.push(
    dmg.blocked
      ? `Blocked residual → part damage ${(dmg.damagePercent * 100).toFixed(1)}%.`
      : `Armor mitigation ${dmg.totalMitigation} → multiplier ${dmg.mitigationMultiplier}; damage to part ${(dmg.damagePercent * 100).toFixed(1)}%.`
  );

  // —— Apply itemized injury; pool HP is compiled from weighted parts ——
  const part = defender.unit.combatStats.itemizedHealth[bodypart];
  const prevPart = part.health;
  const prevPool = defBase.healthCurrent;
  part.health = Math.max(0, roundToThousandths(part.health - dmg.damagePercent));
  refreshBleedAfterInjury(defender.unit.combatStats.itemizedHealth, bodypart, {
    damagePercent: dmg.damagePercent,
    split: bleedSplit,
  });
  if (dmg.damagePercent > 0) {
    const partBleed = defender.unit.combatStats.itemizedHealth[bodypart];
    if (partBleed.bleed > 0 || partBleed.internalBleed > 0) {
      log.push(
        `Bleed channels on ${formatBodyPartLabel(bodypart)}: external ${(partBleed.bleed * 100).toFixed(0)}% · internal ${(partBleed.internalBleed * 100).toFixed(0)}%.`
      );
    }
    if ((partBleed.bruise ?? 0) > COMBAT_TUNING.bruise.minVisible) {
      const fl = bruiseFlavor(partBleed.bruise);
      log.push(
        `${formatBodyPartLabel(bodypart)}: ${fl.label} (${(partBleed.bruise * 100).toFixed(0)}%).`
      );
    }
  }

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

  // —— Gear pressure: on block, chip the shield; else armor panels ——
  const layers = getProtectingArmor(
    bodypart,
    defender.unit.equipment,
    defender.itemsById
  );
  const armorLosses: BasicAttackResult['armorLosses'] = [];
  const outfitsRuined: string[] = [];
  let shieldLoss = 0;

  if (dmg.blocked) {
    const shieldId = defender.unit.equipment.offhand;
    const shield = shieldId ? defender.itemsById[shieldId] : null;
    if (shield && shield.itemType === 'shield') {
      shieldLoss = calcShieldDurabilityLoss(
        shield,
        atk.attackBase,
        atk.weaponHardness
      );
      if (shieldLoss > 0) {
        shield.durability = Math.max(
          0,
          roundToThousandths(shield.durability - shieldLoss)
        );
        log.push(
          `${shield.name} (block) durability −${shieldLoss} → ${shield.durability.toFixed(3)}.`
        );
      }
    }
  } else {
    layers.forEach((layer, index) => {
      const item = defender.itemsById[layer.instance.id];
      if (!item || item.itemType !== 'armor') return;

      const softOutfit =
        isSoftMaterial(item.material) && isOutfitSlot(item.slot);

      const baseLoss = calcArmorDurabilityLoss(item, {
        attackerAtkValue: atk.attackValue,
        attackerWeaponHardness: atk.weaponHardness,
        layerIndex: index,
        isOutermost: index === 0,
      });
      if (baseLoss <= 0) return;

      const wear = applyArmorPanelHitWear(
        item,
        layer.coverage,
        bodypart,
        baseLoss
      );
      if (wear.panelLoss <= 0 && wear.coverageScale <= 0) return;

      const ruined = softOutfit && wear.panelRuined;
      if (ruined) outfitsRuined.push(item.name);

      armorLosses.push({
        slot: item.slot,
        name: item.name,
        loss: wear.panelLoss,
        remaining: wear.derivedDurability,
        panelRemaining: wear.panelAfter,
        bodypart,
        coverageScale: wear.coverageScale,
        softOutfit,
        ruined,
      });

      const partLabel = formatBodyPartLabel(bodypart);
      if (softOutfit) {
        log.push(
          ruined
            ? `${defender.unit.name}'s ${item.name} is ruined at ${partLabel} — fabric gives way (${item.slot}).`
            : `${defender.unit.name}'s ${item.name} tears at ${partLabel} (−${wear.panelLoss.toFixed(3)} panel → ${wear.panelAfter.toFixed(3)}; piece ${wear.derivedDurability.toFixed(3)}).`
        );
      } else {
        log.push(
          `${item.name} (${item.slot}) ${partLabel} panel −${wear.panelLoss.toFixed(3)} → ${wear.panelAfter.toFixed(3)} (piece ${wear.derivedDurability.toFixed(3)}; cov ×${wear.coverageScale.toFixed(2)}).`
        );
      }
    });

    if (layers.length === 0) {
      log.push(
        `${defender.unit.name} has no armor on that zone — the blow lands on bare flesh.`
      );
    }
  }

  // —— Weapon durability (vs shield when blocked; else outer armor/flesh) ——
  let weaponLoss = 0;
  if (mainhand) {
    let outerMat = layers[0]?.instance.material ?? null;
    let defendingHardness = layers[0]?.material.durability ?? 1;
    if (dmg.blocked) {
      const shieldId = defender.unit.equipment.offhand;
      const shield = shieldId ? defender.itemsById[shieldId] : null;
      if (shield) {
        outerMat = shield.material;
        defendingHardness = getMaterial(shield.material).durability;
      }
    }
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
  const surface = dmg.blocked
    ? classifyDefenderSurface(
        defender.unit.equipment.offhand
          ? defender.itemsById[defender.unit.equipment.offhand]?.material
          : null
      )
    : classifyDefenderSurface(layers[0]?.instance.material);
  let defenderStaminaLoss = 0;
  if (dmg.blocked) {
    const traumaStam = calcTraumaPenalties(
      defender.unit.combatStats.itemizedHealth
    ).staminaDrainMult;
    defenderStaminaLoss = calcBlockStamina({
      attackerCon: atkBase.constitution,
      defenderCon: defBase.constitution,
      staminaDrainMult: traumaStam,
    });
    if (dmg.damagePercent > 0) {
      defenderStaminaLoss = roundToThousandths(
        defenderStaminaLoss +
          calcDefenderHitStamina({
            attacker: attacker.unit,
            defender: defender.unit,
            bodypart,
            attackValue: dmg.damageThroughBlock,
            damagePercent: dmg.damagePercent,
            surface,
          }) *
            0.5
      );
    }
  } else {
    defenderStaminaLoss = calcDefenderHitStamina({
      attacker: attacker.unit,
      defender: defender.unit,
      bodypart,
      attackValue: atk.attackValue,
      damagePercent: dmg.damagePercent,
      surface,
    });
  }
  atkBase.staminaCurrent = Math.max(
    0,
    roundToThousandths(atkBase.staminaCurrent - attackerStaminaLoss)
  );
  defBase.staminaCurrent = Math.max(
    0,
    roundToThousandths(defBase.staminaCurrent - defenderStaminaLoss)
  );
  log.push(
    `Stamina: ${attacker.unit.name} swing −${attackerStaminaLoss} → ${atkBase.staminaCurrent}; ${defender.unit.name} ${
      dmg.blocked ? 'block' : 'hit'
    } (${surface}, ${formatBodyPartLabel(bodypart)}) −${defenderStaminaLoss} → ${defBase.staminaCurrent}.`
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
    shieldLoss,
    blocked: dmg.blocked,
    attackerStaminaLoss,
    defenderStaminaLoss,
    attacker,
    defender,
    stance,
  };
}

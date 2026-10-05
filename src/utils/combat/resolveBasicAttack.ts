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
import { modifyBlockChance } from './defenseRhythm';
import {
  calcAttackerSwingStamina,
  calcBlockStamina,
  calcDefenderHitStamina,
  classifyDefenderSurface,
} from './calcStaminaLoss';
import { getItemTemplate } from '../../data/catalog/itemTemplates';
import { getMaterial } from '../../data/combat/materials';
import { bruiseFlavor } from './bruise';
import { formatAimSpillPreview } from './aimSpill';
import { formatOrgansSummary, resolveOrganPierce } from './organPierce';
import {
  ATTACK_MODE_LABELS,
  resolveBleedSplitForAttack,
} from './damageTypes';
import { calcTraumaPenalties } from './traumaFlags';
import {
  resolveShieldBlock,
  type BlockStyle,
  type ResolveShieldBlockResult,
} from './resolveShieldBlock';
import { skillTrainingAptitude } from './rhythmCompetence';
import {
  calcSensoryPerformance,
  syncConcussionFlag,
} from './sensoryPerformance';
import { resolveAttackWeapon } from './limbAttack';
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
  /** Present when blocked — arm overload / flat vs redirect. */
  shieldBlock: ResolveShieldBlockResult | null;
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
  /** Slash / thrust / blunt / unarmed / projectile — bleed + glancing. */
  attackMode?: import('./damageTypes').AttackMode;
  /** Projectile path — bodkin skips mail/leather glance. */
  arrowHeadStyle?: import('../../types/items').ArrowHeadStyle | null;
  /** When set, replaces melee attackValue (ranged energy path). */
  overrideAttackValue?: number;
  /** When set, replaces swing stamina cost (e.g. bow draw). */
  attackerStaminaOverride?: number;
  /** Prefixed log lines (ranged meta). */
  prependLog?: string[];
  /**
   * When set, replaces melee ATTACK_TARGETS[aim] before cover remap
   * (ranged chest splash / custom tables).
   */
  hitRatioOverride?: Partial<Record<BodyPartId, number>>;
  /**
   * Shield block resolution:
   * - `roll` (default): RNG vs modified block chance (legs aim tax applied)
   * - `force`: player block QTE success — cover aim, skip roll
   * - `skip`: player block QTE fail / no shield path — do not roll block
   */
  blockOutcome?: 'roll' | 'force' | 'skip';
  /**
   * Flat (inferior / hit-band) vs redirecting (superior / crit-band).
   * Redirect counts overload at 50%. Defaults to flat.
   */
  blockStyle?: BlockStyle;
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
  const log: string[] = [...(opts.prependLog ?? [])];
  const critMultiplier =
    opts.critMultiplier != null && opts.critMultiplier > 1
      ? opts.critMultiplier
      : 1;

  const atkBase = attacker.unit.combatStats.base;
  const defBase = defender.unit.combatStats.base;

  const mainIdEquipped = attacker.unit.equipment.mainhand;
  const mainhandEquipped = mainIdEquipped
    ? attacker.itemsById[mainIdEquipped] ?? null
    : null;
  const resolved = resolveAttackWeapon(attacker.unit, attacker.itemsById);
  const attackWeapon = resolved.weapon;
  const offId = attacker.unit.equipment.offhand;
  const offhand = offId ? attacker.itemsById[offId] ?? null : null;
  // Offhand "occupied" for grip: shield, or a weapon that is NOT the attacking weapon.
  const offhandIsShield = offhand?.itemType === 'shield';
  const offhandOccupied =
    !!offhand &&
    (offhandIsShield ||
      (offhand.itemType === 'weapon' && resolved.slot === 'mainhand'));
  const offTemplate = offhand ? getItemTemplate(offhand.templateId) : null;
  const offhandWeight =
    offhandOccupied && offhand && offTemplate
      ? calcItemWeight(offTemplate)
      : 0;

  const atkBlood = getBloodStatus(attacker.unit);
  const atkBloodPen = calcBloodCombatPenalties(atkBlood.remainingFraction);
  const atk = calcMainhandAttackValue(
    atkBase,
    attacker.unit.combatStats.itemizedHealth,
    attacker.unit.combatStats.weaponSkill,
    attackWeapon,
    offhandIsShield && resolved.slot === 'mainhand',
    offhandWeight,
    {
      bloodRemainingFraction: atkBlood.remainingFraction,
      bloodStaminaFactor: atkBloodPen.stamina,
      bloodAttackFactor: atkBloodPen.attack,
    },
    {
      dominantHand: attacker.unit.combatStats.dominantHand ?? 'right',
      attackSlot: resolved.slot,
      offhandOccupied,
    }
  );
  // Offhand-slot weapon: skill tax (competence / miss use effective skill elsewhere).
  if (resolved.isOffhandSlot && resolved.offhandSkillFactor < 1) {
    log.push(
      `${attacker.unit.name} fights offhand (×${resolved.offhandSkillFactor.toFixed(2)} skill; training ${(attacker.unit.combatStats.offhandTraining ?? 0).toFixed(2)}).`
    );
  }
  if (atk.limbAttack && atk.limbAttackMult < 0.999) {
    const la = atk.limbAttack;
    log.push(
      `Weapon-arm (${la.side}) integrity ×${atk.limbAttackMult.toFixed(2)} (${la.mode}; L ${la.leftIntegrity.toFixed(2)} / R ${la.rightIntegrity.toFixed(2)}).`
    );
  } else if (atk.limbAttack?.mode === 'oneHandFallback') {
    log.push(
      `${attacker.unit.name} one-hands the weapon off the ${atk.limbAttack.side} arm (two-hand grip compromised).`
    );
  }
  if (opts.overrideAttackValue != null) {
    atk.attackValue = opts.overrideAttackValue;
  }
  if (critMultiplier > 1 && opts.overrideAttackValue == null) {
    atk.attackValue = roundToThousandths(atk.attackValue * critMultiplier);
  } else if (critMultiplier > 1 && opts.overrideAttackValue != null) {
    // Ranged path already baked crit into override when desired.
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
  const atkSensory = calcSensoryPerformance(
    attacker.unit.combatStats.itemizedHealth
  );
  const spillSkills = {
    attackerWeaponSkill:
      ((attacker.unit.combatStats.weaponSkill as Record<string, number>)[
        atk.weaponType
      ] ?? 1) * resolved.offhandSkillFactor,
    attackerSkill: atkBase.skill * resolved.offhandSkillFactor,
    defenderCoverSkill:
      (defender.unit.combatStats.stanceSkill as Record<string, number>)[
        defStance.cover
      ] ?? 1,
    attackerFocusMult: atkSensory.focusMult,
  };
  if (atkSensory.focusMult < 0.999) {
    log.push(
      `${attacker.unit.name} sensory focus ×${atkSensory.focusMult.toFixed(2)} (accuracy ×${atkSensory.accuracyMult.toFixed(2)}${atkSensory.concussed ? `, concussed skill ×${atkSensory.skillMult.toFixed(2)}` : ''}).`
    );
  }
  const bodypart = pickBodyPartWithStance(
    attackTarget,
    defStance.cover,
    opts.hitRatioOverride,
    opts.rng,
    spillSkills
  );
  const presented = summarizeRemappedAim(
    attackTarget,
    defStance.cover,
    4,
    opts.hitRatioOverride,
    spillSkills
  );
  log.push(
    `${attacker.unit.name} ${atkStance.strike} (rank ${stance.strikeRank}) vs ${defender.unit.name} ${defStance.cover} (rank ${stance.coverRank}).`
  );
  log.push(formatMatchupPreview(stance));
  log.push(formatAimSpillPreview(spillSkills) + '.');
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
  if (
    mainhandEquipped &&
    mainhandEquipped.itemType === 'weapon' &&
    !attackWeapon &&
    resolved.slot === 'mainhand'
  ) {
    log.push(
      `${mainhandEquipped.name} is broken (dur ≤ ${(COMBAT_TUNING.weaponDurabilityAttack.brokenRatio * 100).toFixed(0)}%) — swing collapses to unequipped/punch.`
    );
  } else if (attackWeapon && atk.durabilityAttackMult < 0.999) {
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
  const blockOutcome = opts.blockOutcome ?? 'roll';
  let blockChanceForRoll = 0;
  if (blockOutcome === 'force') {
    blockChanceForRoll = blockStats.hasShield ? 1 : 0;
  } else if (blockOutcome === 'skip') {
    blockChanceForRoll = 0;
  } else if (blockStats.hasShield) {
    // NPC / bypass path: legs-aim tax only (no prior-attempt tax).
    const offIdDef = defender.unit.equipment.offhand;
    const offShield = offIdDef ? defender.itemsById[offIdDef] : null;
    const shieldTypeId =
      offShield?.shieldType ??
      (offShield ? getItemTemplate(offShield.templateId)?.shieldType : null) ??
      null;
    blockChanceForRoll = modifyBlockChance(blockStats.chance, {
      aim: attackTarget,
      shieldTypeId,
    });
  }
  const dmg = calcCombatDamage(
    atk.attackValue,
    defBase.health,
    bodypart,
    defender.unit.equipment,
    defender.itemsById,
    {
      blockChance: blockChanceForRoll,
      blockValue: blockStats.value,
      rng: blockOutcome === 'force' ? () => 0 : opts.rng,
    },
    {
      attackMode,
      arrowHeadStyle: opts.arrowHeadStyle,
      rng: opts.rng,
    }
  );

  const blockStyle: BlockStyle = opts.blockStyle ?? 'flat';
  let shieldBlock: ResolveShieldBlockResult | null = null;
  if (dmg.blocked) {
    shieldBlock = resolveShieldBlock({
      attackValue: atk.attackValue,
      blockValue: blockStats.value,
      style: blockStyle,
      itemized: defender.unit.combatStats.itemizedHealth,
      apply: true,
    });
    const how =
      blockOutcome === 'force'
        ? 'QTE'
        : `p=${blockChanceForRoll.toFixed(2)}, roll=${dmg.blockRoll.toFixed(2)}`;
    const styleLabel =
      blockStyle === 'redirect' ? 'redirecting' : 'flat';
    log.push(
      `${defender.unit.name} BLOCKS with shield (${how}, ${styleLabel}, capacity ${blockStats.value.toFixed(2)}) — aimed part covered; armor mit skipped.`
    );
    if (shieldBlock.withinCapacity) {
      log.push(
        `Shield holds within capacity (atk ${atk.attackValue.toFixed(2)} ≤ ${blockStats.value.toFixed(2)}).`
      );
    } else {
      const armLabel = formatBodyPartLabel(shieldBlock.armPart);
      const excessNote =
        blockStyle === 'redirect'
          ? `excess ×${COMBAT_TUNING.shieldBlock.redirectOverloadMult} redirect → ${shieldBlock.excessRatioEffective.toFixed(2)}`
          : `excess ${shieldBlock.excessRatioEffective.toFixed(2)}`;
      log.push(
        `Shield overload on ${armLabel} (${excessNote}, band ${shieldBlock.band}).`
      );
      if (shieldBlock.bruiseGained) {
        const fl = bruiseFlavor(shieldBlock.bruiseAfter);
        log.push(
          `${armLabel}: ${fl.label} (${(shieldBlock.bruiseAfter * 100).toFixed(0)}%) from block shock.`
        );
      }
      if (shieldBlock.traumaApplied !== 'none') {
        log.push(
          `${armLabel} trauma → ${shieldBlock.traumaApplied} (shield-arm overload).`
        );
      } else if (
        shieldBlock.traumaDesired !== 'none' &&
        shieldBlock.traumaApplied === 'none'
      ) {
        log.push(
          `${armLabel}: comparative overload suggested ${shieldBlock.traumaDesired}, but attack force is below the absolute trauma floor.`
        );
      }
    }
  } else if (blockStats.hasShield && blockOutcome !== 'skip') {
    log.push(
      `${defender.unit.name} fails to block (p=${blockChanceForRoll.toFixed(2)}, roll=${dmg.blockRoll.toFixed(2)}).`
    );
  } else if (blockStats.hasShield && blockOutcome === 'skip') {
    log.push(`${defender.unit.name} mistimes the shield — no block.`);
  }

  if (!dmg.blocked && dmg.glance?.glanced) {
    log.push(
      `Glancing blow on ${dmg.glance.layerName ?? 'armor'} (${dmg.glance.reason ?? dmg.glance.armorClass}) — wound ×${dmg.glance.fraction}.`
    );
  } else if (!dmg.blocked && dmg.glance && !dmg.glance.glanced && dmg.glance.armorClass) {
    if (dmg.glance.coverageRoll != null) {
      log.push(
        `No glance — ${dmg.glance.reason ?? 'coverage gap'} on ${dmg.glance.layerName ?? dmg.glance.armorClass}.`
      );
    }
  }

  log.push(
    dmg.blocked
      ? `Aimed part takes no wound from the block (covered).`
      : `Armor mitigation ${dmg.totalMitigation} → multiplier ${dmg.mitigationMultiplier}${
          dmg.glance?.glanced ? ` × glance ${dmg.glance.fraction}` : ''
        }; damage to part ${(dmg.damagePercent * 100).toFixed(1)}%.`
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
  const wasConcussed = !!defender.unit.combatStats.itemizedHealth.head?.concussed;
  syncConcussionFlag(defender.unit.combatStats.itemizedHealth);
  if (
    !wasConcussed &&
    defender.unit.combatStats.itemizedHealth.head?.concussed
  ) {
    log.push(
      `${defender.unit.name} is concussed (head health ≤ ${(COMBAT_TUNING.sensory.concussionHealthThreshold * 100).toFixed(0)}%).`
    );
  }
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

    // Thrust → possible heart/lung pierce (hard chest armor deters).
    const organ = resolveOrganPierce({
      defender: defender.unit,
      itemsById: defender.itemsById,
      bodypart,
      damagePercent: dmg.damagePercent,
      attackMode,
      weaponType: atk.weaponType,
      stanceRelation: stance.relation,
      attackerSkill: atkBase.skill,
      attackerWeaponSkill:
        (attacker.unit.combatStats.weaponSkill as Record<string, number>)[
          atk.weaponType
        ] ?? 1,
      rng: opts.rng,
    });
    for (const line of organ.log) log.push(line);
    const organSummary = formatOrgansSummary(defender.unit.combatStats.organs);
    if (organSummary) {
      log.push(`Organs: ${organSummary}${defender.unit.combatStats.incapacitated ? ' · INCAPACITATED' : ''}.`);
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
        attackerWeaponType: atk.weaponType,
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
  if (attackWeapon) {
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
      attackWeapon,
      atk.attackBase,
      defendingHardness,
      wearTarget
    );
    if (weaponLoss > 0) {
      attackWeapon.durability = Math.max(
        0,
        roundToThousandths(attackWeapon.durability - weaponLoss)
      );
      log.push(
        `${attackWeapon.name} durability −${weaponLoss} → ${attackWeapon.durability.toFixed(3)} (vs ${wearTarget}).`
      );
    }
  }

  // —— Stamina: formulaic swing cost + hit absorption ——
  const twoHanding =
    atk.limbAttack?.mode === 'twoHand' ||
    (!offhandOccupied &&
      !!attackWeapon &&
      !!getItemTemplate(attackWeapon.templateId)?.flags?.twoHandOptional);
  const attackerStaminaLoss =
    opts.attackerStaminaOverride != null
      ? opts.attackerStaminaOverride
      : calcAttackerSwingStamina({
          attacker: attacker.unit,
          mainhand: attackWeapon,
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
      defender.unit.combatStats.itemizedHealth,
      defender.unit.combatStats.organs
    ).staminaDrainMult;
    defenderStaminaLoss = calcBlockStamina({
      attackerCon: atkBase.constitution,
      defenderCon: defBase.constitution,
      attackValue: atk.attackValue,
      excessRatioEffective: shieldBlock?.excessRatioEffective ?? 0,
      staminaDrainMult: traumaStam,
    });
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

  // Skill gains on connect — base bumps × SKL aptitude (concussion impairs learning)
  const train = COMBAT_TUNING.training;
  const atkApt = skillTrainingAptitude(
    atkBase.skill,
    attacker.unit.combatStats.itemizedHealth
  );
  const defApt = skillTrainingAptitude(
    defBase.skill,
    defender.unit.combatStats.itemizedHealth
  );
  const skillKey = atk.weaponType as WeaponTypeId;
  const weaponBump = train.weaponSkillBumpOnHit * atkApt;
  const strikeBump = train.strikeSkillBumpOnHit * atkApt;
  const coverBump = train.coverSkillBumpOnHit * defApt;

  const prevSkill = attacker.unit.combatStats.weaponSkill[skillKey] ?? 1;
  attacker.unit.combatStats.weaponSkill[skillKey] = roundToThousandths(
    prevSkill + weaponBump
  );

  const prevStrike = attacker.unit.combatStats.stanceSkill[atkStance.strike] ?? 1;
  attacker.unit.combatStats.stanceSkill[atkStance.strike] = roundToThousandths(
    prevStrike + strikeBump
  );
  const prevCover = defender.unit.combatStats.stanceSkill[defStance.cover] ?? 1;
  defender.unit.combatStats.stanceSkill[defStance.cover] = roundToThousandths(
    prevCover + coverBump
  );
  log.push(
    `Training: ${attacker.unit.name} ${skillKey}/strike +${weaponBump.toFixed(3)}/+${strikeBump.toFixed(3)} (SKL apt ×${atkApt.toFixed(2)}); ${defender.unit.name} cover +${coverBump.toFixed(3)} (×${defApt.toFixed(2)}).`
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
    shieldBlock,
    attackerStaminaLoss,
    defenderStaminaLoss,
    attacker,
    defender,
    stance,
  };
}

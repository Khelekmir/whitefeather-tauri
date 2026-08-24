// CLEANED: Offhand removed
import { getRandomHitZone } from "./GetRandomHitZone";
import { calcCombatDamage } from "./CalcCombatDamage";
import {
    attackTargets,
    bodypartArmorAssignments,
    equipmentKeys,
    roundToThousandths,
    equipmentMaterial,
    bodypartDescriptors,
} from "./CombatConfig";
import { buildMinimalPatch } from "./ObjectPatchUtils";
import { calcStaminaLoss } from "./CalcStaminaLoss";
import { calcArmorDurabilityLoss } from "./CalcArmorDurabilityLoss";
import { calcShieldDurabilityLoss } from "./CalcShieldDurabilityLoss";
import { calcWeaponDurabilityLoss } from "./CalcWeaponDurabilityLoss";
import { calcWeaponSkillIncrease } from "./CalcWeaponSkillIncrease";
import { parseCombatTotals } from "./ParseCombatantTotals";
import { calcWeaponParryLoss } from "./CalcWeaponParryLoss";

export function resolveAttack({
    attacker,
    attackerEquipmentWeight,
    attackTarget,
    defender,
    defenderEquipmentWeight,
    attackHitBool,
    attackCritBool,
    specialAttack = false,
    isOffhandAttack = false
}) {
    const combatLog = [];

    const attackerWeaponTypeUsed = isOffhandAttack
        ? attacker.offhand.combatStats.weaponType
        : attacker.mainhand.combatStats.weaponType;
    const defenderWeaponTypeUsed = defender.mainhand.combatStats.weaponType;

    const equippedItems = equipmentKeys.map(key => defender[key]);

    const combatInputsFinal = parseCombatTotals(attacker, defender, isOffhandAttack);

    let {
        attackValueMainhand,
        attackValueOffhand,
        attackBase,
        dodgeChance,
        parryChance,
        hitChance,
        blockValue,
        blockChance,
        armorEffectivenessMultiplier
    } = combatInputsFinal;

    if (hitChance > 1) {
        dodgeChance -= (hitChance - 1);
    }

    const attackDodgeBool = Math.random() < dodgeChance;
    const attackParryBool = Math.random() < parryChance;

    let updatedAttackerCombatStats = JSON.parse(JSON.stringify(attacker.combatStats));
    let updatedDefenderCombatStats = JSON.parse(JSON.stringify(defender.combatStats));
    let attackBodypartHit = getRandomHitZone(defender.combatStats.base.healthCurrent, defender.combatStats.base.health, attackTargets, attackTarget, defender.combatStats.itemizedHealth);
    let attackHitResult = "attackMiss";
    let attackBlocked = false;
    let defenderStaminaLoss = 0;
    let attackerStaminaLoss = 0;

    // Cache material data
    const attackerWeaponMaterial = isOffhandAttack ? attacker.offhand.combatStats.material : attacker.mainhand.combatStats.material;
    const defenderWeaponMaterial = defender.mainhand.combatStats.material;
    const defenderShieldMaterial = defender.offhand?.combatStats.material || null;

    let defenderPrimaryArmorMaterial = 'cloth';
    if (attackBodypartHit !== "miss") {
        defenderPrimaryArmorMaterial = defender[bodypartArmorAssignments[attackBodypartHit]?.[0]]?.combatStats.itemType || 'cloth';
    }

    const attackerWeaponMaterialData = equipmentMaterial[attackerWeaponMaterial] || { durability: 1 };
    const defenderWeaponMaterialData = equipmentMaterial[defenderWeaponMaterial] || { durability: 1 };
    const defenderShieldMaterialData = equipmentMaterial[defenderShieldMaterial] || { durability: 1 };
    const defenderPrimaryArmorMaterialData = equipmentMaterial[defenderPrimaryArmorMaterial] || { durability: 1 };

    const attackerWeaponHardness = attackerWeaponMaterialData.durability;
    const defenderWeaponHardness = defenderWeaponMaterialData.durability;
    const defenderShieldHardness = defenderShieldMaterialData.durability;
    const defenderPrimaryArmorHardness = defenderPrimaryArmorMaterialData.durability;

    const updatedDefenderEquipment = {};
    const updatedAttackerEquipment = {};

    // Consolidated miss/dodge/parry checks with early handling
    if (!attackHitBool || attackBodypartHit === "miss" || attackDodgeBool || attackParryBool) {
        if (!attackHitBool) {
            attackHitResult = "attackMiss";
            combatLog.push(`${attacker.name}'s attack misses ${defender.name}.`);
        } else if (attackBodypartHit === "miss") {
            attackHitResult = "attackMiss";
            combatLog.push(`${attacker.name}'s attack misses ${defender.name} (version 2)`);
        } else if (attackDodgeBool) {
            attackBodypartHit = "miss";
            attackHitResult = "attackDodge";
            combatLog.push(`${defender.name} dodges ${attacker.name}'s attack.`);
        } else if (attackParryBool && defender.mainhand.combatStats.durability > 0) {
            attackBodypartHit = "miss";
            attackHitResult = "attackParry";
            combatLog.push(`${defender.name} parries ${attacker.name}'s attack.`);

            // Weapon durability loss for parry
            const parryLoss = calcWeaponParryLoss(attacker, defender);
            const defParryLoss = parryLoss.defDurabilityLoss;
            const atkParryLoss = parryLoss.atkDurabilityLoss;

            const defenderMainhand = defender.mainhand;
            const newDefenderWeapDurability = Math.max(0, roundToThousandths(defenderMainhand.combatStats.durability - defParryLoss));
            updatedDefenderEquipment.mainhand = {
                ...defenderMainhand,
                combatStats: {
                    ...defenderMainhand.combatStats,
                    durability: newDefenderWeapDurability
                }
            };

            const attackerMainhand = attacker.mainhand;
            const newAttackerWeapDurability = Math.max(0, roundToThousandths(attackerMainhand.combatStats.durability - atkParryLoss));
            updatedAttackerEquipment.mainhand = {
                ...attackerMainhand,
                combatStats: {
                    ...attackerMainhand.combatStats,
                    durability: newAttackerWeapDurability
                }
            };
        }
    } else {
        // Successful hit
        attackHitResult = "attackHit";
        const inputAttackValue = isOffhandAttack ? attackValueOffhand : attackValueMainhand;
        const attackDamageResult = calcCombatDamage(
            inputAttackValue,
            defender.combatStats.base.health,
            attackBodypartHit,
            equippedItems,
            blockValue,
            blockChance,
            armorEffectivenessMultiplier
        );
        attackBlocked = attackDamageResult.blocked;
        let attackDamage = attackDamageResult.damagePercent;
        const finalAttackValue = attackDamageResult.attackerAtkValue;
        if (attackCritBool) {
            attackDamage *= 2;
        }

        // Health loss - immutable update
        updatedDefenderCombatStats = {
            ...updatedDefenderCombatStats,
            itemizedHealth: {
                ...updatedDefenderCombatStats.itemizedHealth,
                [attackBodypartHit]: {
                    ...updatedDefenderCombatStats.itemizedHealth[attackBodypartHit],
                    health: Math.max(
                        0,
                        roundToThousandths(updatedDefenderCombatStats.itemizedHealth[attackBodypartHit].health - attackDamage)
                    )
                }
            }
        };

        // Durability loss - armor
        applyArmorDurabilityLoss({
            defender,
            bodypartHit: attackBodypartHit,
            attackValue: finalAttackValue,
            updatedEquipment: updatedDefenderEquipment,
            attackerWeaponHardness
        });

        // Shield durability loss
        if (defender.offhand?.itemType === "shield" && attackBlocked) {
            const defenderOffhand = defender.offhand;
            const loss = calcShieldDurabilityLoss(defenderOffhand, attackBase, attackerWeaponHardness);
            const newDurability = Math.max(0, roundToThousandths(defenderOffhand.combatStats.durability - loss));
            updatedDefenderEquipment.offhand = {
                ...defenderOffhand,
                combatStats: {
                    ...defenderOffhand.combatStats,
                    durability: newDurability
                }
            };
        }

        // Weapon durability - attacker
        const defenderMaterialHardness = attackBlocked ? defenderShieldHardness : defenderPrimaryArmorHardness;
        const attackerMainhand = attacker.mainhand;
        const hitLoss = calcWeaponDurabilityLoss(attackerMainhand, attackBase, defenderMaterialHardness);
        const newAttackerWeapDurability = Math.max(0, roundToThousandths(attackerMainhand.combatStats.durability - hitLoss));
        updatedAttackerEquipment.mainhand = {
            ...attackerMainhand,
            combatStats: {
                ...attackerMainhand.combatStats,
                durability: newAttackerWeapDurability
            }
        };

        // Combat log
        const critDescription = attackCritBool ? " (crit)" : "";
        const blockDescription = attackBlocked
            ? attackDamage === 0 ? " (fully blocked)" : " (partially blocked)"
            : "";
        combatLog.push(`${attacker.name}'s attack hits ${defender.name}'s ${bodypartDescriptors[attackBodypartHit]} for ${Math.round(attackDamage * 100)}% ${critDescription} ${blockDescription}.`);
    }

    // Consolidated stamina loss
    attackerStaminaLoss = calcStaminaLoss(attacker, defender, "attack", attackerEquipmentWeight);
    defenderStaminaLoss = attackBlocked
        ? calcStaminaLoss(attacker, defender, "attackBlocked", defenderEquipmentWeight)
        : calcStaminaLoss(attacker, defender, attackHitResult, defenderEquipmentWeight, attackBodypartHit);

    // Direct updates for stamina
    const attackerBase = updatedAttackerCombatStats.base;
    attackerBase.staminaCurrent = Math.max(0, roundToThousandths(attackerBase.staminaCurrent - attackerStaminaLoss));

    const defenderBase = updatedDefenderCombatStats.base;
    defenderBase.staminaCurrent = Math.max(0, roundToThousandths(defenderBase.staminaCurrent - defenderStaminaLoss));

    // Consolidated weapon skill increase
    const attackerWeaponSkill = updatedAttackerCombatStats.weaponSkill[attackerWeaponTypeUsed];
    const defenderWeaponSkill = updatedDefenderCombatStats.weaponSkill[defenderWeaponTypeUsed];
    const attackerSkillIncrease = calcWeaponSkillIncrease("attacker", attackHitResult, attackBlocked);
    const defenderSkillIncrease = calcWeaponSkillIncrease("defender", attackHitResult, attackBlocked);

    updatedAttackerCombatStats.weaponSkill[attackerWeaponTypeUsed] = attackerWeaponSkill + attackerSkillIncrease;
    updatedDefenderCombatStats.weaponSkill[defenderWeaponTypeUsed] = defenderWeaponSkill + defenderSkillIncrease;

    const defenderPatch = buildMinimalPatch(defender.combatStats, updatedDefenderCombatStats); // JSON parse this
    const attackerPatch = buildMinimalPatch(attacker.combatStats, updatedAttackerCombatStats); // JSON parse this

    return {
        combatLog,
        updatedAttackerCombatStats,
        updatedDefenderCombatStats,
        updatedDefenderEquipment,
        updatedAttackerEquipment,
        defenderPatch,
        attackerPatch
    };
}

function applyArmorDurabilityLoss({
    defender,
    bodypartHit,
    attackValue,
    updatedEquipment,
    attackerWeaponHardness
}) {
    const assignments = bodypartArmorAssignments[bodypartHit] || [];
    if (assignments.length === 0) return;

    const outermostSlot = assignments[0];
    const outerItem = defender[outermostSlot];
    const outerMaterial = equipmentMaterial[outerItem?.combatStats?.itemType] || equipmentMaterial["cloth"];
    const bleedThroughFactor = Math.max(0.05, 1 - (outerMaterial.durability + outerMaterial.strength) / 20);

    assignments.forEach((slot, index) => {
        const item = defender[slot];
        if (!item || item.itemType !== "armor") return;

        const layerScaling = index === 0 ? 1 : (1 / Math.pow(2, index)) * bleedThroughFactor;
        const loss = calcArmorDurabilityLoss(item, attackValue, layerScaling, attackerWeaponHardness);
        const newDurability = Math.max(0, roundToThousandths(item.combatStats.durability - loss));

        updatedEquipment[slot] = {
            ...item,
            combatStats: {
                ...item.combatStats,
                durability: newDurability
            }
        };
    });
}
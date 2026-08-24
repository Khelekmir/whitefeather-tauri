import { useContextStore } from "../ContextStore";
import { calcDurabilityPenalty } from "./CalcDurabilityPenalty";
import { calcHealthPenalty } from "./CalcHealthPenalty";
import { calcStaminaPenalty } from "./CalcStaminaPenalty";
import { calcWeightPenalty } from "./CalcWeightPenalty";
import { getWeaponSkill } from "./GetWeaponSkill";
import { shieldTypes, weaponTypes, equipmentMaterial, equipmentKeys } from "./CombatConfig";

export function calcDefenseTotals(character) {
    const baseStats = character.combatStats.base;
    const itemizedHealth = character.combatStats.itemizedHealth
    const combatStats = character.combatStats;
    const mainhand = character.mainhand;
    const offhand = character.offhand;
    const noWeapons = mainhand.combatStats.material === "body" && offhand.itemType !== "weapon";
    const shieldSkill = combatStats.weaponSkill["shield"];

    const mainWeaponStats = weaponTypes[mainhand.combatStats.weaponType];
    const mainMaterialStats = equipmentMaterial[mainhand.combatStats.material];

    let offhandStats = null;
    let offhandMaterialStats = null;

    const offhandUnequipped = offhand.itemType === "unequipped";
    const isShieldEquipped = offhand.itemType === "shield";
    const offhandIsWeapon = offhand.itemType === "weapon";

    if (isShieldEquipped) {
        offhandStats = shieldTypes[offhand.combatStats.shieldType]
        offhandMaterialStats = equipmentMaterial[offhand.combatStats.material];
    } else if (offhandIsWeapon) {
        offhandStats = weaponTypes[offhand.combatStats.weaponType];
        offhandMaterialStats = equipmentMaterial[offhand.combatStats.material];
    }

    const weaponWeight = mainWeaponStats.sizeFactor * mainMaterialStats.weight;
    const offhandWeight = offhandUnequipped ? 0 : offhandStats?.sizeFactor * offhandMaterialStats?.weight;

    // --- Base Calculations ---
    const baseDodgeChance = getDodgeChance(baseStats, weaponWeight, offhandWeight, itemizedHealth);
    const baseParryChance = getParryChance(baseStats, combatStats, mainhand, weaponWeight, offhandUnequipped, itemizedHealth);
    const { baseBlockChance, baseBlockValue } = getBlockStats(baseStats, offhand, isShieldEquipped, equipmentMaterial, shieldTypes, offhandMaterialStats, itemizedHealth, mainhand, weaponWeight, shieldSkill);

    const baseArmorValue = 0;

    // --- Totals ---
    const totals = {
        dodge: baseDodgeChance,
        block: baseBlockChance,
        parry: baseParryChance,
        blockValue: baseBlockValue,
    };

    // --- Apply Bonus Chance from Equipment ---
    equipmentKeys.forEach(slot => {
        const bonuses = character[slot]?.combatStats?.bonus?.chance;
        totals.dodge += bonuses?.dodge || 0;
        totals.block += isShieldEquipped ? bonuses?.block || 0 : 0;
        totals.parry += bonuses?.parry || 0;
    });

    // --- Apply Bonus Value from Equipment ---
    equipmentKeys.forEach(slot => {
        const item = character[slot];
        const { bonus } = item.combatStats;
        totals.blockValue += isShieldEquipped ? bonus.value.block || 0 : 0;
    });

    if (noWeapons) {
        totals.parry = 0;
    }

    return {
        base: {
            baseDodgeChance,
            baseBlockChance,
            baseParryChance,
            baseArmorValue,
            baseBlockValue,
        },
        total: totals,
    };
}

// --- Helper Functions ---

function getDodgeChance(stats, weaponWeight, offhandWeight, itemizedHealth) {

    const log50 = Math.log(50);
    // base value
    const baseValue = (Math.log(stats.agility) / log50) *
        (Math.log(stats.reflex) / log50) +
        ((stats.speed - stats.constitution) / 100) +
        (stats.luck / 200)

    // applied penalties
    const healthPenalty = calcHealthPenalty(itemizedHealth, "dodgeChance");
    const staminaPenalty = calcStaminaPenalty(stats.staminaCap, stats.staminaCurrent);
    const weightPenalty = calcWeightPenalty(stats.constitution, weaponWeight, offhandWeight);

    const penaltiesAppliedDodgeVal = baseValue * healthPenalty * staminaPenalty
        * (weightPenalty);

    return penaltiesAppliedDodgeVal;

}

function getParryChance(baseStats, combatStats, mainhand, weight, offhandUnequipped, itemizedHealth) {
    if (mainhand.flags.unequipped) return 0;
    // base value
    const log500 = Math.log(500);
    const weaponType = mainhand.combatStats.weaponType;
    const skillFactor = Math.log(baseStats.skill) / log500;
    const weaponSkillFactor = Math.log(getWeaponSkill(combatStats, weaponType)) / log500;
    const baseValue = skillFactor * weaponSkillFactor;

    // apply penalties
    const weightPenalty = calcWeightPenalty(baseStats.constitution, weight);
    const healthPenalty = calcHealthPenalty(itemizedHealth, "parryChance");
    const staminaPenalty = calcStaminaPenalty(baseStats.staminaCap, baseStats.staminaCurrent);
    const penaltiesAppliedParryVal = baseValue * weightPenalty * healthPenalty * staminaPenalty;


    // apply bonuses
    const twoHandingOneHanded = (mainhand.misc.twoHandOptional && offhandUnequipped);
    if (twoHandingOneHanded) {
        return penaltiesAppliedParryVal * (twoHandingOneHanded ? 1.5 : 1)
    }
    return penaltiesAppliedParryVal * (!offhandUnequipped ? 1.25 : 1);
}

function getBlockStats(baseStats, offhand, hasShield, materials, shieldTypes, mainMaterial, itemizedHealth, mainhand, weaponWeight, shieldSkill) {
    if (!hasShield) return { baseBlockChance: 0, baseBlockValue: 0 };

    const shieldType = shieldTypes[offhand.combatStats.shieldType];
    const shieldMaterial = materials[offhand.combatStats.material];
    const durability = offhand.combatStats.durability;
    const shieldWeight = shieldType.sizeFactor * shieldMaterial.weight;
    const noMainhand = mainhand.combatStats.material === "body";
    const weightPenalty = calcWeightPenalty(baseStats.constitution, weaponWeight, shieldWeight)
    const staminaPenalty = calcStaminaPenalty(baseStats.staminaCap, baseStats.staminaCurrent);
    const durabilityPenalty = calcDurabilityPenalty(durability);

    // base value - block chance
    const baseValueBlockChance = (
        (Math.log(baseStats.strength) / Math.log(50)) *
        (Math.log(baseStats.reflex) / Math.log(50)) * (Math.log(shieldSkill) / Math.log(100)) +
        ((baseStats.agility - baseStats.constitution) / 50)
    ) * shieldType.sizeFactor;

    // applied penalties
    const healthPenaltyBlockChance = calcHealthPenalty(itemizedHealth, "blockChance");
    const penaltiesAppliedBlockVal = baseValueBlockChance * healthPenaltyBlockChance * staminaPenalty * weightPenalty;

    // applied bonuses
    const blockChance = penaltiesAppliedBlockVal * (noMainhand ? 1.25 : 1) + (baseStats.luck / 200);

    // base value - block value
    const baseValueCharacterBlock = shieldWeight > baseStats.strength
        ? (Math.log10(baseStats.strength) * 3) * (baseStats.strength / shieldWeight)
        : (Math.log10(baseStats.strength) * 3);
    // penalties applied - character block
    const healthPenaltyBlockPower = calcHealthPenalty(itemizedHealth, "blockPower");
    const penaltiesAppliedCharacterBlock = baseValueCharacterBlock * healthPenaltyBlockPower * staminaPenalty * weightPenalty;
    // bonuses applied - character block
    const characterBlock = penaltiesAppliedCharacterBlock * (noMainhand ? 1.25 : 1);
    const shieldBlock = shieldType.blockMultiplier * mainMaterial.strength * durabilityPenalty;
    return {
        baseBlockChance: blockChance,
        baseBlockValue: characterBlock * shieldBlock,
    };
}

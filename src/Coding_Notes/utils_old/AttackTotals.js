import { calcHealthPenalty } from './CalcHealthPenalty';
import { calcStaminaPenalty } from './CalcStaminaPenalty';
import { calcWeightPenalty } from './CalcWeightPenalty';
import { weaponTypes, equipmentMaterial, equipmentKeys } from './CombatConfig';
import { getWeaponSkill } from './GetWeaponSkill';
import { calcItemWeight } from './CalcWeight';

export function calcAttackTotals(character) {
    const physicalConstant = 1; // tuning constant

    const { combatStats, mainhand, offhand } = character;
    const { base: baseStats, itemizedHealth } = combatStats;

    const noOffhand = offhand.itemType === "unequipped";
    const offhandIsShield = offhand.itemType === "shield";

    const mainhandWeight = calcItemWeight(mainhand);
    const offhandWeight = calcItemWeight(offhand);
    const combinedWeight = mainhandWeight + offhandWeight;

    const mainStats = getWeaponStats(mainhand, combatStats, true, noOffhand);
    const offStats = getWeaponStats(offhand, combatStats);

    const baseHitChance = getHitChance(baseStats, mainStats?.weight || 0, getWeaponSkill(combatStats, mainhand.combatStats.weaponType), itemizedHealth, offhandIsShield, combinedWeight);
    const baseCritChance = getCritChance(baseStats, mainStats?.weaponSkill || 1);

    const baseAttackValueMainhand = mainStats
        ? getAttackValue(baseStats, mainStats, itemizedHealth, offhandIsShield, combinedWeight, physicalConstant)
        : 0;

    const baseAttackValueOffhand = offStats
        ? getAttackValue(baseStats, offStats, itemizedHealth, offhandIsShield, combinedWeight, physicalConstant) * 0.7
        : 0;

    const baseCritValue = 1;

    const attackBaseForWeapDurabilityLoss = getAttackBaseForDurabilityCalcs(baseStats, mainStats, physicalConstant);

    const totals = {
        hitChance: baseHitChance,
        critChance: baseCritChance,
        attackValueMainhand: baseAttackValueMainhand,
        attackValueOffhand: baseAttackValueOffhand,
        critValue: baseCritValue,
        attackBase: attackBaseForWeapDurabilityLoss
    };

    equipmentKeys.forEach(slot => {
        const chance = character[slot]?.combatStats?.bonus?.chance || {};
        const value = character[slot]?.combatStats?.bonus?.value || {};

        totals.hitChance += chance.hit || 0;
        totals.critChance += chance.critical || 0;
        totals.critValue += value.critical || 0;
        totals.attackValueMainhand *= 1 + (value.damage || 0);
        totals.attackValueOffhand *= 1 + (value.damage || 0);
    });

    return {
        base: { baseHitChance, baseAttackValueMainhand, baseAttackValueOffhand, baseCritChance, baseCritValue },
        total: totals,
        damageType: mainStats?.damageType,
        damageTypeOffhand: offStats?.damageType
    };
}

// --- Helpers ---

function getWeaponStats(item, combatStats, allowTwoHanding = false, noOffhand = false) {
    if (!item || item.itemType !== "weapon") return null;

    const { weaponType, material, durability } = item.combatStats;
    const weaponSkill = getWeaponSkill(combatStats, weaponType);

    const { sizeFactor, powerMultiplier, twoHanded, damageType } = weaponTypes[weaponType];
    const materialInfo = equipmentMaterial[material];

    const weight = sizeFactor * materialInfo.weight;
    const strength = materialInfo.strength;

    let twoHandingSpecial = false;
    let twoHandingNormal = false;

    if (allowTwoHanding) {
        twoHandingSpecial = item.misc?.twoHandOptional && noOffhand;
        twoHandingNormal = !twoHanded && noOffhand;
    }

    return {
        weaponType,
        weaponSkill,
        damageType,
        weight,
        strength,
        durability,
        powerMultiplier,
        twoHandingSpecial,
        twoHandingNormal
    };
}

function getHitChance(stats, weight, weaponSkill, itemizedHealth, offhandIsShield, combinedWeight) {
    const base = ((Math.log(weaponSkill) / Math.log(1000)) ** 1.5) + (stats.skill / 50);
    const weightPenalty = calcWeightPenalty(stats.constitution, offhandIsShield ? combinedWeight : weight);
    const staminaPenalty = calcStaminaPenalty(stats.staminaCap, stats.staminaCurrent);
    const healthPenalty = calcHealthPenalty(itemizedHealth, "weaponHitChance");

    return base * weightPenalty * staminaPenalty * healthPenalty;
}

function getCritChance(stats, skill) {
    const base = (Math.sqrt(stats.skill * stats.agility) / 2) * (Math.log10(skill)) / 100;
    const staminaPenalty = calcStaminaPenalty(stats.staminaCap, stats.staminaCurrent);
    const luckBonus = Math.sqrt(stats.luck) / 100;
    return base * staminaPenalty + luckBonus;
}

function getAttackBaseForDurabilityCalcs(stats, weaponStats, physicalConstant) {
    const {
        weight,
        twoHandingSpecial,
        twoHandingNormal
    } = weaponStats;
    
    let twoHandedMultiplier = twoHandingSpecial ? 1.5 : twoHandingNormal ? 1.25 : 1; // yoinked from getAttackValue

    const base = (
        (Math.log10(stats.strength) * Math.max(0, Math.log10(weight))) +
        Math.log10(stats.strength) ** 2
    ) * physicalConstant * twoHandedMultiplier;
    return base;
}

function getAttackValue(stats, weaponStats, itemizedHealth, offhandIsShield, combinedWeight, physicalConstant) {
    const {
        weight,
        strength,
        powerMultiplier,
        durability,
        twoHandingSpecial,
        twoHandingNormal
    } = weaponStats;


    let twoHandedMultiplier = twoHandingSpecial ? 1.5 : twoHandingNormal ? 1.25 : 1;

    const base = (
        (Math.log10(stats.strength) * Math.max(0, Math.log10(weight))) +
        Math.log10(stats.strength) ** 2
    ) * physicalConstant * twoHandedMultiplier;

    const adjusted = weight > stats.strength
        ? base * (stats.strength / weight)
        : base;

    const weightPenalty = calcWeightPenalty(stats.constitution, offhandIsShield ? combinedWeight : weight);
    const healthPenalty = calcHealthPenalty(itemizedHealth, "weaponAttackPower");
    const staminaPenalty = calcStaminaPenalty(stats.staminaCap, stats.staminaCurrent);

    return adjusted * weightPenalty * healthPenalty * staminaPenalty * strength * powerMultiplier * Math.sqrt(durability);
}
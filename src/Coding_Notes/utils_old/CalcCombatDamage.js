import {
    armorSizeMultipliers,
    bodypartArmorAssignments,
    bodypartSizeAssignments,
    equipmentMaterial,
    bodypartBlockModifiers,
    roundToThousandths
} from "./CombatConfig";

const tuningConstant = 1;

export function calcCombatDamage(
    attackerAtkValue,
    defenderHealthCap,
    bodypart,
    equippedItems,
    defenderBlockValue,
    defenderBlockChance,
    armorEffectivenessMultiplier
) {
    const result = {}

    let damageThroughBlock

    let blocked = false;
    defenderBlockChance *= bodypartBlockModifiers[bodypart]
    const rand1 = Math.random();

    if (defenderBlockValue > 0 && rand1 < defenderBlockChance) {
        blocked = true;
        damageThroughBlock = Math.max(0, (attackerAtkValue - defenderBlockValue));
    };

    const bodypartSize = bodypartSizeAssignments[bodypart] || 1;
    const armorSlots = bodypartArmorAssignments[bodypart] || [];
    let totalMitigation = 0;

    for (const slot of armorSlots) {
        const item = equippedItems.filter(item => item.itemSlot === slot)[0];
        const sizeMultiplier = armorSizeMultipliers[slot];
        if (!item || item.itemType !== "armor") continue;

        const material = equipmentMaterial[item.combatStats?.itemType];
        if (!material) continue;

        const durability = item.combatStats?.durability || 0;
        const durabilityRatio = Math.max(0, Math.min(1, durability)) // clamp to [0, 1]

        const strength = material.strength;

        const mitigation = strength * durabilityRatio * sizeMultiplier * tuningConstant;
        totalMitigation += mitigation;
    }

    const mitigationMultiplier = armorEffectivenessMultiplier * Math.min(1, Math.max(0, 1 - (Math.pow(Math.max(0, Math.log(totalMitigation) / Math.log(100)), 3))));
    const damageReceived = blocked ? damageThroughBlock : attackerAtkValue * mitigationMultiplier;
    const damagePercent = Math.min(1, damageReceived / (defenderHealthCap * bodypartSize));
    result.damagePercent = roundToThousandths(damagePercent)
    result.blocked = blocked
    result.attackerAtkValue = attackerAtkValue

    return result;
}
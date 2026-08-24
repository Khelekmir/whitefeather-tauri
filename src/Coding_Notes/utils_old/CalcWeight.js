import { equipmentMaterial, shieldTypes, weaponTypes, armorSizeMultipliers, equipmentKeys, roundToThousandths } from "./CombatConfig";

export function calcItemWeight(item) {
    if (item.misc?.weightless) return 0;
    if (!item || item.itemType === "unequipped") return 0;
    const material = equipmentMaterial[item.combatStats.material];

    const typeMap = {
        shield: shieldTypes,
        weapon: weaponTypes,
        // armor: armorTypes
    };

    if (item.itemType === "armor" && armorSizeMultipliers[item.itemSlot]) {
        const material = equipmentMaterial[item.combatStats.itemType];
        return armorSizeMultipliers[item.itemSlot] / 5 * material.weight;
    }
    const typeInfo = typeMap[item.itemType]?.[item.combatStats[`${item.itemType}Type`]];
    if (!typeInfo || !material) return 0;

    return typeInfo.sizeFactor * material.weight;
}

export function calcCharacterGearWeight(character) {
    let sum = 0;
    for (const key of equipmentKeys) {
        const item = character[key];
        const weight = calcItemWeight(item);
        sum += weight;
    }
    return roundToThousandths(sum);
}
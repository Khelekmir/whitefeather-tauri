import { equipmentMaterial, armorSizeMultipliers, roundToThousandths } from "./CombatConfig";

export function calcArmorDurabilityLoss(item, attackerAtkValue, layerScaling = 1, attackerWeaponHardness) {
    const material = equipmentMaterial[item.combatStats.itemType] || equipmentMaterial.cloth;
    const sizeMultiplier = armorSizeMultipliers[item.itemSlot] || 1;

    const baseLoss = ((attackerAtkValue / sizeMultiplier) / (material.durability) * (attackerWeaponHardness / material.durability)) / 20;
    const scaledLoss = baseLoss * layerScaling;
    return Math.min(item.combatStats.durability, roundToThousandths(scaledLoss));
}
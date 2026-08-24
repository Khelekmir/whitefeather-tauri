import { equipmentMaterial, roundToThousandths, weaponTypes } from "./CombatConfig";

export function calcWeaponDurabilityLoss(weapon, attackerAtkBase, defendingMaterialHardness) {
    const material = equipmentMaterial[weapon.combatStats.material] || equipmentMaterial.iron;
    const sizeMultiplier = weaponTypes[weapon.combatStats.weaponType].sizeFactor || 1;
    // Basic formula: damage sustained scaled by inverse of durability and size
    const durabilityLoss = ((attackerAtkBase / sizeMultiplier) / (material.durability) * (defendingMaterialHardness / material.durability)) / 20; // tuning constant
    return Math.min(weapon.combatStats.durability, roundToThousandths(durabilityLoss));
}
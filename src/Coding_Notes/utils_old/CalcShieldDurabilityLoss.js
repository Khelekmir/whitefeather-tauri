import { equipmentMaterial, roundToThousandths, shieldTypes } from "./CombatConfig";

export function calcShieldDurabilityLoss(shield, attackerAtkBase, attackerWeaponHardness) { // TODO: test implementation
    const material = equipmentMaterial[shield.combatStats.material] || equipmentMaterial.iron;
    const sizeMultiplier = shieldTypes[shield.combatStats.shieldType].sizeFactor || 1;
    // Basic formula: damage absorbed scaled by inverse of durability and size
    const durabilityLoss = ((attackerAtkBase / sizeMultiplier) / (material.durability) * (attackerWeaponHardness / material.durability)) / 20; // tuning constant
    return Math.min(shield.combatStats.durability, roundToThousandths(durabilityLoss));
}
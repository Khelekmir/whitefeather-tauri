import { equipmentKeys, durabilityItemKeys } from "./CombatConfig";
import { buildMinimalPatch } from "./ObjectPatchUtils";

export const resetEquipmentDurability = (character) => {
    const durabilityItems = [];
    for (const equipmentSlot of Object.values(equipmentKeys)) {
        const equipmentItem = character[equipmentSlot];
        if (durabilityItemKeys.includes(equipmentItem.itemType)) {
            durabilityItems.push(equipmentItem);
        }
    }

    const listOfPatches = [];

    for (const originalItem of Object.values(durabilityItems)) {
        const updatedItem = {
            ...originalItem,
            combatStats: {
                ...originalItem.combatStats,
                durability: 1
            }
        }

        const result = {};

        const patch = buildMinimalPatch(originalItem.combatStats, updatedItem.combatStats);
        if (Object.keys(patch).length > 0) {
            result.id = originalItem.id;
            result.patch = patch;
            result.itemSlot = originalItem.itemSlot;
            listOfPatches.push(result);
        }
    }

    return listOfPatches;
}
// src/utilsLewd/computeLewdTotals.js   ← new file
import { equipmentKeys } from "../utils/CombatConfig";
import { gearLewdStatsDict } from "./LewdConfig";

export const computeLewdTotals = (character) => {
    if (!character) {
        return { allure: 0, charisma: 0, libido: 0, dominance: 0 };
    }

    // Start from static base values
    const totals = { ...character.lewdStats.static };

    // Add all equipment bonuses
    equipmentKeys.forEach(slot => {
        const bonus = character[slot]?.lewdStats?.bonus;
        if (bonus) {
            totals.allure += bonus.allure ?? 0;
            totals.charisma += bonus.charisma ?? 0;
            totals.libido += bonus.libido ?? 0;
            totals.dominance += bonus.dominance ?? 0;
        }
    });

    // Gender multiplier (F → allure, M → charisma)
    const boostKey = character.sex === 'F' ? 'allure' : 'charisma';
    totals[boostKey] *= gearLewdStatsDict.genderMultiplier;

    return totals;
};
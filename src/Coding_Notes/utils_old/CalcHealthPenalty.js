import { bodypartHealthCombatModifiers } from './CombatConfig';


/**
 * Calculates the adjusted value of a performance stat based on body part health.
 *
 * @param {Object} itemizedHealth - An object with body part keys and health values (0 to 1).
 * @param {string} stat - One of: 'dodgeChance', 'parryChance', etc.
 * @param {number} baseValue - The base unmodified value of the stat (typically 1).
 * @returns {number} - Adjusted stat after applying degradation.
 */
export function calcHealthPenalty(itemizedHealth, stat) {
    const modifiers = bodypartHealthCombatModifiers[stat];
    if (!modifiers) return 1;

    let totalDegradation = 0;

    for (const part in modifiers) {
        const health = itemizedHealth[part].health ?? 1; // default to 1 if part not found
        const degradationRate = modifiers[part];
        const reducedPerformance = 1 - Math.sqrt(health);
        totalDegradation += reducedPerformance * degradationRate;
    }

    const result = Math.max(0, (1 - totalDegradation))
    return result;
}

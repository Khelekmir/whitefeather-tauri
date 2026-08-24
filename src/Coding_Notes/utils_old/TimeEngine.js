import { calcBleed } from "./CalcBleed";
import { roundToThousandths } from "./CombatConfig";
import { buildMinimalPatch } from "./ObjectPatchUtils";
import { incrementLust } from "../utilsLewd/IncrementLewd";
import { incrementHappiness } from "../utilsSocial/IncrementSocial";
import { incrementStress } from "../utilsSocial/IncrementSocial";
import { incrementLustByTime } from "../utilsLewd/CalcLust";

export function resolveBleedOverTime(character, time) {
    const result = {};

    // combat stats initialized
    const combatStats = { ...character.combatStats }; // bleed here is currently same as updated, needs to not be the same
    console.log("🚀 ~ resolveBleedOverTime ~ combatStats:", combatStats)

    // bleed calculated and itemized
    const bleed = calcBleed(character, time);
    const bleedTotal = bleed.finalBleed;
    const itemizedHealth = bleed.itemizedHealth;

    // update health
    const healthCurrent = combatStats.base.healthCurrent;
    const health = combatStats.base.health;
    const updatedHealthCurrent = roundToThousandths(healthCurrent - bleedTotal);

    // update stamina
    const staminaCurrent = combatStats.base.staminaCurrent;
    const staminaCap = combatStats.base.staminaCap;
    const staminaPercent = (staminaCurrent / staminaCap);
    const updatedHealthPercent = (updatedHealthCurrent / health);

    let updatedStaminaCurrent = staminaCurrent;

    if (staminaPercent > updatedHealthPercent) {
        updatedStaminaCurrent = roundToThousandths(staminaCap * updatedHealthPercent);
    }

    const updatedCombatStats = {
        ...combatStats,
        base: {
            ...combatStats.base,
            healthCurrent: updatedHealthCurrent,
            staminaCurrent: updatedStaminaCurrent
        },
        itemizedHealth: {
            ...bleed.itemizedHealth
        }
    }
    console.log("🚀 ~ resolveBleedOverTime ~ updatedCombatStats:", updatedCombatStats)


    const patch = buildMinimalPatch(combatStats, updatedCombatStats);
    console.log("🚀 ~ resolveBleedOverTime ~ patch:", patch)

    result.patch = patch;
    result.bleedTotal = bleedTotal;
    result.updatedCombatStats = updatedCombatStats;
    result.itemizedHealth = itemizedHealth;

    return result;
}

export function resolveNaturalHealing(character, time) {
    const id = character.id;

    const updatedItemizedHealth = character.combatStats.ItemizedHealth;
}

// Every hour update everyone
export const advanceGlobalTime = (deltaHours, characters, allLewdTotals) => {

    const updatedCharacters = characters.map(char => {
        const newLust = incrementLustByTime(char.lewdStats.dynamic.lust, allLewdTotals[char.id].libido, deltaHours);
        return {
            ...char,
            lewdStats: {
                ...char.lewdStats,
                dynamic: {
                    ...char.lewdStats.dynamic,
                    lust: newLust
                }
            }
        };
    });

    return updatedCharacters;
};
import { buildMinimalPatch } from "../utils/ObjectPatchUtils";
import { incrementHappiness } from "./IncrementSocial";
import { incrementStress } from "./IncrementSocial";
import { incrementLust } from "../utilsLewd/IncrementLewd";
import { getHormones } from "../utilsLewd/CalcHormones";

export function incrementTimeForCharacter(character, deltaT) {
    /**
     * Increment time for a character and update their stats accordingly.
     * This function updates the character's happiness, stress, lust, and
     * libedo levels, as well as the time since their last orgasm and
     * sex.
     *
     * @param {Object} character - The character to update.
     * @param {number} deltaT - The amount of time to increment in hours.
     */

    const result = {};

    const updatedCharacter = JSON.parse(JSON.stringify(character));

    const socialStats = { ...character.socialStats };
    const lewdStats = { ...character.lewdStats };

    // Update happiness
    updatedCharacter.socialStats.dynamic.happiness = incrementHappiness(
        socialStats.dynamic.happiness,
        socialStats.static.baselineHappiness,
        socialStats.static.happinessGrowth,
        socialStats.static.happinessDecay,
        deltaT
    );

    // Update stress
    updatedCharacter.socialStats.dynamic.stress = incrementStress(
        socialStats.dynamic.stress,
        socialStats.static.baselineStress,
        socialStats.static.stressGrowth,
        socialStats.static.stressDecay,
        deltaT
    );

    // Update sexual activation
    const lustResult = incrementLust(
        lewdStats.dynamic.lust,
        lewdStats.static.libido,
        lewdStats.dynamic.timeSinceLast.orgasm,
        deltaT
    );

    function incrementTimeSinceLastOrgasm(timeSinceLastOrgasm, deltaT) {
        return Math.max(0, timeSinceLastOrgasm + deltaT);
    };

    updatedCharacter.socialStats.dynamic.happiness = happinessResult.newHappiness;
    updatedCharacter.socialStats.dynamic.stress = stressResult.newStress;
    updatedCharacter.lewdStats.dynamic.lust = lustResult.newLust;
    updatedCharacter.lewdStats.dynamic.timeSinceLast.orgasm = incrementTimeSinceLastOrgasm(lewdStats.dynamic.timeSinceLast.orgasm, deltaT);

    result.socialStatsPatch = buildMinimalPatch(character.socialStats, updatedCharacter.socialStats);
    result.lewdStatsPatch = buildMinimalPatch(character.lewdStats, updatedCharacter.lewdStats);

    return result; // TODO: make a patch, jsonify

}
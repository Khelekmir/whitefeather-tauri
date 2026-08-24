import { roundToThousandths } from "../utils/CombatConfig";
import { buildMinimalPatch } from "../utils/ObjectPatchUtils";
import { calcHormones } from "./CalcHormones";

// function incrementLust(currentLust, libido, targetThreshold, deltaT) {
export function incrementLust(currentLust, libido, naturalLust, timeSinceLastOrgasm, deltaT) {
    // Validate inputs
    if (libido <= 0) {
        throw new Error("Libido must be positive");
    }
    if (deltaT <= 0) {
        throw new Error("DeltaT must be positive");
    }
    // Base approach rate (tune: higher = faster overall convergence; e.g., 0.05 means ~20 steps to 63% closure for rate=1)
    const baseRate = 0.03;
    // Calculate delta to target
    const delta = naturalLust - currentLust;
    let effectiveRate;
    if (delta > 0) {
        // Increasing: hasten with higher libido (faster build-up)
        effectiveRate = baseRate * libido;
    } else if (delta < 0) {
        // Decreasing: slow with higher libido (slower decay)
        effectiveRate = baseRate / libido;
    } else {
        // At target: no change
        return currentLust;
    }
    // Rate of change
    const dLust = effectiveRate * delta;
    // Update
    let newLust = currentLust + deltaT * dLust;
    // Clamp to non-negative (assuming lust can't go below 0; adjust if needed)
    newLust = roundToThousandths(Math.max(0, newLust));
    return newLust;
}

export const incrementOvulationByHours = (character, hoursToAdd) => {
    const result = {};
    const lewdStats = character.lewdStats;
    const cycleLengthDays = lewdStats.static.ovulationCycleLength;
    const totalHours = cycleLengthDays * 24;                 // full cycle in hours

    // current hour (may be fractional, e.g. 12.5)
    const currentHour = lewdStats.dynamic.ovulationCycleCurrent ?? 0;

    // new hour, wrapped to the cycle
    const newHour = ((currentHour + hoursToAdd) % totalHours + totalHours) % totalHours;

    // compute hormones for the *new* hour
    const hormones = getHormones(character, hoursToAdd, newHour);

    // deep-copy the whole lewdStats block so the patch is minimal
    const updatedLewdStats = JSON.parse(JSON.stringify(lewdStats));
    updatedLewdStats.dynamic.ovulationCycleCurrent = newHour;
    updatedLewdStats.dynamic.hormones = { ...hormones };

    console.log("updatedLewdStats:", updatedLewdStats);

    result.patch = buildMinimalPatch(lewdStats, updatedLewdStats);
    result.hormones = hormones;

    return result;
};

// HELPER
/**
 * Temporary character → calcHormones → UI update.
 * `overrideCycleHour` forces a specific hour (used for wrap-around).
 */
const getHormones = (character, hoursToAdd, overrideCycleHour = null) => {
    const tempChar = JSON.parse(JSON.stringify(character));

    if (overrideCycleHour !== null) {
        // we are forcing the hour (after wrap-around)
        tempChar.lewdStats.dynamic.ovulationCycleCurrent = overrideCycleHour;
    } else {
        // normal incremental case – just add the hours
        const current = tempChar.lewdStats.dynamic.ovulationCycleCurrent ?? 0;
        const total = tempChar.lewdStats.static.ovulationCycleLength * 24;
        tempChar.lewdStats.dynamic.ovulationCycleCurrent =
            ((current + hoursToAdd) % total + total) % total;
    }

    const result = calcHormones(tempChar);   // ← the hour-based version from the previous answer
    console.log("hormones:", result);

    return result;
};
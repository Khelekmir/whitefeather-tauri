/* In a typical 28-day menstrual cycle, female libido (sexual desire) 
tends to fluctuate in response to hormonal changes, particularly 
estrogen and testosterone. Libido is often lowest during the menstrual 
phase (days 1-5), when both hormones are at their nadir, leading to 
fatigue and reduced interest. It begins to rise in the late menstrual/
early follicular phase (days 6-11) as estrogen levels increase, enhancing 
mood, energy, and arousal. Libido typically peaks around ovulation 
(days 12-15), coinciding with surges in estrogen (which promotes lubrication,
sensitivity, and overall receptivity) and testosterone (which directly 
fuels sexual drive and motivation). After ovulation, in the luteal phase 
(days 16-28), libido generally declines as progesterone rises and dominates, 
potentially causing bloating or mood dips, though some women report a 
milder secondary increase mid-luteal. These patterns vary individually 
due to factors like stress, health, or age, but estrogen primarily supports 
physiological readiness for sex, while testosterone drives the psychological 
urge. 
 
In a typical 28-day menstrual cycle, progesterone levels remain low and 
stable during the follicular phase (days 1-14), as the body focuses on 
estrogen-driven follicle development. Following ovulation (around day 14), 
progesterone surges in the luteal phase (days 15-28), produced by the 
corpus luteum, peaking mid-luteal (around days 20-24) before declining 
sharply if no pregnancy occurs, triggering menstruation. This hormone 
primarily influences female physiology by preparing the uterus for potential 
pregnancy: it thickens and stabilizes the endometrial lining, stimulates 
glandular development and new blood vessel formation for implantation, 
inhibits further ovulation, relaxes smooth muscles (preventing early 
contractions but potentially causing constipation or bloating), elevates 
basal body temperature (by about 0.5°F), and promotes breast tissue changes 
that can lead to tenderness. Psychologically, progesterone exerts a calming, 
sedative effect that can enhance relaxation, improve sleep quality, and 
reduce overall anxiety when balanced; however, its fluctuations or relative 
dominance in the luteal phase can contribute to premenstrual syndrome (PMS) 
symptoms like mood swings, irritability, depression, or heightened emotional 
sensitivity. In terms of libido, progesterone often acts as a counterbalance 
to estrogen and testosterone, typically dampening sexual desire during the 
luteal phase by shifting the body toward a more nurturing, protective 
state—potentially reducing arousal through increased fatigue, bloating, 
or mood dips—though individual responses vary.

These patterns complement estrogen and testosterone in modulating libido: 
while estrogen enhances receptivity and testosterone boosts drive around 
ovulation, progesterone's rise post-ovulation contributes to the subsequent 
decline, prioritizing potential pregnancy maintenance over further mating.
*/

import { roundToThousandths } from "../utils/CombatConfig";

/**
 * Calculates hormone levels and menstrual-phase description for a given hour
 * in the ovulation cycle.
 *
 * @param {Object} character
 * @param {number} character.lewdStats.static.ovulationCycleLength   // days (e.g. 28)
 * @param {number} character.lewdStats.dynamic.ovulationCycleCurrent // **hours** since cycle start (0.0 … cycleLength*24)
 * @returns {{
 *   estrogen: number,
 *   testosterone: number,
 *   progesterone: number,
 *   hour: number,
 *   day: number,
 *   phase: string,
 *   description: string
 * }}
 */
export function calcHormones(character) {
    const result = {};

    const cycleLengthDays = character.lewdStats.static.ovulationCycleLength; // e.g. 28
    const hour = character.lewdStats.dynamic.ovulationCycleCurrent;          // fractional hours

    const totalHours = cycleLengthDays * 24;                                 // full cycle in hours

    // ---- Validation -------------------------------------------------------
    if (hour < 0 || hour > totalHours) {
        throw new Error(`Hour must be between 0 and ${totalHours}`);
    }

    const day = hour / 24;                     // fractional day for the formulas
    const scale = cycleLengthDays / 28;        // keep the original 28-day scaling factor

    // ---- Phase boundaries in **hours** ------------------------------------
    const menstrualEndHours = Math.round(5 * scale * 24);
    const follicularEndHours = Math.round(11 * scale * 24);
    const ovulationEndHours = Math.round(15 * scale * 24);

    // ---- Phase descriptions (typos fixed) --------------------------------
    const descriptions = {
        Menstrual: "Libido is often lowest during the menstrual phase, when both hormones are at their nadir, leading to fatigue and reduced interest.",
        Follicular: "Libido begins to rise in the late menstrual/early follicular phase as estrogen levels increase, enhancing mood, energy, and arousal.",
        Ovulation: "Libido peaks around ovulation, coinciding with surges in estrogen (which promotes lubrication, sensitivity, and overall receptivity) and testosterone (which directly fuels sexual drive and motivation).",
        Luteal: "After ovulation, in the luteal phase, libido generally declines as progesterone rises and dominates, potentially causing mood swings, irritability, depression, or heightened emotional sensitivity."
    };

    let phaseKey;
    if (hour <= menstrualEndHours) {
        phaseKey = "Menstrual";
    } else if (hour <= follicularEndHours) {
        phaseKey = "Follicular";
    } else if (hour <= ovulationEndHours) {
        phaseKey = "Ovulation";
    } else {
        phaseKey = "Luteal";
    }
    result.phase = phaseKey;
    result.description = descriptions[phaseKey];

    // ---- Hormone calculations (use fractional day) -----------------------
    // Estrogen
    const centerE1 = 13 * scale;
    const centerE2 = 22 * scale;
    const sigma1Left = 4 * scale;
    const sigma1Right = 1.5 * scale;
    const sigma2Left = 4 * scale;
    const sigma2Right = 2.5 * scale;

    const sigma1 = day <= centerE1 ? sigma1Left : sigma1Right;
    const sigma2 = day <= centerE2 ? sigma2Left : sigma2Right;

    const termE1 = 19 * Math.exp(-Math.pow(day - centerE1, 2) / (2 * Math.pow(sigma1, 2)));
    const termE2 = 9 * Math.exp(-Math.pow(day - centerE2, 2) / (2 * Math.pow(sigma2, 2)));
    result.estrogen = roundToThousandths(1 + termE1 + termE2);

    // Testosterone
    const centerT = 14 * scale;
    const sigmaT = 4 * scale;
    const termT = 1.8 * Math.exp(-Math.pow(day - centerT, 2) / (2 * Math.pow(sigmaT, 2)));
    result.testosterone = roundToThousandths(1 + termT);

    // Progesterone
    const centerP = 21 * scale;
    const sigmaPLeft = 3 * scale;
    const sigmaPRight = 4 * scale;
    const sigmaP = day <= centerP ? sigmaPLeft : sigmaPRight;
    const termP = 24 * Math.exp(-Math.pow(day - centerP, 2) / (2 * Math.pow(sigmaP, 2)));
    result.progesterone = roundToThousandths(1 + termP);

    // ---- Return values ----------------------------------------------------
    result.hour = hour;          // exact hour you passed in
    result.day = roundToThousandths(day); // fractional day (for debugging)

    return result; // TODO: need to add a patch to result
}
/*
testosterone only impacts libido; libido is now a base stat that is always influenced by testosterone (fuels sexual interest and motivation)

estrogen impacts sensitivity; sensitivity is now a base stat that is always influenced by estrogen (promotes lubrication, sensitivity, and overall receptivity)

libido -> lust -> arousal

lust = libido (* testosterone) over time + stimulation (* estrogen) over events
    influenced by time since last climax

interest (internal variables) =
    psycho (mood, lust)

stimulation (internal variables + external stimuli) = 
    physio (sensitivity (& estrogen), intensity, preference)
	

pleasure (external variables applied to interest & stimulation multipliers) =
    external (relationship, intimacy of act)
    & psycho (interest)
    & physio (stimulation)
	
PNS/SNS gain = pleasure
*/
import { buildMinimalPatch } from "../utils/ObjectPatchUtils";
import { roundToThousandths } from "../utils/CombatConfig";
import { lewdBits } from "../utilsLewd/LewdConfig";
import { lewdActionList } from "../utilsLewd/LewdConfig";
import { gearLewdStatsDict } from "../utilsLewd/LewdConfig";
import { calcHormones } from "./CalcHormones";
import { lewdTalentConversionTable } from "../utilsLewd/LewdConfig";
import { calcThreshold } from "./CalcThreshold";

export function calcPleasure({ // pure function
    topChar,
    bottomChar,
    actorLewdTotals,
    targetLewdTotals,
    topPart,
    bottomPart,
    action,
    intensity,
    relTopToBottom,
    relBottomToTop,
    attitudeTowardsTop // not yet implemented
}) {
    console.log("🚀 ~ calcPleasure ~ relBottomToTop:", relBottomToTop)
    console.log("🚀 ~ calcPleasure ~ relTopToBottom:", relTopToBottom)
    const result = {};
    console.log(actorLewdTotals, targetLewdTotals);

    // set initial values
    const topSex = topChar.sex === "M" ? "male" : "female";
    const bottomSex = bottomChar.sex === "M" ? "male" : "female";
    const topPartObject = lewdBits[topSex][topPart];
    const bottomPartObject = lewdBits[bottomSex][bottomPart];
    const attackerDominance = actorLewdTotals.dominance;
    const defenderDominance = targetLewdTotals.dominance;
    const submissionMultiplier = (attackerDominance / defenderDominance);

    let estrogen = 1.0;
    let testosterone = 1.0;
    let progesterone = 1.0;
    if (bottomSex === "female") {
        result.hormones = calcHormones(bottomChar);
        estrogen = result.hormones.estrogen || 1;
        testosterone = result.hormones.testosterone || 1;
        progesterone = result.hormones.progesterone || 1;
    }

    // CALC INTEREST
    // rework implementation later -- dictionary of mood stats
    const mood = bottomChar.socialStats.mood;
    // Lust will derive from testosterone & libido over time, 
    // and estrogen & stimulating thoughts/acts over time
    const lust = bottomChar.lewdStats.dynamic.lust;
    const interest = calcInterest(mood, lust, testosterone);
    result.interest = interest;

    // CALC STIMULATION
    // <<< attacker >>> charisma, [skill = talent * experience]
    const charisma = actorLewdTotals?.charisma ?? 1;
    const talentConversion = lewdTalentConversionTable[topPart];
    const talent = actorLewdTotals?.experience.lewdActions[talentConversion].talent ?? 1;
    const experience = actorLewdTotals?.experience.lewdActions[talentConversion].experience ?? 1;
    const attackerMultiplier =
        charisma * talent * (Math.log(experience) / Math.log(100)) ** 2;
    // <<< action >>> stimFactor
    const stimulationFactor = lewdActionList[action].stimulation;
    // <<< defender >>> sensitivity (& estrogen), intensity, preference
    const charSensitivityMultiplier = bottomChar.lewdStats.itemizedLewd[bottomPart].sensitivity;
    const genericSensitivityMultiplier = bottomPartObject.sensitivity;
    const preferredIntensity = bottomChar.lewdStats.itemizedLewd[bottomPart].prefIntensity;
    const sensitivity = roundToThousandths(charSensitivityMultiplier * genericSensitivityMultiplier);
    const preference = bottomChar.lewdStats.itemizedLewd[bottomPart].preference;
    const maxIntensity = bottomChar.lewdStats.itemizedLewd[bottomPart].maxIntensity;
    const overIntensityPenaltyMultiplier = 10 / bottomPart.maxIntensity;
    const stimulation = calcStimulation(
        bottomSex,
        attackerMultiplier,
        stimulationFactor,
        submissionMultiplier,
        sensitivity,
        estrogen,
        progesterone,
        intensity,
        maxIntensity,
        preferredIntensity,
        preference
    );
    result.stimulation = stimulation;

    // CALC SOCIAL
    const socialMultiplier = calcSocialPleasureMultiplier(
        topPartObject.intimacy,
        bottomPartObject.intimacy,
        lewdActionList[action].intimacy,
        relBottomToTop.trust, // 0 +
        relBottomToTop.affection, // 
        relBottomToTop.lover, // boolean
        relBottomToTop.spouse, // boolean
    );
    console.log("🚀 ~ calcPleasure ~ pleasureMultiplier:", socialMultiplier)
    result.socialMultiplier = socialMultiplier;

    result.summary = `${topChar.name} used ${topChar.sex === "M" ? "his" : "her"} ${topPart} to ${lewdActionList[action].verb} ${bottomChar.name}'s ${bottomPartObject.name}.`;
    // result.pleasure = roundToThousandths(interest * stimulation * pleasureMultiplier);
    result.stimulation = roundToThousandths(stimulation);

    // for display of stimulation testing only
    result.pleasure = result.stimulation;

    result.threshold = calcThreshold(topPartObject, lewdActionList[action], bottomPartObject, intensity);

    console.log("🚀 ~ calcPleasure ~ result:", result)
    return result;
}

// helper functions
function calcInterest(mood, lust, testosterone) { // (internal variables) = psycho (mood, lust (& testosterone))
    // const moodValue = mood.placeholder ?? 1;
    const moodValue = 1;
    return moodValue * lust * testosterone;
}

function calcStimulation( // stimulation (internal variables + external stimuli) = physio (sensitivity (& estrogen), intensity, preference)
    // --- Input Variables (tunable per-character or per-event) ---
    // sex: "male" or "female" – determines if hormone modifiers apply (female: multiplies by estrogen^0.1 / progesterone^0.1; male: no change)
    //      Also affects penalty severity in 'd' (males have 2x tolerance to intensity excess, reducing penalty)
    sex,
    // attackerMultiplier: multiplies base stimulation (for partner skill/attraction; higher = more stimulation)
    attackerMultiplier, // talent * experience
    // stimulationFactor: Scales the 's' component (activity-specific base stimulation, e.g., 1-10)
    //      Higher values increase 's' (normalized sigmoid-like), boosting overall stimulation; tune for different acts (e.g., 2 for light touch, 8 for intense)
    stimulationFactor, // lewdActionList[action].stimulation
    // submissionMultiplier: Defaults to 1; reduces penalty in 'd' when intensity > preferred
    //      Higher = more tolerance to excess intensity (less negative/penalty); lower = harsher penalty (can make d negative, turning stimulation negative)
    //      Tune for character traits (e.g., submissive char: 2+ for less penalty; dominant: 0.5 for more sensitivity to excess)
    submissionMultiplier = 1, // (attackerDominance / defenderDominance)
    // sensitivity: Character's base sensitivity (e.g., 0-10); directly scales 'g' linearly (g = sensitivity/10)
    //      Higher = amplifies all stimulation; tune per body part or overall (e.g., erogenous zones: 8+)
    sensitivity, // bottomChar.lewdStats.itemizedLewd[bottomPart].sensitivity
    // estrogen: Hormone ratio (e.g., 1+); for females, ^0.1 multiplies final (slight boost)
    //      Higher = increases final stimulation (e.g., +7% at 2x); lower = decreases; ignored for males
    estrogen,
    // progesterone: Hormone ratio (e.g., 1+); for females, ^0.1 divides final (slight dampen)
    //      Higher = decreases final (e.g., -7% at 2x); lower = increases; ignored for males
    //      Exponent 0.1 is tunable – higher exponent (e.g., 0.2) makes hormones more impactful
    progesterone,
    // intensity: Stimulation intensity level (e.g., 0-10); drives 'i' (sigmoid growth)
    //      Higher = increases 'i' towards 1 (saturation at ~10); but if > preferredIntensity, triggers 'd' penalty
    intensity,
    // overIntensityPenaltyMultiplier: multiplies penalty in 'd' when intensity > preferredIntensity
    maxIntensity,
    // preferredIntensity: Defaults to 3; threshold for intensity penalty in 'd'
    //      Higher = allows more intensity without penalty (e.g., for chars who like rough play); lower = penalizes even mild intensity
    preferredIntensity = 3,
    // preference: Defaults to 5; directly multiplies as 'p' (linear scale)
    //      Higher = boosts overall (e.g., for favored acts); lower = reduces (disliked acts); max 10 assumed for normalization comment, but no cap enforced
    preference = 5
) {
    console.log("attackerMultiplier: ", attackerMultiplier);
    let a, b, intensityNorm, stimNorm, p, i, diff, c, d, g, s;
    // --- Constants (global tuning parameters for curve shapes) ---
    // a: Growth amplitude for 'i' and 's' sigmoids (higher a = steeper initial rise, higher saturation value; e.g., a=3.0 boosts peaks ~44%, a=1.5 halves them)
    a = 2.25; // tuning
    // b: Rate for intensity curve in 'i' (higher b = faster rise to saturation; e.g., b=0.6 boosts mid-range ~14%, b=0.3 reduces ~15%)
    b = 0.45; // tuning
    // c: Rate for stimulationFactor curve in 's' (higher c = faster rise; e.g., c=0.2 boosts s ~21%, c=0.1 reduces ~27%)
    c = 0.15; // tuning
    // SENSITIVITY
    g = sensitivity / 10;
    // INTENSITY normalize for level (max at 10)
    intensityNorm = 1 - a * Math.exp(-b * 10);
    i = (1 - a ** (-b * intensity)) / intensityNorm;
    // PREFERENCE normalize for preference (max input 10, returns 1 at 5)
    p = preference; // futureproofed
    // difference factor (linear approximation matching)

    const perfectIntensityBoon = (1 - Math.abs(intensity - preferredIntensity)) / 5; // divisor is tunable constant, currently 20% boon
    const boon = perfectIntensityBoon >= 0 ? 1 + perfectIntensityBoon : 1;

    diff = intensity - maxIntensity;

    d = diff <= 0
        ? 1
        : d = 1 - ((0.3 * (10 / maxIntensity)) / submissionMultiplier) * diff / (sex === "male" ? 2 : 1);
    console.log("🚀 ~ calcStimulation ~ d:", d)
    //      ^-- The 0.3 here is a tunable penalty rate (higher = steeper drop in d per excess intensity unit; e.g., 0.4 = harsher penalty)
    // STIMULATION
    stimNorm = 1 - c * Math.exp(-c * 10);
    s = (1 - a ** (-c * stimulationFactor)) / stimNorm;

    const base = i * p * d * g * s * attackerMultiplier * boon;

    const final = sex === "female"
        ? roundToThousandths(base * (estrogen ** 0.1) / (progesterone ** 0.1))
        : roundToThousandths(base);

    console.log("ratio: ", final / base);
    return final;
}

function calcSocialPleasureMultiplier( //(external variables applied to interest & stimulation multipliers) = external (relationship, intimacy of act) & psycho (interest) & physio (stimulation)
    intimacyTop, // float 0.4 - 10.0
    intimacyBottom, // float 0.4 - 10.0
    intimacyAction, // float 0.4 - 10.0
    trust, // integer 0 or greater
    affection, // integer 0 or greater
    lover, // boolean
    spouse, // boolean
    BAC = 0.0 // float. increased BAC reduces the penalty of low trust, affection. complete 
) {
    // the greater the intimacy of 'top' or 'bottom' or 'action', the greater the pleasure multiplier result if high trust and affection
    // the greater the intimacy of 'top' or 'bottom' or 'action', the lower the pleasure multiplier result if low trust and affection
    // 100 trust and 100 affection = 4 times greater pleasure multiplier than 100 trust and 0 affection, or 0 trust and 100 affection
    // if lover = false, intimacy inputs above 7 return drastically lower pleasure multiplier
    // as BAC increases, lover = false penalty is reduced
    // if spouse = true, social pleasure multiplier experiences 20% boost
    // returns float value between -1 and 2
    return 0;
}
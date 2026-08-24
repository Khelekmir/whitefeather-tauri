// SocialIncrement.js
import { recoveryRates } from "./SocialConfig";
import { roundToThousandths } from "../utils/CombatConfig";

/**
 * Base time constant – one “full-rate” step closes ~63% of the gap in 24 h.
 * Change this once to speed up / slow down *all* temperament rates.
 */
const BASE_TAU = 24; // hours

/**
 * Resolve a rate key (e.g. "rapid") to its numeric value.
 */
const resolveRate = (key) => recoveryRates[key] ?? 0;

/**
 * Choose the correct rate (growth vs decay) based on direction.
 */
const effectiveRate = (current, baseline, growthRate, decayRate) => {
    const delta = baseline - current;
    if (delta > 0) return growthRate / BASE_TAU;          // need to rise
    if (delta < 0) return decayRate / BASE_TAU;           // need to fall
    return 0;                                             // already at baseline
};

/**
 * Increment **happiness** toward its character-specific baseline.
 *
 * @param {number} current          - Current happiness (0–100)
 * @param {number} baseline         - Natural happiness level (0–100)
 * @param {string} growthKey        - e.g. "rapid", "slow"
 * @param {string} decayKey         - e.g. "pretty slow"
 * @param {number} deltaT           - Time step in **hours**
 * @returns {number}                - New happiness, rounded to 3 dp
 */
export function incrementHappiness(
    current,
    baseline,
    growthKey,
    decayKey,
    deltaT
) {
    if (deltaT <= 0) throw new Error("deltaT must be positive");

    const growth = resolveRate(growthKey);
    const decay  = resolveRate(decayKey);
    const rate   = effectiveRate(current, baseline, growth, decay);

    const newVal = current + deltaT * rate * (baseline - current);
    return roundToThousandths(Math.max(0, Math.min(100, newVal)));
}

/**
 * Increment **stress** toward its character-specific baseline.
 *
 * @param {number} current          - Current stress (0–100)
 * @param {number} baseline         - Natural stress level (0–100)
 * @param {string} growthKey        - e.g. "fast", "moderate"
 * @param {string} decayKey         - e.g. "rapid", "pretty slow"
 * @param {number} deltaT           - Time step in **hours**
 * @returns {number}                - New stress, rounded to 3 dp
 */
export function incrementStress(
    current,
    baseline,
    growthKey,
    decayKey,
    deltaT
) {
    if (deltaT <= 0) throw new Error("deltaT must be positive");

    const growth = resolveRate(growthKey);
    const decay  = resolveRate(decayKey);
    const rate   = effectiveRate(current, baseline, growth, decay);

    const newVal = current + deltaT * rate * (baseline - current);
    return roundToThousandths(Math.max(0, Math.min(100, newVal)));
}
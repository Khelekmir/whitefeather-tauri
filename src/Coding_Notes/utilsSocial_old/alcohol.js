import { drinks } from "./SocialConfig";

export function consumeAlcohol(char, drinkKey, quantity = 1) {
    const drink = drinks[drinkKey];
    if (!drink) return;

    const { static: { alcoholTolerance = {} }, dynamic, weightKg } = char;
    const { r, elimRate } = getAlcoholConstants(prepForBAC(char));

    const tolerance = alcoholTolerance[drinkKey] || 1.0;
    const adjustedAbv = drink.abv / tolerance; // high tolerance = less effective

    const grams = drink.abv * drink.ml * ALCOHOL_DENSITY * quantity * (1 / tolerance);
    const instantBacRise = (grams / (weightKg * r)) * 100;

    // Add to current BAC
    char.dynamic.BAC = Math.max(0, (char.dynamic.BAC || 0) + instantBacRise);

    // Track peak for hangover later
    char.dynamic.peakBAC = Math.max(char.dynamic.peakBAC || 0, char.dynamic.BAC);
}

// Call every in-game hour
export function updateBAC(char, hoursPassed = 1) {
    if (!char.dynamic.BAC || char.dynamic.BAC <= 0) return;

    const { elimRate } = getAlcoholConstants(prepForBAC(char));
    char.dynamic.BAC = Math.max(0, char.dynamic.BAC - elimRate * hoursPassed);

    // Optional: residual effects after BAC=0
    if (char.dynamic.BAC < 0.01 && char.dynamic.peakBAC > 0.08) {
        char.dynamic.hangover = (char.dynamic.hangover || 0) + char.dynamic.peakBAC * 2;
    }
}

const ALCOHOL_DENSITY = 0.789; // g/ml
const ELIMINATION_RATE = 0.015; // ‰ per hour (0.010–0.020 range for variation)
const STANDARD_DRINK_GRAMS = 14; // US standard drink = 14g pure alcohol

// One-time per character — compute their personal constants
function getAlcoholConstants(char) {
    const { sex, weightKg, heightCm, age, alcoholTolerance = {} } = char;

    // Base distribution ratio
    const baseR = sex === "female" ? 0.68 : 0.73;

    // Body fat adjustment (very light realism)
    const bmi = weightKg / ((heightCm / 100) ** 2);
    const bodyFatAdjustment = sex === "female"
        ? (bmi < 19 ? 0.98 : bmi > 28 ? 0.90 : 1.0)
        : (bmi < 20 ? 0.98 : bmi > 30 ? 0.92 : 1.0);

    // Final r (distribution volume)
    const r = baseR * bodyFatAdjustment;

    // Elimination rate — varies by genetics, liver health, tolerance
    const toleranceFactor = Object.values(alcoholTolerance).reduce((a, b) => a + b, 0) /
        Object.keys(alcoholTolerance).length; // 0.5–2.0 average
    const baseElim = 0.015;
    const elimRate = baseElim * (0.8 + 0.4 * toleranceFactor); // 0.012–0.024

    return { r, elimRate };
}

// Add this helper once in your alcohol module
function prepForBAC(char) {
    return {
        sex: char.sex,
        age: char.age,
        heightCm: char.height * 2.54,
        weightKg: char.weight * 0.453592,
        alcoholTolerance: char.socialStats?.static?.alcoholTolerance || {
            beer: 1, wine: 1, liquor: 1, mead: 1
        }
    };
}
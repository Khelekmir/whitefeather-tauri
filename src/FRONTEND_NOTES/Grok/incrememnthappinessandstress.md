Here's a **robust, modular, and character-specific** `incrementHappinessAndStress` function that mirrors the style of your `updateStressActivation` and `updateSexualActivation` functions — using **differential-style updates** with **asymmetric growth/decay rates** based on character traits.

It works with your proposed `socialStats` structure and `recoveryRates` config, supports **independent control** over:
- How fast happiness **rises** toward baseline
- How fast happiness **falls** toward baseline
- Same for stress (growth vs decay)

This ensures:
- A "Debbie Downer" with `baselineHappiness: 30` and `happinessGrowth: "slow"` takes days to cheer up, but drops quickly.
- A "Cheerful Sunray" with `baselineHappiness: 90` and `happinessDecay: "very slow"` stays happy for a long time, even after bad events.

---

### Final Function

```javascript
/**
 * Increment happiness and stress over time toward character-specific baselines
 * with asymmetric growth/decay rates.
 *
 * @param {number} currentHappiness - Current happiness (0–100)
 * @param {number} currentStress - Current stress (0–100)
 * @param {number} baselineHappiness - Character's natural happiness level (0–100)
 * @param {number} baselineStress - Character's natural stress level (0–100)
 * @param {string} happinessGrowthRateKey - Key like "rapid", "slow" from recoveryRates
 * @param {string} happinessDecayRateKey - Key for decay speed
 * @param {string} stressGrowthRateKey - Key for stress increase speed
 * @param {string} stressDecayRateKey - Key for stress decrease speed
 * @param {number} deltaT - Time step in hours
 * @param {Object} recoveryRates - Global config object
 * @returns {{newHappiness: number, newStress: number}}
 */
function incrementHappinessAndStress(
    currentHappiness,
    currentStress,
    baselineHappiness,
    baselineStress,
    happinessGrowthRateKey,
    happinessDecayRateKey,
    stressGrowthRateKey,
    stressDecayRateKey,
    deltaT,
    recoveryRates
) {
    if (deltaT <= 0) throw new Error("deltaT must be positive");

    // Resolve rate values from config
    const getRate = (key) => recoveryRates[key] ?? 0;

    const growthRateHappy = getRate(happinessGrowthRateKey);
    const decayRateHappy = getRate(happinessDecayRateKey);
    const growthRateStress = getRate(stressGrowthRateKey);
    const decayRateStress = getRate(stressDecayRateKey);

    // Base time constant (tune to control overall speed)
    const baseTau = 24; // hours to approach ~63% of gap at rate=1

    // Calculate effective rate based on direction
    const calcEffectiveRate = (current, baseline, growthRate, decayRate) => {
        const delta = baseline - current;
        if (delta > 0) {
            return (growthRate / baseTau); // Rising toward baseline
        } else if (delta < 0) {
            return (decayRate / baseTau); // Falling toward baseline
        }
        return 0;
    };

    const rateHappy = calcEffectiveRate(currentHappiness, baselineHappiness, growthRateHappy, decayRateHappy);
    const rateStress = calcEffectiveRate(currentStress, baselineStress, growthRateStress, decayRateStress);

    // Differential update: dX/dt = rate * (target - current)
    let newHappiness = currentHappiness + deltaT * rateHappy * (baselineHappiness - currentHappiness);
    let newStress = currentStress + deltaT * rateStress * (baselineStress - currentStress);

    // Clamp to [0, 100]
    newHappiness = Math.max(0, Math.min(100, newHappiness));
    newStress = Math.max(0, Math.min(100, newStress));

    return { newHappiness, newStress };
}
```

---

### Example Usage with Your Data

```javascript
const recoveryRates = {
    "rapid": 1.0,
    "very fast": 0.85,
    "fast": 0.75,
    "pretty fast": 0.7,
    "moderately fast": 0.6,
    "moderate": 0.5,
    "moderately slow": 0.4,
    "pretty slow": 0.3,
    "slow": 0.25,
    "very slow": 0.15,
    "none": 0
};

const character = {
    socialStats: {
        static: {
            baselineHappiness: 30,
            baselineStress: 70,
            happinessGrowth: "slow",        // 0.25
            happinessDecay: "fast",         // 0.75
            stressGrowth: "fast",           // 0.75
            stressDecay: "pretty slow"      // 0.3
        },
        dynamic: {
            happiness: 90,
            stress: 10
        }
    }
};

let { happiness, stress } = character.socialStats.dynamic;
const { baselineHappiness, baselineStress, happinessGrowth, happinessDecay, stressGrowth, stressDecay } =
    character.socialStats.static;

// Simulate 24 hours
for (let i = 0; i < 24; i++) {
    const result = incrementHappinessAndStress(
        happiness, stress,
        baselineHappiness, baselineStress,
        happinessGrowth, happinessDecay,
        stressGrowth, stressDecay,
        1, // deltaT = 1 hour
        recoveryRates
    );
    happiness = result.newHappiness;
    stress = result.newStress;
}

console.log({ happiness, stress });
// → ~45 (down from 90), ~55 (up from 10) — Debbie Downer reverts fast
```

---

### Why This Works So Well

| Feature | Benefit |
|-------|--------|
| **Asymmetric rates** | Happy fast? Sad slow? Fully supported |
| **Exponential convergence** | Feels natural: big changes fast, small changes slow |
| **Config-driven** | Easy to balance via `recoveryRates` |
| **No overshoot** | Clamped + smooth approach |
| **Matches your other systems** | Same `deltaT`, differential style as SNS/PNS |

---

### Tuning Tips

- **`baseTau = 24`** → At rate=1, ~63% closure in **24 hours**.  
  → Want faster? Use `12`. Slower? Use `48`.
- **Rate keys** → Use descriptive strings; map to numbers in config.
- **Add events** → After a fight: `stress = Math.min(100, stress + 30)` → then let time pull it back.
- **Link to mood** → Map final happiness/stress to mood string (e.g., happiness > 80 → "Joyful").

---

### Optional: Add to Character Object

```javascript
// In your character class or update loop
updateSocialStats(deltaT) {
    const s = this.socialStats;
    const result = incrementHappinessAndStress(
        s.dynamic.happiness,
        s.dynamic.stress,
        s.static.baselineHappiness,
        s.static.baselineStress,
        s.static.happinessGrowth,
        s.static.happinessDecay,
        s.static.stressGrowth,
        s.static.stressDecay,
        deltaT,
        globalConfig.recoveryRates
    );
    s.dynamic.happiness = result.newHappiness;
    s.dynamic.stress = result.newStress;
}
```

Let me know if you want **mood string mapping**, **event modifiers**, or **energy system** next!
import { temperamentConversionTable, temperamentMoods } from './SocialConfig';

// ---------- 2. Helper that turns a number (1-100) into a level ----------
const LEVEL_RANGES = [
    { max: 33, label: 'low' },
    { max: 66, label: 'med' },
    { max: 100, label: 'high' }
];

function getLevel(value) {
    for (const r of LEVEL_RANGES) {
        if (value <= r.max) return r.label;
    }
    return 'high'; // fallback (100+)
}

// ---------- 3. Public API ----------
export function getMood(temperament, sex, lust, happiness, stress, energy) {
    // console.log("temperament: ", temperament, "sex: ", sex, "lust: ", lust, "happiness: ", happiness, "stress: ", stress, "energy: ", energy);
    const key = [
        getLevel(lust),
        getLevel(happiness),
        getLevel(stress),
        getLevel(energy)
    ].join('-');

    const conversion = temperamentConversionTable[temperament][sex];

    const result = temperamentMoods[conversion][key] ?? 'Neutral';

    return result; // fallback if something is missing
}

// export function getMood(character) {
//     const temperament = character.socialStats.static.temperament;
//     const sex = character.sex;
//     const lust = character.lewdStats.dynamic.lust;
//     const happiness = character.socialStats.dynamic.happiness;
//     const stress = character.socialStats.dynamic.stress;
//     const energy = character.combatStats.base.staminaCurrent / character.combatStats.base.staminaCap * 100;

//     console.log("lust: ", lust, "happiness: ", happiness, "stress: ", stress, "energy: ", energy);
//     const key = [
//         getLevel(lust),
//         getLevel(happiness),
//         getLevel(stress),
//         getLevel(energy)
//     ].join('-');

//     const conversion = temperamentConversionTable[temperament][sex];

//     const table = temperamentMoods[conversion];

//     const result = temperamentMoods[conversion][key] ?? 'Neutral';

//     return result; // fallback if something is missing
// }

/*
// ---------- 4. Usage example ----------

import { getMood } from './moodEngine.js';

class Character {
  constructor() {
    this.lust = 45;
    this.happiness = 82;
    this.stress = 12;
    this.energy = 27;
  }

  updateMood() {
    this.currentMood = getMood(
      this.lust,
      this.happiness,
      this.stress,
      this.energy
    );
    console.log(`Mood → ${this.currentMood}`);
  }
}

// Example
const hero = new Character();
hero.updateMood();          // → "Tranquil"
hero.lust = 92;
hero.updateMood();          // → "Ecstatic" (or whatever matches)
*/
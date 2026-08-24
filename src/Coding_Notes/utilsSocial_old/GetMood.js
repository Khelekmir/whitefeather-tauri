import { moods } from './SocialConfig';

// ---------- 1. Build the reverse map (run once at app start) ----------
const levelToMood = Object.create(null);   // no prototype pollution

for (const [mood, desc] of Object.entries(moods)) {
  // "low lust, low happiness, low stress, med energy"
  const parts = desc.split(', ').map(s => s.trim()); // ["low lust", ...]

  const key = parts
    .map(p => {
      const [level, _] = p.split(' ');   // "low", "med", "high"
      return level;
    })
    .join('-');                         // "low-low-low-med"

  levelToMood[key] = mood;
}

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
export function getMood(lust, happiness, stress, energy) {
  console.log("lust: ", lust, "happiness: ", happiness, "stress: ", stress, "energy: ", energy);
  const key = [
    getLevel(lust),
    getLevel(happiness),
    getLevel(stress),
    getLevel(energy)
  ].join('-');

  return levelToMood[key] ?? 'Neutral'; // fallback if something is missing
}

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
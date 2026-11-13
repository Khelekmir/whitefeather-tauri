/**
 * Mood × thin affect overlay → ST accumulation.
 *
 * Usage: npx tsx scripts/smokeMoodStReceptivity.ts
 */

import { getDetailedCharacter } from '../src/data/detailedPlaceholderCharacters.ts';
import type { Unit as DetailedUnit } from '../src/types/characters.ts';
import {
  effectiveShortTermMult,
  scaleShortTermDeltaForMood,
} from '../src/utils/social/moodStReceptivity.ts';
import { resolveMood } from '../src/utils/social/resolveMood.ts';
import { nudgePersonalizedPressure } from '../src/utils/social/durablePressureState.ts';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function clone(id: string): DetailedUnit {
  const u = getDetailedCharacter(id);
  if (!u) throw new Error(`missing ${id}`);
  return structuredClone(u) as DetailedUnit;
}

function withBlend(unit: DetailedUnit, blend: string): DetailedUnit {
  return {
    ...unit,
    socialStats: {
      ...unit.socialStats,
      static: { ...unit.socialStats.static, temperament: blend },
    },
  };
}

let warm = withBlend(clone('unit_amberyl'), 'Sanguine-Phlegmatic');
// Push belonging up / stress down so class leans warm and bond overlay helps.
warm = nudgePersonalizedPressure(warm, 'belonging', 25);
warm = nudgePersonalizedPressure(warm, 'stress', -20);

let irritable = withBlend(clone('unit_amberyl'), 'Choleric-Sanguine');
irritable = nudgePersonalizedPressure(irritable, 'stress', 35);
irritable = nudgePersonalizedPressure(irritable, 'belonging', -20);

const warmMood = resolveMood(warm);
const irrMood = resolveMood(irritable);

const warmBond = effectiveShortTermMult(warm, 'warmth');
const irrBond = effectiveShortTermMult(irritable, 'warmth');
const warmFriction = effectiveShortTermMult(warm, 'irritation');
const irrFriction = effectiveShortTermMult(irritable, 'irritation');

assert(warmBond > irrBond, 'warm writer should gain warmth easier than irritable');
assert(
  irrFriction > warmFriction,
  'irritable writer should take irritation harder than warm'
);

const baseWarmth = 10;
const scaledWarm = scaleShortTermDeltaForMood(warm, 'warmth', baseWarmth);
const scaledIrrWarm = scaleShortTermDeltaForMood(irritable, 'warmth', baseWarmth);
assert(scaledWarm > scaledIrrWarm, 'scaled warmth deltas diverge');

// Same class neighborhood: raise stress only — friction overlay should rise.
let calm = withBlend(clone('unit_amberyl'), 'Sanguine-Phlegmatic');
calm = nudgePersonalizedPressure(calm, 'belonging', 20);
calm = nudgePersonalizedPressure(calm, 'stress', -25);
let edged = nudgePersonalizedPressure(calm, 'stress', 40);
const frictionCalm = effectiveShortTermMult(calm, 'irritation');
const frictionEdged = effectiveShortTermMult(edged, 'irritation');
assert(
  frictionEdged > frictionCalm,
  'same temperament: higher stress → higher friction mult (thin overlay)'
);

console.log('smokeMoodStReceptivity: ok');
console.log(
  `  warm (${warmMood.moodClass}) bond×${warmBond.toFixed(2)} friction×${warmFriction.toFixed(2)}`
);
console.log(
  `  irritable-leaning (${irrMood.moodClass}) bond×${irrBond.toFixed(2)} friction×${irrFriction.toFixed(2)}`
);
console.log(
  `  overlay-only stress: friction ${frictionCalm.toFixed(2)}→${frictionEdged.toFixed(2)}`
);

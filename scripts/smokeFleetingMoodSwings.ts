/**
 * Fleeting mood swings: decay, mood tint, ST overlay, lover vs hostile exposure.
 *
 * Usage: npx tsx scripts/smokeFleetingMoodSwings.ts
 */

import { getDetailedCharacter } from '../src/data/detailedPlaceholderCharacters.ts';
import type { Unit as DetailedUnit } from '../src/types/characters.ts';
import {
  applyPublicExposureSwing,
  driftMoodSwings,
  listSalientMoodSwings,
  nudgeMoodSwing,
  readMoodSwing,
} from '../src/utils/social/fleetingMoodSwingState.ts';
import { effectiveShortTermMult } from '../src/utils/social/moodStReceptivity.ts';
import { resolveMood } from '../src/utils/social/resolveMood.ts';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function clone(id: string): DetailedUnit {
  const u = getDetailedCharacter(id);
  if (!u) throw new Error(`missing ${id}`);
  return structuredClone(u) as DetailedUnit;
}

let amberyl = clone('unit_amberyl');
const shame0 = amberyl.socialStats.dynamic.shame ?? 0;
const pride0 = amberyl.socialStats.dynamic.pride ?? 0;
const bond0 = effectiveShortTermMult(amberyl, 'warmth');
const friction0 = effectiveShortTermMult(amberyl, 'irritation');

amberyl = nudgeMoodSwing(amberyl, 'embarrassment', 55);
assert(readMoodSwing(amberyl, 'embarrassment') >= 54, 'embarrassment set');
assert(listSalientMoodSwings(amberyl).some((s) => s.id === 'embarrassment'), 'salient');

const mood = resolveMood(amberyl);
assert(/cheeks|seen/i.test(mood.tell), 'tell mentions embarrassment');
assert(
  mood.rationale.some((r) => /embarrassment/i.test(r)) ||
    mood.moodClass === 'withdrawn' ||
    mood.moodClass === 'anxious' ||
    (mood.tintClass === 'withdrawn' || mood.tintClass === 'anxious'),
  'embarrassment paints mood toward withdrawn/anxious'
);

const frictionEmb = effectiveShortTermMult(amberyl, 'irritation');
const bondEmb = effectiveShortTermMult(amberyl, 'warmth');
assert(frictionEmb > friction0, 'embarrassment raises friction ST mult');
assert(bondEmb < bond0, 'embarrassment damps bond ST mult');

const decayed = driftMoodSwings(amberyl, 1);
assert(
  readMoodSwing(decayed.unit, 'embarrassment') <
    readMoodSwing(amberyl, 'embarrassment'),
  'swings decay in 1h'
);

let lover = applyPublicExposureSwing(clone('unit_amberyl'), 'lover', 0.8);
assert(readMoodSwing(lover, 'embarrassment') > 20, 'lover kiss → embarrassment');
assert(readMoodSwing(lover, 'fluster') > 10, 'lover kiss → fluster');
assert((lover.socialStats.dynamic.pride ?? 0) > pride0, 'lover kiss → durable pride');
assert(
  (lover.socialStats.dynamic.shame ?? 0) <= shame0 + 1,
  'lover kiss does not dump shame'
);

let hostile = applyPublicExposureSwing(clone('unit_amberyl'), 'hostile', 0.8);
assert(readMoodSwing(hostile, 'embarrassment') > 20, 'hostile → embarrassment');
assert(
  (hostile.socialStats.dynamic.shame ?? 0) > shame0,
  'hostile kiss → durable shame'
);
assert(
  (hostile.socialStats.dynamic.pride ?? 0) <= pride0 + 1,
  'hostile kiss does not raise pride'
);

console.log('smokeFleetingMoodSwings: ok');
console.log(`  tell: ${mood.tell}`);
console.log(
  `  emb friction ${friction0.toFixed(2)}→${frictionEmb.toFixed(2)} · bond ${bond0.toFixed(2)}→${bondEmb.toFixed(2)}`
);
console.log(
  `  decay 1h embarrassment ${readMoodSwing(amberyl, 'embarrassment').toFixed(0)}→${readMoodSwing(decayed.unit, 'embarrassment').toFixed(0)}`
);

/**
 * ST crystallize → durable pressure meter chips (anchors untouched).
 *
 * Usage: npx tsx scripts/smokePressureCrystal.ts
 */

import { getDetailedCharacter } from '../src/data/detailedPlaceholderCharacters.ts';
import type { Unit as DetailedUnit } from '../src/types/characters.ts';
import {
  applyPressureCrystalNudges,
  readPersonalizedValue,
  readPressureAnchor,
} from '../src/utils/social/durablePressureState.ts';
import {
  driftShortTermRelationships,
  ensureBidirectional,
  nudgeShortTerm,
} from '../src/utils/social/relationshipState.ts';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function clone(id: string): DetailedUnit {
  const u = getDetailedCharacter(id);
  if (!u) throw new Error(`missing ${id}`);
  return structuredClone(u) as DetailedUnit;
}

let amberyl = clone('unit_amberyl');
let sain = clone('unit_sain');
let graph = ensureBidirectional({}, amberyl, sain);

const stressAnchor = readPressureAnchor(amberyl, 'stress');
const belongingAnchor = readPressureAnchor(amberyl, 'belonging');
const stressBefore = readPersonalizedValue(amberyl, 'stress');
const belongingBefore = readPersonalizedValue(amberyl, 'belonging');

// Seed strong positive ST toward Sain, then fade one hour.
graph = nudgeShortTerm(graph, amberyl, sain, 'warmth', 60);
graph = nudgeShortTerm(graph, amberyl, sain, 'gratitude', 40);

const drift = driftShortTermRelationships(graph, 1, {
  [amberyl.id]: amberyl,
  [sain.id]: sain,
});

assert(drift.crystalDeltas.length > 0, 'LT crystallize expected');
assert(
  drift.pressureDeltas.some((d) => d.unitId === amberyl.id && d.id === 'stress'),
  'warmth/gratitude should chip stress down'
);
assert(
  drift.pressureDeltas.some(
    (d) => d.unitId === amberyl.id && d.id === 'belonging' && d.delta > 0
  ),
  'warmth/gratitude should raise belonging'
);

const applied = applyPressureCrystalNudges(
  { [amberyl.id]: amberyl, [sain.id]: sain },
  drift.pressureDeltas
);
amberyl = applied.unitsById[amberyl.id]!;

const stressAfter = readPersonalizedValue(amberyl, 'stress');
const belongingAfter = readPersonalizedValue(amberyl, 'belonging');

assert(stressAfter < stressBefore, 'stress meter fell');
assert(belongingAfter > belongingBefore, 'belonging meter rose');
assert(
  readPressureAnchor(amberyl, 'stress') === stressAnchor,
  'stress anchor unchanged'
);
assert(
  readPressureAnchor(amberyl, 'belonging') === belongingAnchor,
  'belonging anchor unchanged'
);

// Hurt path raises stress
let hurtGraph = ensureBidirectional({}, amberyl, sain);
hurtGraph = nudgeShortTerm(hurtGraph, amberyl, sain, 'hurt', 50);
hurtGraph = nudgeShortTerm(hurtGraph, amberyl, sain, 'irritation', 40);
const hurtDrift = driftShortTermRelationships(hurtGraph, 1, {
  [amberyl.id]: amberyl,
  [sain.id]: sain,
});
assert(
  hurtDrift.pressureDeltas.some(
    (d) => d.unitId === amberyl.id && d.id === 'stress' && d.delta > 0
  ),
  'hurt/irritation raise stress'
);

console.log('smokePressureCrystal: ok');
console.log(
  `  warmth/gratitude 1h → stress ${stressBefore.toFixed(1)}→${stressAfter.toFixed(1)} · belonging ${belongingBefore.toFixed(1)}→${belongingAfter.toFixed(1)} (anchors ${stressAnchor}/${belongingAnchor})`
);
console.log(
  `  pressure chips: ${drift.pressureDeltas.map((d) => `${d.id}${d.delta >= 0 ? '+' : ''}${d.delta.toFixed(2)}`).join(', ')}`
);

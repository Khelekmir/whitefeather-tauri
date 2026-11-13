/**
 * Soft LT social gates for partnered talk/leisure/care.
 *
 * Usage: npx tsx scripts/smokeSocialBondGate.ts
 */

import { getDetailedCharacter } from '../src/data/detailedPlaceholderCharacters.ts';
import type { Unit as DetailedUnit } from '../src/types/characters.ts';
import { planSocialTask } from '../src/utils/social/planSocialTask.ts';
import {
  ensureBidirectional,
  setLongTerm,
} from '../src/utils/social/relationshipState.ts';
import {
  evaluateSocialBondGate,
  socialBudgetPairMin,
  SOCIAL_BOND_GATE_TUNING,
} from '../src/utils/social/socialBondGate.ts';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function clone(id: string): DetailedUnit {
  const u = getDetailedCharacter(id);
  if (!u) throw new Error(`missing ${id}`);
  return structuredClone(u) as DetailedUnit;
}

const amberyl = clone('unit_amberyl');
const sain = clone('unit_sain');

let graph = ensureBidirectional({}, amberyl, sain);

// Neutral / stranger-ish — should still clear soft watch gate.
const neutral = socialBudgetPairMin(graph, amberyl, sain);
assert(
  neutral.budget >= SOCIAL_BOND_GATE_TUNING.gates.share_watch,
  'default pair clears share_watch'
);

const watchOk = evaluateSocialBondGate({
  taskId: 'share_watch',
  taskLabel: 'Share a night watch',
  primary: amberyl,
  partner: sain,
  relationships: graph,
});
assert(watchOk.ok, 'share_watch ok at defaults');

const firewood = planSocialTask({
  taskId: 'gather_firewood',
  primary: amberyl,
  partner: sain,
  relationships: graph,
});
assert(firewood.ok, 'chores ungated');

// Freeze the pair cold.
for (const [from, to] of [
  [amberyl, sain],
  [sain, amberyl],
] as const) {
  graph = setLongTerm(graph, from, to, 'trust', 12);
  graph = setLongTerm(graph, from, to, 'affection', 10);
  graph = setLongTerm(graph, from, to, 'familiarity', 5);
  graph = setLongTerm(graph, from, to, 'respect', 20);
  graph = setLongTerm(graph, from, to, 'fear', 45);
}

const cold = socialBudgetPairMin(graph, amberyl, sain);
assert(
  cold.budget < SOCIAL_BOND_GATE_TUNING.gates.share_watch,
  'cold pair below watch floor'
);

const watchCold = planSocialTask({
  taskId: 'share_watch',
  primary: amberyl,
  partner: sain,
  relationships: graph,
});
assert(!watchCold.ok, 'share_watch blocked when cold');
assert(/cold|bond/i.test(watchCold.reason ?? ''), 'cold reason');

const batheCold = planSocialTask({
  taskId: 'bathe_together',
  primary: amberyl,
  partner: sain,
  relationships: graph,
});
assert(!batheCold.ok, 'bathe_together blocked when cold');

const tendCold = planSocialTask({
  taskId: 'tend_wounds',
  primary: amberyl,
  partner: sain,
  relationships: graph,
});
assert(!tendCold.ok, 'tend_wounds blocked when very cold');

const laundryCold = planSocialTask({
  taskId: 'do_laundry',
  primary: amberyl,
  partner: sain,
  relationships: graph,
});
assert(laundryCold.ok, 'laundry still allowed when cold');

const campCold = planSocialTask({
  taskId: 'set_up_camp',
  primary: amberyl,
  partner: sain,
  relationships: graph,
});
assert(campCold.ok, 'camp chores ungated');

console.log('smokeSocialBondGate: ok');
console.log(
  `  default budget ${neutral.budget.toFixed(1)} · cold ${cold.budget.toFixed(1)} (watch need ${SOCIAL_BOND_GATE_TUNING.gates.share_watch})`
);
console.log(`  blocked: ${watchCold.reason}`);

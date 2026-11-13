/**
 * Concurrent progressive task clocks.
 *
 * Usage: npx tsx scripts/smokeSocialTaskClock.ts
 */

import { getDetailedCharacter } from '../src/data/detailedPlaceholderCharacters.ts';
import type { Unit as DetailedUnit } from '../src/types/characters.ts';
import { progressTaskBoard } from '../src/utils/social/applyTaskPlan.ts';
import { planSocialTask } from '../src/utils/social/planSocialTask.ts';
import { ensureBidirectional } from '../src/utils/social/relationshipState.ts';
import {
  actorsBusyOn,
  createAssignment,
  passHoursToTaskMinutes,
  progressAssignments,
  snapTaskMinutes,
  type TaskAssignment,
} from '../src/utils/social/taskAssignmentClock.ts';

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function clone(id: string): DetailedUnit {
  const u = getDetailedCharacter(id);
  if (!u) throw new Error(`missing ${id}`);
  return structuredClone(u) as DetailedUnit;
}

assert(snapTaskMinutes(1) === 5, 'min snap 5');
assert(snapTaskMinutes(37) === 40, 'snap up to 40');
assert(passHoursToTaskMinutes(1 / 60) === 5, '1 min pass → 5');
assert(passHoursToTaskMinutes(0.25) === 15, '15 min');

const amberyl = clone('unit_amberyl');
const sain = clone('unit_sain');
let graph = ensureBidirectional({}, amberyl, sain);

const scoutPlan = planSocialTask({
  taskId: 'scout_path',
  primary: amberyl,
  partner: null,
});
assert(scoutPlan.ok, 'scout plan ok');
assert(scoutPlan.totalMinutes === 40, 'scout 40m');

const laundryPlan = planSocialTask({
  taskId: 'do_laundry',
  primary: sain,
  partner: null,
});
assert(laundryPlan.ok, 'laundry plan ok');
assert(laundryPlan.totalMinutes === 35, 'laundry 35m');

let board: TaskAssignment[] = [
  createAssignment({
    taskId: 'scout_path',
    label: scoutPlan.label,
    participantIds: scoutPlan.participantIds,
    totalMinutes: scoutPlan.totalMinutes,
    plan: scoutPlan.plan,
  }),
  createAssignment({
    taskId: 'do_laundry',
    label: laundryPlan.label,
    participantIds: laundryPlan.participantIds,
    totalMinutes: laundryPlan.totalMinutes,
    plan: laundryPlan.plan,
  }),
];

assert(actorsBusyOn(board, [amberyl.id, sain.id]).length === 2, 'both busy');

const energyBefore = amberyl.socialStats.dynamic.energy ?? 0;

// Pass 15 — partial, no completion
let world = {
  unitsById: { [amberyl.id]: amberyl, [sain.id]: sain },
  relationships: graph,
};
let tick = progressTaskBoard(board, world, 15);
board = tick.board;
world = tick.state;
assert(board.length === 2, 'both still active after 15');
assert(
  board.find((a) => a.taskId === 'scout_path')!.remainingMinutes === 25,
  'scout 25 left'
);
assert(
  board.find((a) => a.taskId === 'do_laundry')!.remainingMinutes === 20,
  'laundry 20 left'
);
assert(
  !tick.events.some((e) => e.completed),
  'none completed at 15'
);
assert(
  (world.unitsById[amberyl.id]!.socialStats.dynamic.energy ?? 0) < energyBefore,
  'scout continuous energy drip'
);

// Math-only: remaining progress without world
const math = progressAssignments(board, 60);
assert(math.board.length === 0, '60m finishes both');
assert(math.events.every((e) => e.completed), 'both complete events');

// Apply that jump from the post-15 board
tick = progressTaskBoard(board, world, 60);
board = tick.board;
world = tick.state;
graph = world.relationships;
assert(board.length === 0, 'board clear');
assert(tick.flags.includes('scouted_path'), 'scout completion flag');
assert(tick.flags.includes('laundered'), 'laundry completion flag');
assert(tick.events.filter((e) => e.completed).length === 2, 'two completions');

// Busy block check via actorsBusyOn on fresh assign conflict
const again = createAssignment({
  taskId: 'scout_path',
  label: scoutPlan.label,
  participantIds: [amberyl.id],
  totalMinutes: 40,
  plan: scoutPlan.plan,
});
const conflictBoard = [again];
assert(
  actorsBusyOn(conflictBoard, [amberyl.id]).length === 1,
  'amberyl busy again'
);

console.log('smokeSocialTaskClock: ok');
console.log(`  completions: ${tick.log.filter((l) => /Finished/.test(l)).join(' | ')}`);
console.log(`  flags: ${[...new Set(tick.flags)].join(', ')}`);

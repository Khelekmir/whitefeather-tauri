/**
 * Concurrent social task assignments.
 *
 * Player Pass Time (multiples of 5 min, min 5) advances the shared clock.
 * Assignments run down in parallel; continuous effects drip by step/total;
 * completion fires when remaining hits 0 (including inside an oversized jump).
 *
 * Later: free actors may auto-assume default activities (RNG + per-character
 * idle lists) onto this same board — not a separate clock.
 */

import type {
  LongTermRelationshipId,
  ShortTermRelationshipId,
} from '../../data/social/relationships';
import type { PersonalizedPressureId } from '../../data/social/durablePressures';

export const TASK_CLOCK_MINUTE_STEP = 5;

export interface TaskEffectDeltaPressure {
  unitId: string;
  id: PersonalizedPressureId;
  /** Total delta over the full assignment duration. */
  delta: number;
}

export interface TaskEffectDeltaST {
  fromId: string;
  toId: string;
  id: ShortTermRelationshipId;
  delta: number;
}

export interface TaskEffectDeltaLT {
  fromId: string;
  toId: string;
  id: LongTermRelationshipId;
  delta: number;
}

export type TaskCompletionMutation =
  | { type: 'launderUnderwear'; unitId: string }
  | { type: 'batheClearSkin'; unitId: string; peelTorso?: boolean }
  | { type: 'tendWounds'; healerId: string; patientId: string }
  | { type: 'none' };

export interface TaskEffectBundle {
  pressure: TaskEffectDeltaPressure[];
  shortTerm: TaskEffectDeltaST[];
  longTerm: TaskEffectDeltaLT[];
}

export interface TaskEffectPlan {
  continuous: TaskEffectBundle;
  completion: TaskEffectBundle & {
    flags: string[];
    mutations: TaskCompletionMutation[];
  };
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  label: string;
  /** Primary first, then partner / cohort. */
  participantIds: string[];
  totalMinutes: number;
  remainingMinutes: number;
  /** Minutes already progressed (for fractional remainder accounting). */
  elapsedMinutes: number;
  plan: TaskEffectPlan;
  /**
   * Optional source tag — player assign vs future idle RNG default activity.
   * v1 only writes 'player'.
   */
  source?: 'player' | 'idleDefault';
}

export function emptyEffectBundle(): TaskEffectBundle {
  return { pressure: [], shortTerm: [], longTerm: [] };
}

export function emptyEffectPlan(): TaskEffectPlan {
  return {
    continuous: emptyEffectBundle(),
    completion: {
      ...emptyEffectBundle(),
      flags: [],
      mutations: [],
    },
  };
}

/** Snap minutes up to the next multiple of 5 (minimum 5). */
export function snapTaskMinutes(minutes: number): number {
  const raw = Math.max(TASK_CLOCK_MINUTE_STEP, minutes);
  return Math.ceil(raw / TASK_CLOCK_MINUTE_STEP) * TASK_CLOCK_MINUTE_STEP;
}

/** Pass Time hours → whole minutes, snapped to allowed social-clock step. */
export function passHoursToTaskMinutes(hours: number): number {
  const mins = Math.round(hours * 60);
  if (mins < TASK_CLOCK_MINUTE_STEP) return TASK_CLOCK_MINUTE_STEP;
  return Math.round(mins / TASK_CLOCK_MINUTE_STEP) * TASK_CLOCK_MINUTE_STEP;
}

export function isActorBusy(
  board: TaskAssignment[],
  unitId: string
): TaskAssignment | null {
  return board.find((a) => a.participantIds.includes(unitId)) ?? null;
}

export function actorsBusyOn(
  board: TaskAssignment[],
  unitIds: string[]
): { unitId: string; assignment: TaskAssignment }[] {
  const out: { unitId: string; assignment: TaskAssignment }[] = [];
  for (const id of unitIds) {
    const a = isActorBusy(board, id);
    if (a) out.push({ unitId: id, assignment: a });
  }
  return out;
}

let assignSeq = 0;
export function nextAssignmentId(taskId: string): string {
  assignSeq += 1;
  return `assign_${taskId}_${assignSeq}_${Date.now().toString(36)}`;
}

export function createAssignment(input: {
  taskId: string;
  label: string;
  participantIds: string[];
  totalMinutes: number;
  plan: TaskEffectPlan;
  source?: TaskAssignment['source'];
}): TaskAssignment {
  const totalMinutes = snapTaskMinutes(input.totalMinutes);
  return {
    id: nextAssignmentId(input.taskId),
    taskId: input.taskId,
    label: input.label,
    participantIds: [...input.participantIds],
    totalMinutes,
    remainingMinutes: totalMinutes,
    elapsedMinutes: 0,
    plan: input.plan,
    source: input.source ?? 'player',
  };
}

/**
 * Linear slice of a total delta for this step.
 * Uses elapsed accounting so sum of slices + final remainder ≈ total.
 */
export function sliceDelta(
  totalDelta: number,
  totalMinutes: number,
  elapsedBefore: number,
  stepMinutes: number
): number {
  if (totalMinutes <= 0 || stepMinutes <= 0 || totalDelta === 0) return 0;
  const elapsedAfter = Math.min(totalMinutes, elapsedBefore + stepMinutes);
  const beforeShare = elapsedBefore / totalMinutes;
  const afterShare = elapsedAfter / totalMinutes;
  return totalDelta * (afterShare - beforeShare);
}

export function sliceBundle(
  bundle: TaskEffectBundle,
  totalMinutes: number,
  elapsedBefore: number,
  stepMinutes: number
): TaskEffectBundle {
  return {
    pressure: bundle.pressure.map((d) => ({
      ...d,
      delta: sliceDelta(d.delta, totalMinutes, elapsedBefore, stepMinutes),
    })),
    shortTerm: bundle.shortTerm.map((d) => ({
      ...d,
      delta: sliceDelta(d.delta, totalMinutes, elapsedBefore, stepMinutes),
    })),
    longTerm: bundle.longTerm.map((d) => ({
      ...d,
      delta: sliceDelta(d.delta, totalMinutes, elapsedBefore, stepMinutes),
    })),
  };
}

export interface AssignmentProgressEvent {
  assignmentId: string;
  taskId: string;
  label: string;
  stepMinutes: number;
  completed: boolean;
  continuousSlice: TaskEffectBundle;
  /** Present only when completed this step. */
  completion?: TaskEffectPlan['completion'];
}

export interface ProgressAssignmentsResult {
  board: TaskAssignment[];
  events: AssignmentProgressEvent[];
  log: string[];
}

/**
 * Advance all assignments by `passMinutes` (caller should snap).
 * Does not apply effects — returns slices for the applicator.
 */
export function progressAssignments(
  board: TaskAssignment[],
  passMinutes: number
): ProgressAssignmentsResult {
  const stepGate = Math.max(0, passMinutes);
  const events: AssignmentProgressEvent[] = [];
  const log: string[] = [];
  const nextBoard: TaskAssignment[] = [];

  for (const a of board) {
    if (stepGate <= 0 || a.remainingMinutes <= 0) {
      if (a.remainingMinutes > 0) nextBoard.push(a);
      continue;
    }
    const step = Math.min(stepGate, a.remainingMinutes);
    const continuousSlice = sliceBundle(
      a.plan.continuous,
      a.totalMinutes,
      a.elapsedMinutes,
      step
    );
    const remainingMinutes = a.remainingMinutes - step;
    const elapsedMinutes = a.elapsedMinutes + step;
    const completed = remainingMinutes <= 0;
    events.push({
      assignmentId: a.id,
      taskId: a.taskId,
      label: a.label,
      stepMinutes: step,
      completed,
      continuousSlice,
      completion: completed ? a.plan.completion : undefined,
    });
    if (completed) {
      log.push(
        `Finished “${a.label}” (${a.participantIds.join('+')}) after ${a.totalMinutes}m.`
      );
    } else {
      nextBoard.push({
        ...a,
        remainingMinutes,
        elapsedMinutes,
      });
      log.push(
        `“${a.label}” · ${remainingMinutes}m left (${a.participantIds.join('+')}).`
      );
    }
  }

  return { board: nextBoard, events, log };
}

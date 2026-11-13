/**
 * Social task tuning + instant resolve wrapper.
 *
 * Progressive concurrent clocks: `planSocialTask` + `progressTaskBoard`.
 * `resolveSocialTask` still applies a full-duration plan in one shot (smoke / compat).
 *
 * Later: free actors may auto-assume idle default activities (RNG + per-character
 * lists) onto the same assignment board.
 */

import {
  getSocialTaskTemplate,
  type SocialTaskTemplate,
} from '../../data/social/socialLabScaffold';
import type {
  LongTermRelationshipId,
  ShortTermRelationshipId,
} from '../../data/social/relationships';
import type { PersonalizedPressureId } from '../../data/social/durablePressures';
import type { Unit as DetailedUnit } from '../../types/characters';
import { progressTaskBoard } from './applyTaskPlan';
import { planSocialTask } from './planSocialTask';
import type { RelationshipGraph } from './relationshipState';
import { createAssignment } from './taskAssignmentClock';

/** Tunable magnitudes — adjust here without hunting planners. */
export const SOCIAL_TASK_TUNING = {
  laundry: {
    gratitudeToWasher: 14,
    warmthToWashee: 8,
  },
  bathe: {
    shameRelief: 4,
  },
  batheTogether: {
    warmth: 16,
    desireHeat: 10,
  },
  shareWatch: {
    warmth: 14,
    familiarity: 2,
    desireHeat: 6,
    energyCost: 6,
  },
  cookMeal: {
    soloStressRelief: 4,
    soloPride: 5,
    soloBelonging: 4,
    cookEnergyCost: 8,
    gratitudeToCook: 12,
    warmthShared: 8,
  },
  tendWounds: {
    warmthHealerToPatient: 10,
    gratitudePatientToHealer: 18,
    admirationPatientToHealer: 8,
    patientStressRelief: 10,
  },
  gatherFirewood: {
    energyCost: 10,
    soloPride: 4,
    soloStressRelief: 3,
    warmth: 12,
    familiarity: 2,
    partnerBelonging: 3,
  },
  setUpCamp: {
    energyCost: 14,
    warmth: 14,
    familiarity: 3,
    stressRelief: 6,
    belonging: 5,
  },
  strikeCamp: {
    energyCost: 12,
    warmth: 12,
    familiarity: 2,
    stressLoad: 4,
  },
  scoutPath: {
    energyCost: 12,
    stressLoad: 3,
    soloPride: 5,
    warmth: 10,
    familiarity: 2,
    trust: 2,
    admiration: 8,
    gratitudeToScout: 6,
  },
  stub: {
    warmth: 12,
    familiarity: 2,
  },
} as const;

export interface SocialTaskInput {
  taskId: string;
  primary: DetailedUnit;
  partner?: DetailedUnit | null;
  relationships: RelationshipGraph;
}

export interface SocialTaskResult {
  primary: DetailedUnit;
  partner: DetailedUnit | null;
  relationships: RelationshipGraph;
  log: string[];
  effects: {
    pressure: { unitId: string; id: PersonalizedPressureId; delta: number }[];
    shortTerm: {
      fromId: string;
      toId: string;
      id: ShortTermRelationshipId;
      delta: number;
    }[];
    longTerm: {
      fromId: string;
      toId: string;
      id: LongTermRelationshipId;
      delta: number;
    }[];
    flags: string[];
  };
  template: SocialTaskTemplate | null;
}

/**
 * Instant full-duration resolve (plan → apply entire clock in one jump).
 * Prefer assign + Pass Time progressive path in SocialLab.
 */
export function resolveSocialTask(input: SocialTaskInput): SocialTaskResult {
  const template = getSocialTaskTemplate(input.taskId) ?? null;
  const planned = planSocialTask({
    taskId: input.taskId,
    primary: input.primary,
    partner: input.partner ?? null,
    relationships: input.relationships,
  });

  const emptyEffects = (): SocialTaskResult['effects'] => ({
    pressure: [],
    shortTerm: [],
    longTerm: [],
    flags: [],
  });

  if (!planned.ok) {
    return {
      primary: input.primary,
      partner: input.partner ?? null,
      relationships: input.relationships,
      log: [planned.reason ?? 'Task could not be planned.'],
      effects: emptyEffects(),
      template,
    };
  }

  const assignment = createAssignment({
    taskId: input.taskId,
    label: planned.label,
    participantIds: planned.participantIds,
    totalMinutes: planned.totalMinutes,
    plan: planned.plan,
  });

  const unitsById: Record<string, DetailedUnit> = {
    [input.primary.id]: input.primary,
  };
  if (input.partner) unitsById[input.partner.id] = input.partner;

  const applied = progressTaskBoard(
    [assignment],
    { unitsById, relationships: input.relationships },
    assignment.totalMinutes
  );

  const primary = applied.state.unitsById[input.primary.id] ?? input.primary;
  const partner = input.partner
    ? applied.state.unitsById[input.partner.id] ?? input.partner
    : null;

  const effects = emptyEffects();
  effects.flags = [...applied.flags];
  for (const ev of applied.events) {
    for (const d of ev.continuousSlice.pressure) {
      effects.pressure.push({ unitId: d.unitId, id: d.id, delta: d.delta });
    }
    for (const d of ev.continuousSlice.shortTerm) {
      effects.shortTerm.push({
        fromId: d.fromId,
        toId: d.toId,
        id: d.id,
        delta: d.delta,
      });
    }
    for (const d of ev.continuousSlice.longTerm) {
      effects.longTerm.push({
        fromId: d.fromId,
        toId: d.toId,
        id: d.id,
        delta: d.delta,
      });
    }
    if (ev.completion) {
      for (const d of ev.completion.pressure) {
        effects.pressure.push({ unitId: d.unitId, id: d.id, delta: d.delta });
      }
      for (const d of ev.completion.shortTerm) {
        effects.shortTerm.push({
          fromId: d.fromId,
          toId: d.toId,
          id: d.id,
          delta: d.delta,
        });
      }
      for (const d of ev.completion.longTerm) {
        effects.longTerm.push({
          fromId: d.fromId,
          toId: d.toId,
          id: d.id,
          delta: d.delta,
        });
      }
    }
  }

  const log = [
    `Resolved “${planned.label}” over ${planned.totalMinutes}m (instant full clock).`,
    ...applied.log,
  ];

  return {
    primary,
    partner,
    relationships: applied.state.relationships,
    log,
    effects,
    template,
  };
}

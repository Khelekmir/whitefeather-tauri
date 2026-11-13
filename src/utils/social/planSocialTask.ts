/**
 * Build progressive TaskEffectPlan for social catalog tasks.
 * Continuous deltas drip on Pass Time; completion fires when assignment ends.
 */

import { getSocialTaskTemplate } from '../../data/social/socialLabScaffold';
import type { Unit as DetailedUnit } from '../../types/characters';
import {
  sexualDesireAllowed,
  type RelationshipGraph,
} from './relationshipState';
import { SOCIAL_TASK_TUNING as T } from './resolveSocialTask';
import { evaluateSocialBondGate } from './socialBondGate';
import {
  emptyEffectPlan,
  snapTaskMinutes,
  type TaskEffectPlan,
  type TaskCompletionMutation,
} from './taskAssignmentClock';

export interface PlanSocialTaskInput {
  taskId: string;
  primary: DetailedUnit;
  partner?: DetailedUnit | null;
  /** Required for LT social gates on partnered talk/leisure/care. */
  relationships?: RelationshipGraph;
  /** Lab preview: build effect plan even when bond gate would block assign. */
  skipBondGate?: boolean;
}

export interface PlanSocialTaskResult {
  ok: boolean;
  reason?: string;
  label: string;
  totalMinutes: number;
  participantIds: string[];
  plan: TaskEffectPlan;
}

function plan(): TaskEffectPlan {
  return emptyEffectPlan();
}

function pushPressure(
  p: TaskEffectPlan['continuous'] | TaskEffectPlan['completion'],
  unitId: string,
  id: TaskEffectPlan['continuous']['pressure'][0]['id'],
  delta: number
): void {
  if (delta === 0) return;
  p.pressure.push({ unitId, id, delta });
}

function pushST(
  p: TaskEffectPlan['continuous'] | TaskEffectPlan['completion'],
  fromId: string,
  toId: string,
  id: TaskEffectPlan['continuous']['shortTerm'][0]['id'],
  delta: number
): void {
  if (delta === 0) return;
  p.shortTerm.push({ fromId, toId, id, delta });
}

function pushLT(
  p: TaskEffectPlan['continuous'] | TaskEffectPlan['completion'],
  fromId: string,
  toId: string,
  id: TaskEffectPlan['continuous']['longTerm'][0]['id'],
  delta: number
): void {
  if (delta === 0) return;
  p.longTerm.push({ fromId, toId, id, delta });
}

function mutualWarmth(
  dest: TaskEffectPlan['continuous'] | TaskEffectPlan['completion'],
  a: string,
  b: string,
  warmth: number
): void {
  pushST(dest, a, b, 'warmth', warmth);
  pushST(dest, b, a, 'warmth', warmth);
}

function mutualFamiliarity(
  dest: TaskEffectPlan['continuous'] | TaskEffectPlan['completion'],
  a: string,
  b: string,
  fam: number
): void {
  pushLT(dest, a, b, 'familiarity', fam);
  pushLT(dest, b, a, 'familiarity', fam);
}

function mutualTrust(
  dest: TaskEffectPlan['continuous'] | TaskEffectPlan['completion'],
  a: string,
  b: string,
  trust: number
): void {
  pushLT(dest, a, b, 'trust', trust);
  pushLT(dest, b, a, 'trust', trust);
}

/**
 * Classify catalog effects into continuous vs completion budgets.
 */
export function planSocialTask(input: PlanSocialTaskInput): PlanSocialTaskResult {
  const template = getSocialTaskTemplate(input.taskId);
  if (!template) {
    return {
      ok: false,
      reason: `Unknown social task: ${input.taskId}`,
      label: input.taskId,
      totalMinutes: snapTaskMinutes(30),
      participantIds: [input.primary.id],
      plan: plan(),
    };
  }

  const primary = input.primary;
  const partner = input.partner ?? null;

  if (template.requiresPartner && !partner) {
    return {
      ok: false,
      reason: `Needs a partner for “${template.label}”.`,
      label: template.label,
      totalMinutes: snapTaskMinutes(template.timeCostMinutes ?? 30),
      participantIds: [primary.id],
      plan: plan(),
    };
  }

  if (!input.skipBondGate) {
    const gate = evaluateSocialBondGate({
      taskId: template.id,
      taskLabel: template.label,
      primary,
      partner,
      relationships: input.relationships ?? {},
    });
    if (!gate.ok) {
      return {
        ok: false,
        reason: gate.reason ?? `Bond too cold for “${template.label}”.`,
        label: template.label,
        totalMinutes: snapTaskMinutes(template.timeCostMinutes ?? 30),
        participantIds: partner ? [primary.id, partner.id] : [primary.id],
        plan: plan(),
      };
    }
  }

  const participantIds = partner
    ? [primary.id, partner.id]
    : [primary.id];
  const totalMinutes = snapTaskMinutes(template.timeCostMinutes ?? 30);
  const p = plan();

  switch (template.id) {
    case 'gather_firewood': {
      const G = T.gatherFirewood;
      pushPressure(p.continuous, primary.id, 'energy', -G.energyCost);
      if (!partner) {
        pushPressure(p.continuous, primary.id, 'pride', G.soloPride);
        pushPressure(p.continuous, primary.id, 'stress', -G.soloStressRelief);
      } else {
        pushPressure(p.continuous, partner.id, 'energy', -G.energyCost);
        pushPressure(p.continuous, primary.id, 'belonging', G.partnerBelonging);
        pushPressure(p.continuous, partner.id, 'belonging', G.partnerBelonging);
        mutualWarmth(p.continuous, primary.id, partner.id, G.warmth);
        mutualFamiliarity(p.completion, primary.id, partner.id, G.familiarity);
      }
      p.completion.flags.push('gathered_firewood');
      break;
    }
    case 'set_up_camp': {
      const G = T.setUpCamp;
      const mate = partner!;
      pushPressure(p.continuous, primary.id, 'energy', -G.energyCost);
      pushPressure(p.continuous, mate.id, 'energy', -G.energyCost);
      pushPressure(p.continuous, primary.id, 'stress', -G.stressRelief);
      pushPressure(p.continuous, mate.id, 'stress', -G.stressRelief);
      pushPressure(p.continuous, primary.id, 'belonging', G.belonging);
      pushPressure(p.continuous, mate.id, 'belonging', G.belonging);
      mutualWarmth(p.continuous, primary.id, mate.id, G.warmth);
      mutualFamiliarity(p.completion, primary.id, mate.id, G.familiarity);
      p.completion.flags.push('camp_set_up');
      break;
    }
    case 'strike_camp': {
      const G = T.strikeCamp;
      const mate = partner!;
      pushPressure(p.continuous, primary.id, 'energy', -G.energyCost);
      pushPressure(p.continuous, mate.id, 'energy', -G.energyCost);
      pushPressure(p.continuous, primary.id, 'stress', G.stressLoad);
      pushPressure(p.continuous, mate.id, 'stress', G.stressLoad);
      mutualWarmth(p.continuous, primary.id, mate.id, G.warmth);
      mutualFamiliarity(p.completion, primary.id, mate.id, G.familiarity);
      p.completion.flags.push('camp_struck');
      break;
    }
    case 'scout_path': {
      const G = T.scoutPath;
      pushPressure(p.continuous, primary.id, 'energy', -G.energyCost);
      pushPressure(p.continuous, primary.id, 'stress', G.stressLoad);
      if (!partner) {
        pushPressure(p.completion, primary.id, 'pride', G.soloPride);
      } else {
        pushPressure(p.continuous, partner.id, 'energy', -G.energyCost);
        pushPressure(p.continuous, partner.id, 'stress', G.stressLoad);
        mutualWarmth(p.continuous, primary.id, partner.id, G.warmth);
        mutualFamiliarity(p.completion, primary.id, partner.id, G.familiarity);
        mutualTrust(p.completion, primary.id, partner.id, G.trust);
        pushST(p.completion, partner.id, primary.id, 'admiration', G.admiration);
        pushST(
          p.completion,
          partner.id,
          primary.id,
          'gratitude',
          G.gratitudeToScout
        );
      }
      p.completion.flags.push('scouted_path', 'map_intel');
      break;
    }
    case 'share_watch': {
      const G = T.shareWatch;
      const mate = partner!;
      pushPressure(p.continuous, primary.id, 'energy', -G.energyCost);
      pushPressure(p.continuous, mate.id, 'energy', -G.energyCost);
      mutualWarmth(p.continuous, primary.id, mate.id, G.warmth);
      if (sexualDesireAllowed(primary, mate)) {
        pushST(p.continuous, primary.id, mate.id, 'desireHeat', G.desireHeat);
      }
      if (sexualDesireAllowed(mate, primary)) {
        pushST(p.continuous, mate.id, primary.id, 'desireHeat', G.desireHeat);
      }
      mutualFamiliarity(p.completion, primary.id, mate.id, G.familiarity);
      p.completion.flags.push('shared_watch');
      break;
    }
    case 'cook_meal': {
      const G = T.cookMeal;
      pushPressure(p.continuous, primary.id, 'energy', -G.cookEnergyCost);
      if (!partner) {
        pushPressure(p.continuous, primary.id, 'stress', -G.soloStressRelief);
        pushPressure(p.continuous, primary.id, 'pride', G.soloPride);
        pushPressure(p.continuous, primary.id, 'belonging', G.soloBelonging);
      } else {
        pushPressure(p.continuous, primary.id, 'pride', G.soloPride);
        pushPressure(p.continuous, partner.id, 'stress', -G.soloStressRelief);
        pushST(p.completion, partner.id, primary.id, 'gratitude', G.gratitudeToCook);
        mutualWarmth(p.completion, primary.id, partner.id, G.warmthShared);
      }
      p.completion.flags.push('cooked_meal');
      break;
    }
    case 'do_laundry': {
      const G = T.laundry;
      // Light continuous: optional tiny energy; relational payoffs on completion.
      pushPressure(p.continuous, primary.id, 'energy', -4);
      if (partner) {
        pushST(p.completion, primary.id, partner.id, 'gratitude', G.gratitudeToWasher);
        pushST(p.completion, partner.id, primary.id, 'warmth', G.warmthToWashee);
      }
      p.completion.flags.push('laundered');
      p.completion.mutations.push({
        type: 'launderUnderwear',
        unitId: primary.id,
      });
      break;
    }
    case 'bathe': {
      const G = T.bathe;
      pushPressure(p.continuous, primary.id, 'shame', -G.shameRelief);
      p.completion.flags.push('bathed');
      p.completion.mutations.push({
        type: 'batheClearSkin',
        unitId: primary.id,
        peelTorso: true,
      });
      break;
    }
    case 'bathe_together': {
      const G = T.batheTogether;
      const mate = partner!;
      pushPressure(p.continuous, primary.id, 'shame', -T.bathe.shameRelief);
      pushPressure(p.continuous, mate.id, 'shame', -T.bathe.shameRelief);
      mutualWarmth(p.completion, primary.id, mate.id, G.warmth);
      if (sexualDesireAllowed(primary, mate)) {
        pushST(p.completion, primary.id, mate.id, 'desireHeat', G.desireHeat);
      }
      if (sexualDesireAllowed(mate, primary)) {
        pushST(p.completion, mate.id, primary.id, 'desireHeat', G.desireHeat);
      }
      p.completion.flags.push('bathed', 'bathed_together');
      const muts: TaskCompletionMutation[] = [
        { type: 'batheClearSkin', unitId: primary.id, peelTorso: true },
        { type: 'batheClearSkin', unitId: mate.id, peelTorso: true },
      ];
      p.completion.mutations.push(...muts);
      break;
    }
    case 'tend_wounds': {
      const G = T.tendWounds;
      const mate = partner!;
      pushPressure(p.continuous, mate.id, 'stress', -G.patientStressRelief);
      pushST(p.continuous, primary.id, mate.id, 'warmth', G.warmthHealerToPatient);
      pushST(p.completion, mate.id, primary.id, 'gratitude', G.gratitudePatientToHealer);
      pushST(
        p.completion,
        mate.id,
        primary.id,
        'admiration',
        G.admirationPatientToHealer
      );
      p.completion.flags.push('tended_wounds');
      p.completion.mutations.push({
        type: 'tendWounds',
        healerId: primary.id,
        patientId: mate.id,
      });
      break;
    }
    default: {
      // Unknown / residual stub — tiny continuous warmth if paired.
      if (partner) {
        mutualWarmth(p.continuous, primary.id, partner.id, T.stub.warmth);
        mutualFamiliarity(p.completion, primary.id, partner.id, T.stub.familiarity);
      }
      p.completion.flags.push('stub');
      break;
    }
  }

  return {
    ok: true,
    label: template.label,
    totalMinutes,
    participantIds,
    plan: p,
  };
}

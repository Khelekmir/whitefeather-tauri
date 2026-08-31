import type { Unit as DetailedUnit } from '../../types/characters';
import type { RelationshipGraph } from '../social/relationshipState';
import {
  updateEncounterArousal,
  type EncounterArousalState,
} from './encounterArousal';
import {
  bodilyStateFromHormones,
  encounterCycleReceptivityMult,
  isCycleSensitiveTarget,
} from './cycleBodilyState';
import { afterglowGateCredit } from './arousalGate';
import {
  advanceReproduction,
  applySemenDischargesToReproduction,
  inferSpermEntrySite,
} from './conception';
import { dischargeOnClimax, type FluidDischargeEvent } from './fluidDischarge';
import { applyDischargesToRecipientSoil } from './fluidSoil';
import {
  analyzeChannels,
  mergeResolvedChannels,
  type ChannelMergeResult,
  type LewdChannel,
  type ResolvedChannel,
} from './lewdChannels';
import { LEWD_TUNING as T } from './lewdTuning';
import { bandOutcome, outcomeLabel, type LewdOutcomeBand } from './outcomes';
import { hormonesForUnit } from './ovulationCycle';
import { evaluateProactivePush } from './proactiveGiver';

export type { LewdChannel } from './lewdChannels';

export interface LewdChannelsInput {
  proactive: DetailedUnit;
  recipient: DetailedUnit;
  channels: LewdChannel[];
  holdSeconds: number;
  /** Recipient encounter meters. */
  encounter: EncounterArousalState;
  /** Proactive (giver) encounter meters. */
  proactiveEncounter?: EncounterArousalState;
  relationships?: RelationshipGraph;
}

/** @deprecated single-channel shape — prefer LewdChannelsInput */
export interface LewdMoveInput {
  proactive: DetailedUnit;
  recipient: DetailedUnit;
  actorPart: string;
  actionId: string;
  targetPart: string;
  intensity: number;
  holdSeconds: number;
  encounter: EncounterArousalState;
  proactiveEncounter?: EncounterArousalState;
  relationships?: RelationshipGraph;
}

export interface LewdMoveResult {
  summary: string;
  merge: ChannelMergeResult;
  resolved: ResolvedChannel[];
  pleasure: number;
  psychQuality: number;
  physioQuality: number;
  erogenous: number;
  softCap: number;
  encounter: EncounterArousalState;
  proactiveEncounter: EncounterArousalState;
  climaxed: boolean;
  proactiveClimaxed: boolean;
  ruined: boolean;
  proactiveRuined: boolean;
  discharges: FluidDischargeEvent[];
  /** High wetness + genital play — phenomenological tell (not climax fluid). */
  ambientLubrication: boolean;
  bodilyBlurb: string | null;
  fertileCrest01: number;
  /** Recipient after cloth/skin soil writers (caller should adopt). */
  recipientAfterSoil: DetailedUnit;
  conceptionNote: string | null;
  band: LewdOutcomeBand;
  bandLabel: string;
  intimacyRequired: number;
  intimacyAllowed: boolean;
  attentionCost: number;
  attentionTax: number;
  synergy: boolean;
  arousalRequired: number;
  /** Meter arousal + afterglow gate credit (readiness only). */
  arousalEffectiveForGate: number;
  afterglowGateCredit: number;
  arousalHardBlocked: boolean;
  arousalSoftUnready: boolean;
  pushWillingness: number;
  pushReadiness: 'ok' | 'softUnready' | 'hardUnready';
  pushRequiredArousal: number;
  /** Primary / worst channel prefs for lab display. */
  preference: number;
  preferredIntensity: number;
  maxIntensity: number;
  targetName: string;
}

/**
 * Resolve one or more simultaneous channels over a hold duration.
 * Updates recipient meters from received stim and proactive meters from giving.
 */
export function resolveLewdChannels(input: LewdChannelsInput): LewdMoveResult {
  const {
    proactive,
    recipient,
    channels,
    holdSeconds,
    encounter,
    relationships,
  } = input;
  const proactiveEncounter =
    input.proactiveEncounter ?? {
      arousal: 0,
      edge: 0,
      discomfort: 0,
      climaxCount: 0,
      receptivity: 1,
    };

  const giver = evaluateProactivePush(
    proactive,
    recipient,
    channels,
    proactiveEncounter.arousal,
    relationships
  );

  const resolved = analyzeChannels(
    proactive,
    recipient,
    channels,
    encounter.arousal,
    relationships,
    {
      climaxCount: encounter.climaxCount,
      receptivity: encounter.receptivity,
    }
  );
  const merge = mergeResolvedChannels(proactive, recipient, resolved);

  // Cold proactive push taxes what the recipient actually receives.
  const coldPush = giver.pushReadiness !== 'ok';
  let recvPsych = merge.psychQuality;
  let recvPhysio = merge.physioQuality;
  if (coldPush) {
    recvPsych *= T.proactive.coldPushRecipientPsychMult;
    recvPhysio *= T.proactive.coldPushRecipientPhysioMult;
  }

  const fatigueFlat =
    channels.length > 1
      ? T.channels.multiChannelFatiguePerExtra * 12 * (channels.length - 1)
      : 0;
  const seededDiscomfort = Math.min(
    100,
    encounter.discomfort + fatigueFlat + merge.readinessDiscomfortFlat
  );
  const seeded = {
    ...encounter,
    discomfort: seededDiscomfort,
  };

  const allowGains = merge.intimacyAllowed && !merge.arousalHardBlocked;

  const recvHormones = hormonesForUnit(recipient);
  const recvBodily = recvHormones
    ? bodilyStateFromHormones(
        recvHormones,
        recipient.lewdStats.static.ovulationCycleLength || 28
      )
    : null;
  const cycleRecv = recvBodily
    ? encounterCycleReceptivityMult(recvBodily.fertileCrest01)
    : 1;
  // Seed encounter receptivity with cycle crest without fighting climax compounding.
  const seededWithCycle = {
    ...seeded,
    receptivity: Math.max(seeded.receptivity, cycleRecv),
  };

  const next = updateEncounterArousal(seededWithCycle, {
    psychQuality: allowGains ? recvPsych : 0,
    physioQuality: allowGains ? recvPhysio : 0,
    erogenous: merge.erogenous,
    deltaT: Math.max(0.5, holdSeconds),
    overstep: allowGains && merge.overstep,
    overstepSeverity: merge.overstepSeverity,
    violation: merge.violation || merge.arousalHardBlocked,
  });

  const genitalPlay = channels.some((ch) =>
    isCycleSensitiveTarget(ch.targetPart)
  );
  const ambientLubrication =
    !!recvBodily &&
    genitalPlay &&
    recvBodily.wetness01 >= T.cycle.ambientWetnessThreshold;

  const nextProactive = updateEncounterArousal(proactiveEncounter, {
    psychQuality: giver.psychQuality,
    physioQuality: giver.physioQuality,
    erogenous: giver.erogenous,
    deltaT: Math.max(0.5, holdSeconds),
    overstep: false,
    violation: giver.pushReadiness === 'hardUnready' && merge.intimacyRequired > 40,
  });

  const discharges: FluidDischargeEvent[] = [];
  if (ambientLubrication && recvBodily) {
    discharges.push({
      fromId: recipient.id,
      fromSex: recipient.sex,
      kind: 'lubricationSurge',
      volume: recvBodily.wetness01,
      climaxIndex: next.climaxCount,
      note: recvBodily.blurb,
    });
  }
  if (next.climaxed) {
    discharges.push(
      dischargeOnClimax({
        unitId: recipient.id,
        sex: recipient.sex,
        climaxCountAfter: next.climaxCount,
        role: 'recipient',
      })
    );
  }
  const depositSite = inferSpermEntrySite(channels.map((c) => c.targetPart));
  if (nextProactive.climaxed) {
    discharges.push(
      dischargeOnClimax({
        unitId: proactive.id,
        sex: proactive.sex,
        climaxCountAfter: nextProactive.climaxCount,
        role: 'proactive',
        site: proactive.sex === 'M' ? depositSite : undefined,
      })
    );
  }

  const band = bandOutcome(merge.primaryStim, {
    intimacyBlocked: merge.violation,
    arousalHardBlocked: merge.arousalHardBlocked,
    arousalSoftUnready:
      merge.arousalSoftUnready || giver.pushReadiness === 'softUnready',
    climaxed: next.climaxed || nextProactive.climaxed,
    ruined: next.ruined || nextProactive.ruined,
  });

  const primary = [...resolved].sort((a, b) => b.physioScore - a.physioScore)[0]!;

  const pushNote =
    giver.pushReadiness === 'ok'
      ? ''
      : ` · push ${giver.pushReadiness}`;

  let recipientAfterSoil = applyDischargesToRecipientSoil(
    recipient,
    discharges,
    true,
    { encounterArousal: encounter.arousal }
  );
  recipientAfterSoil = applySemenDischargesToReproduction(
    recipientAfterSoil,
    discharges,
    channels.map((c) => c.targetPart)
  );
  // Immediate conception check if deep deposit already meets a live ovum.
  const reproBeat = advanceReproduction(recipientAfterSoil, 0.01);
  recipientAfterSoil = reproBeat.unit;

  return {
    summary: `${merge.summary}${pushNote}`,
    merge,
    resolved,
    pleasure: merge.pleasure,
    psychQuality: recvPsych,
    physioQuality: recvPhysio,
    erogenous: merge.erogenous,
    softCap: next.softCap,
    encounter: {
      arousal: next.arousal,
      edge: next.edge,
      discomfort: next.discomfort,
      climaxCount: next.climaxCount,
      receptivity: next.receptivity,
    },
    proactiveEncounter: {
      arousal: nextProactive.arousal,
      edge: nextProactive.edge,
      discomfort: nextProactive.discomfort,
      climaxCount: nextProactive.climaxCount,
      receptivity: nextProactive.receptivity,
    },
    climaxed: next.climaxed,
    proactiveClimaxed: nextProactive.climaxed,
    ruined: next.ruined,
    proactiveRuined: nextProactive.ruined,
    discharges,
    ambientLubrication,
    bodilyBlurb: recvBodily?.blurb ?? null,
    fertileCrest01: recvBodily?.fertileCrest01 ?? 0,
    recipientAfterSoil,
    conceptionNote: reproBeat.conceived ? reproBeat.conceptionNote : null,
    band,
    bandLabel: outcomeLabel(band),
    intimacyRequired: merge.intimacyRequired,
    intimacyAllowed: merge.intimacyAllowed,
    attentionCost: merge.attentionCost,
    attentionTax: merge.attentionTax,
    synergy: merge.synergy,
    arousalRequired: merge.arousalRequired,
    afterglowGateCredit: afterglowGateCredit(
      encounter.climaxCount,
      encounter.receptivity
    ),
    arousalEffectiveForGate:
      encounter.arousal +
      afterglowGateCredit(encounter.climaxCount, encounter.receptivity),
    arousalHardBlocked: merge.arousalHardBlocked,
    arousalSoftUnready: merge.arousalSoftUnready,
    pushWillingness: giver.pushWillingness,
    pushReadiness: giver.pushReadiness,
    pushRequiredArousal: giver.pushRequiredArousal,
    preference: primary.preference,
    preferredIntensity: primary.preferredIntensity,
    maxIntensity: primary.maxIntensity,
    targetName: primary.targetName,
  };
}

/** Single-channel convenience wrapper. */
export function resolveLewdMove(input: LewdMoveInput): LewdMoveResult {
  return resolveLewdChannels({
    proactive: input.proactive,
    recipient: input.recipient,
    holdSeconds: input.holdSeconds,
    encounter: input.encounter,
    proactiveEncounter: input.proactiveEncounter,
    relationships: input.relationships,
    channels: [
      {
        actorPart: input.actorPart,
        actionId: input.actionId,
        targetPart: input.targetPart,
        intensity: input.intensity,
      },
    ],
  });
}

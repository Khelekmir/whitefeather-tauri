import type { Unit as DetailedUnit } from '../../types/characters';
import type { RelationshipGraph } from '../social/relationshipState';
import {
  createEncounterArousalState,
  updateEncounterArousal,
  type EncounterArousalState,
} from './encounterArousal';
import {
  bodilyStateFromHormones,
  feltWetness,
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
import { bondFromEdge } from './intimacyBond';
import {
  analyzeChannels,
  mergeResolvedChannels,
  type ChannelMergeResult,
  type LewdChannel,
  type ResolvedChannel,
} from './lewdChannels';
import { LEWD_TUNING as T } from './lewdTuning';
import { blendOrificeSlick } from './orificeSlick';
import { bandOutcome, outcomeLabel, type LewdOutcomeBand } from './outcomes';
import { hormonesForUnit } from './ovulationCycle';
import {
  lubricationFlavorFromRate,
  lubricationFlavorLabel,
  type LubricationSoilFlavor,
} from './sceneArousalSoil';
import {
  painPhysRateFromAction,
  painPsychShareFromContext,
} from './painPsych';
import { evaluateProactivePush } from './proactiveGiver';
import { getEdge } from '../social/relationshipState';
import { accrueVaginalSecretion } from './vaginalSecretion';

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
  /** Item bank for clothing barriers / displace (mutated when displacing). */
  itemsById?: Record<string, import('../../types/items').Item>;
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
  /** Any arousal-fluid soil this beat (kiss/fondle and/or genital bonus). */
  ambientLubrication: boolean;
  /** Rate-gated cloth tell: slick / beading / dampening / dripping. */
  lubricationFlavor: LubricationSoilFlavor;
  /** Short log line for Lab, e.g. "beading · cloth". */
  lubricationNote: string | null;
  bodilyBlurb: string | null;
  fertileCrest01: number;
  /** Recipient after cloth/skin soil writers (caller should adopt). */
  recipientAfterSoil: DetailedUnit;
  /** Partner after mounted/cowgirl overflow soil (when posture is mounted). */
  proactiveAfterSoil?: DetailedUnit;
  /** Amount01 diverted onto partner crotch cloth this beat (mounted stub). */
  partnerDrip01?: number;
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
    input.proactiveEncounter ?? createEncounterArousalState();

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
    },
    input.itemsById
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

  // Readiness / multi-channel fatigue seed **psych** only (reluctant / overload).
  const flatFeeScale = Math.max(0.05, holdSeconds / T.defaultHoldSeconds);
  const fatigueFlat =
    channels.length > 1
      ? T.channels.multiChannelFatiguePerExtra *
        12 *
        (channels.length - 1) *
        flatFeeScale
      : 0;
  const psychSeed =
    merge.readinessDiscomfortFlat * flatFeeScale + fatigueFlat;
  const seededPhys = encounter.discomfortPhys ?? 0;
  const seededPsych = Math.min(
    100,
    (encounter.discomfortPsych ?? encounter.discomfort ?? 0) + psychSeed
  );
  const seeded = {
    ...encounter,
    discomfortPhys: seededPhys,
    discomfortPsych: seededPsych,
    discomfort: Math.max(seededPhys, seededPsych),
  };

  // Hard-unready rebuffs the beat. Intimacy objection keeps channel physio
  // (body-commit) and any willing-channel psych soft-OR from merge.
  const allowPsychGains = !merge.arousalHardBlocked;
  const allowPhysioGains =
    !merge.arousalHardBlocked && recvPhysio > 0.01;

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
  const seededWithCycle = {
    ...seeded,
    receptivity: Math.max(seeded.receptivity, cycleRecv),
  };

  const bondEdge = relationships
    ? getEdge(relationships, recipient.id, proactive.id)
    : null;
  const bond = bondFromEdge(bondEdge);
  const painPsychShare = painPsychShareFromContext({
    bond,
    arousal: encounter.arousal,
    recipient,
    softUnready: merge.arousalSoftUnready,
    hardUnready: merge.arousalHardBlocked || merge.violation,
  });
  const painPhysPerSec =
    allowPhysioGains && merge.pain > 0
      ? painPhysRateFromAction({
          pain: merge.pain,
          intensity: merge.painIntensity || 5,
          recipient,
        })
      : 0;

  const next = updateEncounterArousal(seededWithCycle, {
    psychQuality: allowPsychGains ? recvPsych : 0,
    physioQuality: allowPhysioGains ? recvPhysio : 0,
    erogenous: merge.erogenous,
    deltaT: Math.max(0.5, holdSeconds),
    sex: recipient.sex,
    overstep: allowPhysioGains && merge.overstep,
    overstepSeverity: merge.overstepSeverity,
    violation: merge.violation || merge.arousalHardBlocked,
    painPhysPerSec,
    painPsychShare,
    overstepPsychBoost:
      merge.arousalSoftUnready || merge.violation ? 1.25 : 1,
    estrogen: recvHormones?.estrogen,
    testosterone: recvHormones?.testosterone,
    hypersensStimIntensity: allowPhysioGains
      ? merge.hypersensStimIntensity
      : 0,
  });

  const genitalPlay = channels.some((ch) =>
    isCycleSensitiveTarget(ch.targetPart)
  );
  // Wetness follows body contact / arousal, not the intimacy objection.
  const beatQuality01 = Math.max(
    0,
    Math.min(
      1,
      allowPsychGains
        ? (recvPsych + recvPhysio) / 2
        : recvPhysio * 0.85
    )
  );

  // Fluid truth: arousal-gated secretion → orifice retain + cloth weep.
  let workingRecipient = recipient;
  let secretionCloth01 = 0;
  let secretionRatePerSec = 0;
  if (allowPhysioGains && recipient.sex === 'F' && recvBodily) {
    const secretion = accrueVaginalSecretion({
      unit: recipient,
      encounterArousal: next.arousal,
      holdSeconds,
      genitalPlay,
      bodily: recvBodily,
      beatQuality01,
    });
    workingRecipient = secretion.unit;
    secretionCloth01 = secretion.cloth01;
    secretionRatePerSec = secretion.ratePerSec;
  }

  const orificeWet01 = blendOrificeSlick(
    workingRecipient.lewdStats.dynamic.orificeSlick?.vagina
  ).wet01;
  const recvFeltWet =
    recipient.sex === 'F' && recvBodily
      ? feltWetness(recvBodily.wetness01, {
          lust: workingRecipient.lewdStats.dynamic.lust ?? 0,
          orificeWet01,
          lubricationRate01: recvBodily.lubricationRate01,
        })
      : null;

  const proactiveHormones = hormonesForUnit(proactive);
  const nextProactive = updateEncounterArousal(proactiveEncounter, {
    psychQuality: giver.psychQuality,
    physioQuality: giver.physioQuality,
    erogenous: giver.erogenous,
    deltaT: Math.max(0.5, holdSeconds),
    sex: proactive.sex,
    overstep: false,
    violation: giver.pushReadiness === 'hardUnready' && merge.intimacyRequired > 40,
    estrogen: proactiveHormones?.estrogen,
    testosterone: proactiveHormones?.testosterone,
  });

  const lubricationFlavor: LubricationSoilFlavor =
    secretionCloth01 >= 0.002 || secretionRatePerSec >= 0.0006
      ? lubricationFlavorFromRate(
          Math.max(secretionRatePerSec, secretionCloth01 / Math.max(0.5, holdSeconds))
        )
      : 'none';
  const word = lubricationFlavorLabel(lubricationFlavor);
  const feltForNote = recvFeltWet?.feltWetness ?? 0;
  const lubricationNote =
    lubricationFlavor === 'none'
      ? null
      : genitalPlay && feltForNote >= T.cycle.ambientWetnessThreshold
        ? `${word} · genital flush`
        : `${word} · cloth`;
  const ambientLubrication = lubricationFlavor !== 'none' && secretionCloth01 >= 0.002;

  const discharges: FluidDischargeEvent[] = [];
  if (ambientLubrication && recipient.sex === 'F') {
    discharges.push({
      fromId: recipient.id,
      fromSex: recipient.sex,
      kind: 'lubricationSurge',
      // Soil path applies volume×0.55 — pre-scale so cloth gets secretionCloth01.
      volume: secretionCloth01 / 0.55,
      climaxIndex: next.climaxCount,
      note: lubricationNote ?? recvBodily?.blurb ?? 'arousal slick',
    });
  }
  if (next.climaxed) {
    const tipMods = recipient.lewdStats.static.climaxTipMods;
    let characterVolumeMult = 1;
    let tipModLabel: string | undefined;
    if (tipMods?.tipTargetIncludes?.length) {
      const hit = tipMods.tipTargetIncludes.some((sub) =>
        channels.some((ch) => ch.targetPart.toLowerCase().includes(sub.toLowerCase()))
      );
      if (hit) {
        characterVolumeMult = tipMods.volumeMult ?? 1;
        tipModLabel = tipMods.label;
      }
    }
    discharges.push(
      dischargeOnClimax({
        unitId: recipient.id,
        sex: recipient.sex,
        climaxCountAfter: next.climaxCount,
        role: 'recipient',
        female:
          recipient.sex === 'F'
            ? {
                edgeAtClimax: next.edgeAtClimax,
                arousalAtClimax: next.arousalAtClimax,
                climaxCountAfter: next.climaxCount,
                lubricationRate01: recvBodily?.lubricationRate01 ?? 0.7,
                orificeWet01,
                characterVolumeMult,
              }
            : undefined,
      })
    );
    if (tipModLabel) {
      const last = discharges[discharges.length - 1]!;
      last.note = `${last.note} · ${tipModLabel}`;
    }
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
        female:
          proactive.sex === 'F' && proactiveHormones
            ? {
                edgeAtClimax: nextProactive.edgeAtClimax,
                arousalAtClimax: nextProactive.arousalAtClimax,
                climaxCountAfter: nextProactive.climaxCount,
                lubricationRate01: bodilyStateFromHormones(
                  proactiveHormones,
                  proactive.lewdStats.static.ovulationCycleLength || 28
                ).lubricationRate01,
                orificeWet01: blendOrificeSlick(
                  proactive.lewdStats.dynamic.orificeSlick?.vagina
                ).wet01,
              }
            : undefined,
      })
    );
  }

  const band = bandOutcome(merge.primaryStim, {
    intimacyBlocked: merge.violation,
    clothingBlocked: merge.clothingBlocked,
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

  const soilResult = applyDischargesToRecipientSoil(
    workingRecipient,
    discharges,
    true,
    {
      encounterArousal: next.arousal,
      posture: encounter.posture ?? 'standing',
      partner: proactive,
    }
  );
  let recipientAfterSoil = soilResult.unit;
  const proactiveAfterSoil = soilResult.partner;
  const partnerDrip01 = soilResult.partnerDrip01;
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
      discomfortPhys: next.discomfortPhys,
      discomfortPsych: next.discomfortPsych,
      climaxCount: next.climaxCount,
      receptivity: next.receptivity,
      refractorySecondsRemaining: next.refractorySecondsRemaining,
      orgasmSecondsRemaining: next.orgasmSecondsRemaining ?? 0,
      posture: next.posture ?? encounter.posture ?? 'standing',
    },
    proactiveEncounter: {
      arousal: nextProactive.arousal,
      edge: nextProactive.edge,
      discomfort: nextProactive.discomfort,
      discomfortPhys: nextProactive.discomfortPhys,
      discomfortPsych: nextProactive.discomfortPsych,
      climaxCount: nextProactive.climaxCount,
      receptivity: nextProactive.receptivity,
      refractorySecondsRemaining: nextProactive.refractorySecondsRemaining,
      orgasmSecondsRemaining: nextProactive.orgasmSecondsRemaining ?? 0,
      posture: nextProactive.posture ?? proactiveEncounter.posture ?? 'standing',
    },
    climaxed: next.climaxed,
    proactiveClimaxed: nextProactive.climaxed,
    ruined: next.ruined,
    proactiveRuined: nextProactive.ruined,
    discharges,
    ambientLubrication,
    lubricationFlavor,
    lubricationNote,
    bodilyBlurb: recvBodily?.blurb ?? null,
    fertileCrest01: recvBodily?.fertileCrest01 ?? 0,
    recipientAfterSoil,
    proactiveAfterSoil,
    partnerDrip01,
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

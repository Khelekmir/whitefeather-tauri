import type { LewdActionDef, LewdAccessTier } from '../../data/lewd/lewdCatalog';
import type { Unit as DetailedUnit } from '../../types/characters';
import type { Item } from '../../types/items';
import {
  getEdge,
  orientationResistance01,
  type RelationshipGraph,
} from '../social/relationshipState';
import {
  evaluateArousalReadiness,
  requiredArousalForAct,
  type ArousalReadiness,
} from './arousalGate';
import { calcStimulation, type StimulationResult } from './calcStimulation';
import {
  clothingBarrierForLewdTarget,
  clothingIntimacyMult,
  clothingStimMult,
  type ClothingAccessMode,
  type ClothingBarrier,
} from './clothingAccess';
import { erogenousRank } from './erogenous';
import {
  bodilyStateFromHormones,
  cyclePhysioMult,
  isCycleSensitiveTarget,
} from './cycleBodilyState';
import { hormonesForUnit } from './ovulationCycle';
import {
  bondFromEdge,
  intimacyAllowedForAct,
  psychBondMultiplier,
  socialMultFromBond,
  type BondSnapshot,
} from './intimacyBond';
import { lewdTargetToBodyParts } from '../../data/lewd/lewdPartCoverage';
import { maxBruiseOnParts } from '../combat/bruise';
import { getLewdAction, getLewdBit, toLewdSexKey } from './lewdCatalogAccess';
import { LEWD_TUNING as T } from './lewdTuning';

/** One concurrent stim locus (hand, mouth, genitals, …). */
export interface LewdChannel {
  actorPart: string;
  actionId: string;
  targetPart: string;
  intensity: number;
  /**
   * Lab timing: programmed length of this locus (seconds).
   * Engine resolve ignores these; Lewd Lab Play re-arms remaining and ticks 1s.
   */
  durationSeconds?: number;
  /** Lab timing: seconds left in the current Play run (0 = idle until Play again). */
  remainingSeconds?: number;
  /**
   * How the actor reaches the target through clothing.
   * over = all layers; under = skip outer soft (shirt/leg); displace = push aside then touch.
   */
  clothingAccess?: ClothingAccessMode;
}

export type AttentionLimb = 'mouth' | 'hands' | 'feet' | 'genitals' | 'other';

export function attentionLimbForActorPart(actorPart: string): AttentionLimb {
  if (
    /^(lips|tongue|teeth|mouth)/i.test(actorPart) ||
    actorPart === 'lips' ||
    actorPart === 'tongue' ||
    actorPart === 'teeth'
  ) {
    return 'mouth';
  }
  if (/^hand/i.test(actorPart)) return 'hands';
  if (/^foot/i.test(actorPart)) return 'feet';
  if (
    /^(penis|vagina|mons|breast|anus|thigh)/i.test(actorPart) ||
    actorPart === 'breast' ||
    actorPart === 'monsVenus' ||
    actorPart === 'vaginaShallow' ||
    actorPart === 'thighs'
  ) {
    return 'genitals';
  }
  return 'other';
}

/** Cost toward attention budget (hands can stack to 2). */
export function attentionCostForActorPart(actorPart: string): number {
  const limb = attentionLimbForActorPart(actorPart);
  if (limb === 'hands') return 1;
  if (limb === 'mouth' || limb === 'feet' || limb === 'genitals') return 1;
  return 0.5;
}

export function totalAttentionCost(channels: LewdChannel[]): number {
  // Hands: each hand* channel costs 1 (two-hand play = 2).
  // Mouth/genitals/feet: max 1 each even if somehow duplicated.
  let hands = 0;
  let mouth = 0;
  let feet = 0;
  let genitals = 0;
  let other = 0;
  for (const ch of channels) {
    const limb = attentionLimbForActorPart(ch.actorPart);
    const cost = attentionCostForActorPart(ch.actorPart);
    if (limb === 'hands') hands += cost;
    else if (limb === 'mouth') mouth = Math.max(mouth, cost);
    else if (limb === 'feet') feet = Math.max(feet, cost);
    else if (limb === 'genitals') genitals = Math.max(genitals, cost);
    else other += cost;
  }
  return hands + mouth + feet + genitals + other;
}

export function attentionTaxMultiplier(channels: LewdChannel[]): number {
  const used = totalAttentionCost(channels);
  const overflow = Math.max(0, used - T.channels.attentionBudget);
  return 1 / (1 + T.channels.attentionTaxPerExtra * overflow);
}

/** Rough compatibility: mouth+body, hand+genitals, etc. */
export function channelsHaveSynergy(channels: LewdChannel[]): boolean {
  if (channels.length < 2) return false;
  const limbs = new Set(channels.map((c) => attentionLimbForActorPart(c.actorPart)));
  const hasMouth = limbs.has('mouth');
  const hasHands = limbs.has('hands');
  const hasGen = limbs.has('genitals');
  return (hasMouth && (hasHands || hasGen)) || (hasHands && hasGen);
}

export interface ResolvedChannel {
  channel: LewdChannel;
  action: LewdActionDef;
  targetName: string;
  actorName: string;
  stimulation: StimulationResult;
  preference: number;
  preferredIntensity: number;
  maxIntensity: number;
  erogenous: number;
  psychQuality: number;
  physioQuality: number;
  intimacyRequired: number;
  intimacyAllowed: boolean;
  arousalRequired: number;
  arousalReadiness: ArousalReadiness;
  overstep: boolean;
  overstepSeverity: number;
  physioScore: number;
  /** Catalog action.pain 0–1 (0 if untagged). */
  pain: number;
  clothingBlocked: boolean;
  clothingAccess: ClothingAccessMode;
  accessTier: LewdAccessTier;
  clothingBarrier: ClothingBarrier | null;
}

export interface ChannelMergeResult {
  channels: ResolvedChannel[];
  psychQuality: number;
  physioQuality: number;
  erogenous: number;
  overstep: boolean;
  overstepSeverity: number;
  violation: boolean;
  intimacyAllowed: boolean;
  intimacyRequired: number;
  arousalHardBlocked: boolean;
  arousalSoftUnready: boolean;
  arousalRequired: number;
  attentionCost: number;
  attentionTax: number;
  synergy: boolean;
  pleasure: number;
  /** Worst / primary stim for banding display. */
  primaryStim: StimulationResult;
  summary: string;
  /**
   * Flat **psych** discomfort to seed before tick (unready attempts).
   * Does not raise physical discomfort.
   */
  readinessDiscomfortFlat: number;
  /** Strongest catalog pain among receptive channels (0–1). */
  pain: number;
  /** Intensity of the channel contributing `pain`. */
  painIntensity: number;
  clothingBlocked: boolean;
}

function socialContext(
  proactive: DetailedUnit,
  recipient: DetailedUnit,
  relationships?: RelationshipGraph
): {
  bond: BondSnapshot;
  socialMult: number;
  orientationResistance: number;
} {
  // Recipient → proactive: how the receiving partner feels about the actor.
  const edge = relationships
    ? getEdge(relationships, recipient.id, proactive.id)
    : null;
  const bond = bondFromEdge(edge);
  const orientationResistance = orientationResistance01(
    recipient,
    proactive,
    edge
  );
  return {
    bond,
    socialMult: socialMultFromBond(bond),
    orientationResistance,
  };
}

function resolveOneChannel(
  proactive: DetailedUnit,
  recipient: DetailedUnit,
  channel: LewdChannel,
  ctx: ReturnType<typeof socialContext>,
  currentArousal: number,
  gateOpts: { climaxCount: number; receptivity: number },
  itemsById?: Record<string, Item>
): ResolvedChannel {
  const action = getLewdAction(channel.actionId);
  if (!action) throw new Error(`Unknown lewd action: ${channel.actionId}`);

  const targetBit = getLewdBit(recipient.sex, channel.targetPart);
  const actorBit = getLewdBit(proactive.sex, channel.actorPart);
  if (!targetBit) throw new Error(`Unknown target part: ${channel.targetPart}`);

  const partRow = recipient.lewdStats.itemizedLewd[channel.targetPart];
  const preference = partRow?.preference ?? 5;
  const basePreferredIntensity = partRow?.prefIntensity ?? 3;
  const maxIntensity = partRow?.maxIntensity ?? 8;
  // Combat bruise on mapped body parts lowers what feels “attuned.”
  const bruiseSev = maxBruiseOnParts(
    recipient.combatStats.itemizedHealth,
    lewdTargetToBodyParts(channel.targetPart)
  );
  const preferredIntensity = Math.max(
    0.5,
    Math.min(
      maxIntensity,
      basePreferredIntensity -
        bruiseSev * T.bruisePrefIntensityPenalty
    )
  );
  const sensMult = partRow?.sensitivity ?? 1;
  const catalogSens = targetBit.sensitivity;
  const sensitivity = catalogSens * sensMult;
  const erogenous = erogenousRank(catalogSens);

  const clothingAccess: ClothingAccessMode = channel.clothingAccess ?? 'over';
  const accessTier: LewdAccessTier = action.access ?? 'clothOk';
  const clothingBarrier =
    accessTier === 'any'
      ? null
      : clothingBarrierForLewdTarget(
          recipient,
          itemsById,
          channel.targetPart,
          clothingAccess
        );

  let clothingBlocked = false;
  if (clothingBarrier) {
    if (clothingBarrier.hardBlocked) {
      clothingBlocked = true;
    } else if (
      (accessTier === 'skin' || accessTier === 'orifice') &&
      !clothingBarrier.skinClear
    ) {
      clothingBlocked = true;
    }
  }

  const softBarrier = clothingBarrier?.softBarrier01 ?? 0;
  const stimClothMult =
    clothingBlocked || accessTier === 'any'
      ? 1
      : clothingStimMult(softBarrier);
  const intimacyClothMult =
    clothingBlocked || accessTier === 'any'
      ? 1
      : clothingIntimacyMult(softBarrier);

  const dominanceActor = proactive.lewdStats.static.submissive ? 0.7 : 1.2;
  const dominanceRecipient = recipient.lewdStats.static.submissive ? 0.7 : 1.2;
  const submissionMultiplier = dominanceActor / Math.max(0.3, dominanceRecipient);
  const attackerMultiplier = Math.max(
    0.85,
    proactive.lewdStats.static.charisma / 5
  );

  const hormones = hormonesForUnit(recipient);
  const lengthDays = recipient.lewdStats.static.ovulationCycleLength || 28;
  const bodily = hormones
    ? bodilyStateFromHormones(hormones, lengthDays)
    : null;
  const genitalTarget = isCycleSensitiveTarget(channel.targetPart);
  const sensForStim =
    bodily && genitalTarget
      ? sensitivity * bodily.genitalSensMult
      : sensitivity;
  const cycleMult =
    hormones != null
      ? cyclePhysioMult({
          hormones,
          lengthDays,
          genitalTarget,
        })
      : 1;
  const stim = calcStimulation({
    sex: toLewdSexKey(recipient.sex),
    attackerMultiplier,
    stimulationFactor: action.stimulation,
    submissionMultiplier,
    sensitivity: sensForStim,
    estrogen: hormones?.estrogen ?? 1,
    progesterone: hormones?.progesterone ?? 1,
    cyclePhysioMult: hormones != null ? cycleMult : undefined,
    intensity: channel.intensity,
    maxIntensity,
    preferredIntensity,
    preference,
  });

  // Fertile crest slightly sweetens interest (lust already cycle-driven).
  const crestInterest =
    bodily != null ? 1 + 0.12 * bodily.fertileCrest01 : 1;
  const interest = Math.max(
    0.2,
    ((recipient.lewdStats.dynamic.lust || 40) / 50) * crestInterest
  );
  const intimacyRequired =
    (action.intimacy * 4.8 +
      ((actorBit?.intimacy ?? 3) + targetBit.intimacy) * 0.9 +
      3.8 * Math.log1p(channel.intensity)) *
    intimacyClothMult;
  const intimacyAllowed = intimacyAllowedForAct(
    ctx.bond,
    intimacyRequired,
    ctx.orientationResistance
  );

  const arousalRequired = requiredArousalForAct(
    action.intimacy,
    targetBit.intimacy,
    targetBit.sensitivity
  );
  const arousalReadiness = evaluateArousalReadiness(
    currentArousal,
    arousalRequired,
    gateOpts
  );

  const overstep =
    stim.overMax || stim.intensityDelta > T.overstepAbovePreferred;
  const overstepSeverity = Math.max(
    0,
    Math.min(
      1,
      Math.max(
        stim.overMax ? (channel.intensity - maxIntensity) / 4 : 0,
        (stim.intensityDelta - T.overstepAbovePreferred) / 4
      )
    )
  );

  const P = T.psych;
  const prefNorm = Math.max(0, Math.min(1, preference / 10));
  const context = Math.max(0, Math.min(1, interest * ctx.socialMult));
  const psychRaw =
    P.preferenceWeight * prefNorm +
    P.intensityMatchWeight * stim.intensityMatch +
    P.desireContextWeight * context;
  const intimacyPsych = Math.max(0.15, Math.min(1, action.intimacy / 9));
  const bondPsych = psychBondMultiplier(
    ctx.bond,
    action.intimacy,
    ctx.orientationResistance
  );
  // Fertile crest sweetens light skinship (kiss/caress) more than deep acts.
  const skinshipCrest =
    bodily != null && action.intimacy <= 4.5
      ? 1 + 0.16 * bodily.fertileCrest01
      : bodily != null
        ? 1 + 0.06 * bodily.fertileCrest01
        : 1;

  let psychQuality = 0;
  let physioQuality = 0;
  const receptiveEnough =
    intimacyAllowed &&
    arousalReadiness !== 'hardUnready' &&
    !clothingBlocked;
  if (receptiveEnough) {
    psychQuality = Math.min(
      1.25,
      psychRaw *
        P.outputScale *
        (0.55 + 0.45 * intimacyPsych) *
        bondPsych *
        skinshipCrest
    );
    physioQuality = Math.min(
      1,
      stim.physio * (0.35 + 0.65 * erogenous) * stimClothMult
    );
    if (arousalReadiness === 'softUnready') {
      psychQuality *= T.arousalGate.softUnreadyQualityMult;
      physioQuality *= T.arousalGate.softUnreadyQualityMult;
    }
  }

  const physioScore = physioQuality * (0.25 + 0.75 * erogenous);
  const pain =
    receptiveEnough && action.pain != null && action.pain > 0
      ? Math.max(0, Math.min(1, action.pain))
      : 0;

  return {
    channel,
    action,
    targetName: targetBit.name,
    actorName: actorBit?.name ?? channel.actorPart,
    stimulation: stim,
    preference,
    preferredIntensity,
    maxIntensity,
    erogenous,
    psychQuality,
    physioQuality,
    intimacyRequired,
    intimacyAllowed,
    arousalRequired,
    arousalReadiness,
    overstep,
    overstepSeverity,
    physioScore,
    pain,
    clothingBlocked,
    clothingAccess,
    accessTier,
    clothingBarrier,
  };
}

/**
 * Soft-OR combine qualities: 1 - Π(1 - q_i).
 */
export function softOr(qualities: number[]): number {
  let miss = 1;
  for (const q of qualities) {
    miss *= 1 - Math.max(0, Math.min(1, q));
  }
  return 1 - miss;
}

/**
 * Merge N resolved channels into one arousal update payload.
 */
export function mergeResolvedChannels(
  proactive: DetailedUnit,
  recipient: DetailedUnit,
  resolved: ResolvedChannel[]
): ChannelMergeResult {
  if (resolved.length === 0) {
    throw new Error('At least one channel required');
  }

  const C = T.channels;
  const channels = resolved.map((r) => r.channel);
  const attentionCost = totalAttentionCost(channels);
  const attentionTax = attentionTaxMultiplier(channels);
  const synergy = channelsHaveSynergy(channels);

  const sorted = [...resolved].sort((a, b) => b.physioScore - a.physioScore);
  const primary = sorted[0]!;
  const secondaries = sorted.slice(1);

  // Psych: soft-OR, then synergy + attention tax
  let psychQuality = softOr(resolved.map((r) => r.psychQuality));
  if (synergy) psychQuality = Math.min(1.15, psychQuality * C.synergyPsychBonus);
  psychQuality *= attentionTax;

  // Physio: primary + diminishing secondaries
  let physioQuality = primary.physioQuality;
  secondaries.forEach((sec, i) => {
    physioQuality +=
      sec.physioQuality *
      C.secondaryPhysioFraction *
      Math.pow(C.secondaryPhysioDecay, i);
  });
  physioQuality = Math.min(1.15, physioQuality * attentionTax);

  const erogenous = Math.max(...resolved.map((r) => r.erogenous));

  const anyViolation = resolved.some((r) => !r.intimacyAllowed);
  const intimacyAllowed = !anyViolation;
  const intimacyRequired = Math.max(...resolved.map((r) => r.intimacyRequired));

  const arousalHardBlocked = resolved.some(
    (r) => r.intimacyAllowed && r.arousalReadiness === 'hardUnready'
  );
  const arousalSoftUnready =
    !arousalHardBlocked &&
    resolved.some(
      (r) => r.intimacyAllowed && r.arousalReadiness === 'softUnready'
    );
  const arousalRequired = Math.max(...resolved.map((r) => r.arousalRequired));

  let readinessDiscomfortFlat = 0;
  if (arousalHardBlocked) {
    readinessDiscomfortFlat += T.arousalGate.hardUnreadyDiscomfort;
  } else if (arousalSoftUnready) {
    readinessDiscomfortFlat += T.arousalGate.softUnreadyDiscomfort;
  }

  // If any channel is hard-unready, zero merged pleasure (attempt is rebuffed).
  if (arousalHardBlocked || anyViolation) {
    psychQuality = 0;
    physioQuality = 0;
  }

  const overstepSeverities = resolved
    .filter(
      (r) =>
        r.intimacyAllowed &&
        r.arousalReadiness !== 'hardUnready' &&
        r.overstep
    )
    .map((r) => r.overstepSeverity);
  const overstep = overstepSeverities.length > 0;
  const overstepSeverity = overstep ? Math.max(...overstepSeverities) : 0;

  const pleasure = psychQuality * 0.55 + physioQuality * 0.45;

  const pronoun = proactive.sex === 'M' ? 'his' : 'her';
  const bits = resolved.map((r) => {
    if (!r.intimacyAllowed) {
      return `tried to ${r.action.verb} ${recipient.name}'s ${r.targetName} (trust/affection blocked)`;
    }
    if (r.clothingBlocked) {
      return `tried to ${r.action.verb} ${recipient.name}'s ${r.targetName} (blocked by clothing/armor)`;
    }
    if (r.arousalReadiness === 'hardUnready') {
      return `tried to ${r.action.verb} ${recipient.name}'s ${r.targetName} (not aroused enough — needs ~${r.arousalRequired.toFixed(0)})`;
    }
    if (r.arousalReadiness === 'softUnready') {
      return `${r.action.verb} ${recipient.name}'s ${r.targetName} with ${pronoun} ${r.actorName} (pushing readiness)`;
    }
    return `${r.action.verb} ${recipient.name}'s ${r.targetName} with ${pronoun} ${r.actorName}`;
  });
  const summary =
    resolved.length === 1
      ? `${proactive.name} ${bits[0]}.`
      : `${proactive.name} simultaneously ${bits.join('; ')}.`;

  const worstOver = resolved.find(
    (r) =>
      r.overstep &&
      r.intimacyAllowed &&
      r.arousalReadiness !== 'hardUnready'
  );
  const primaryStim = worstOver?.stimulation ?? primary.stimulation;

  let pain = 0;
  let painIntensity = 0;
  for (const r of resolved) {
    if (
      r.intimacyAllowed &&
      r.arousalReadiness !== 'hardUnready' &&
      r.pain > pain
    ) {
      pain = r.pain;
      painIntensity = r.channel.intensity;
    }
  }

  return {
    channels: resolved,
    psychQuality: round3(psychQuality),
    physioQuality: round3(physioQuality),
    erogenous: round3(erogenous),
    overstep,
    overstepSeverity: round3(overstepSeverity),
    violation: anyViolation,
    intimacyAllowed,
    intimacyRequired: round3(intimacyRequired),
    arousalHardBlocked,
    arousalSoftUnready,
    arousalRequired: round3(arousalRequired),
    attentionCost: round3(attentionCost),
    attentionTax: round3(attentionTax),
    synergy,
    pleasure: round3(pleasure),
    primaryStim,
    summary,
    readinessDiscomfortFlat,
    pain: round3(pain),
    painIntensity,
    clothingBlocked: resolved.some((r) => r.clothingBlocked),
  };
}

export function analyzeChannels(
  proactive: DetailedUnit,
  recipient: DetailedUnit,
  channels: LewdChannel[],
  currentArousal: number,
  relationships?: RelationshipGraph,
  gateOpts?: { climaxCount?: number; receptivity?: number },
  itemsById?: Record<string, Item>
): ResolvedChannel[] {
  if (channels.length < 1) throw new Error('Need at least one channel');
  if (channels.length > T.channels.maxChannels) {
    throw new Error(`Max ${T.channels.maxChannels} channels`);
  }
  const ctx = socialContext(proactive, recipient, relationships);
  const gate = {
    climaxCount: gateOpts?.climaxCount ?? 0,
    receptivity: gateOpts?.receptivity ?? 1,
  };
  return channels.map((ch) =>
    resolveOneChannel(
      proactive,
      recipient,
      ch,
      ctx,
      currentArousal,
      gate,
      itemsById
    )
  );
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

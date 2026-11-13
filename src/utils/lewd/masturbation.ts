/**
 * Solo masturbation resolve: dampened self-stim + fantasy psych from eroticMemory.
 */

import type { Item } from '../../types/items';
import type {
  EroticMemoryEntry,
  Unit as DetailedUnit,
} from '../../types/characters';
import {
  getEdge,
  sexualDesireAllowed,
  type RelationshipGraph,
} from '../social/relationshipState';
import { clothingStimMult } from './clothingAccess';
import {
  bodilyStateFromHormones,
  feltWetness,
  encounterCycleReceptivityMult,
  isCycleSensitiveTarget,
} from './cycleBodilyState';
import {
  createEncounterArousalState,
  updateEncounterArousal,
  type EncounterArousalState,
} from './encounterArousal';
import { eroticMemoryFreshness01 } from './eroticMemory';
import { dischargeOnClimax, type FluidDischargeEvent } from './fluidDischarge';
import {
  applyDischargesToRecipientSoil,
  applyMaleOwnCrotchFluid,
} from './fluidSoil';
import { bondFromEdge, type BondSnapshot } from './intimacyBond';
import {
  analyzeChannels,
  softOr,
  type LewdChannel,
  type ResolvedChannel,
} from './lewdChannels';
import { LEWD_TUNING as T } from './lewdTuning';
import { nudgeStandingLust } from './lustDrive';
import {
  computePrecumVolume01,
  maleGenitalClothContext,
  maleUnderwearSemenScore,
  precumFlavorNote,
} from './maleErection';
import { blendOrificeSlick } from './orificeSlick';
import { bandOutcome, outcomeLabel, type LewdOutcomeBand } from './outcomes';
import { hormonesForUnit } from './ovulationCycle';
import {
  lubricationFlavorFromRate,
  lubricationFlavorLabel,
  type LubricationSoilFlavor,
} from './sceneArousalSoil';
import { accrueVaginalSecretion } from './vaginalSecretion';

export type MasturbationFantasyFocus =
  | { kind: 'none' }
  | { kind: 'memory'; memoryId: string }
  | {
      kind: 'override';
      partnerIds: string[];
      actIntimacy: number;
      memoryKind?: EroticMemoryEntry['kind'];
      freshness01?: number;
    };

export interface MasturbationFantasyBreakdown {
  fantasy01: number;
  freshness01: number;
  /** Witnessed vs participated weight applied. */
  kindWeight: number;
  relationship01: number;
  intimacy01: number;
  orientationMult: number;
  partnerIds: string[];
  actIntimacy: number;
  label: string;
}

// kindWeight is a runtime number (tuning literals are narrowed by `as const`).

export interface MasturbationBeatInput {
  unit: DetailedUnit;
  channels: LewdChannel[];
  holdSeconds: number;
  encounter: EncounterArousalState;
  fantasy?: MasturbationFantasyFocus;
  relationships?: RelationshipGraph;
  itemsById?: Record<string, Item>;
  /** Lab / Pass-Time clock for memory freshness. */
  nowHours?: number;
  /** Lookup for fantasy partner units (orientation / names). */
  unitsById?: Record<string, DetailedUnit>;
}

export interface MasturbationBeatResult {
  summary: string;
  resolved: ResolvedChannel[];
  psychQuality: number;
  physioQuality: number;
  /** Partnered-style psych before solo damp / fantasy. */
  partneredPsychRef: number;
  /** Blank-mind solo psych (no fantasy). */
  soloPsychBase: number;
  erogenous: number;
  fantasy: MasturbationFantasyBreakdown;
  encounter: EncounterArousalState;
  climaxed: boolean;
  discharges: FluidDischargeEvent[];
  ambientLubrication: boolean;
  lubricationFlavor: LubricationSoilFlavor;
  lubricationNote: string | null;
  precumNote: string | null;
  unitAfter: DetailedUnit;
  lustFrom: number;
  lustTo: number;
  band: LewdOutcomeBand;
  bandLabel: string;
  arousalHardBlocked: boolean;
  arousalSoftUnready: boolean;
}

function relationship01FromBond(bond: BondSnapshot): number {
  const W = T.masturbation.relationship;
  const raw =
    (bond.desire / 100) * W.desire +
    (bond.desireHeat / 100) * W.desireHeat +
    (bond.affection / 100) * W.affection +
    (bond.familiarity / 100) * W.familiarity +
    (bond.warmth / 100) * W.warmth;
  return Math.max(0, Math.min(1, raw));
}

export function scoreMasturbationFantasy(
  unit: DetailedUnit,
  focus: MasturbationFantasyFocus | undefined,
  nowHours: number,
  relationships?: RelationshipGraph,
  unitsById?: Record<string, DetailedUnit>
): MasturbationFantasyBreakdown {
  const empty: MasturbationFantasyBreakdown = {
    fantasy01: 0,
    freshness01: 0,
    kindWeight: 0,
    relationship01: 0,
    intimacy01: 0,
    orientationMult: 1,
    partnerIds: [],
    actIntimacy: 0,
    label: 'blank mind',
  };
  if (!focus || focus.kind === 'none') return empty;

  let partnerIds: string[] = [];
  let actIntimacy = 0;
  let freshness01 = 1;
  let kindWeight: number = T.masturbation.participatedWeight;
  let label = 'fantasy';

  if (focus.kind === 'memory') {
    const mem = (unit.lewdStats.dynamic.eroticMemory ?? []).find(
      (e) => e.id === focus.memoryId
    );
    if (!mem) return empty;
    partnerIds = mem.partnerIds;
    actIntimacy = mem.actIntimacy;
    freshness01 = eroticMemoryFreshness01(mem, nowHours);
    kindWeight =
      mem.kind === 'witnessed'
        ? T.masturbation.witnessedWeight
        : T.masturbation.participatedWeight;
    label = `${mem.kind} · intimacy ${actIntimacy.toFixed(1)}`;
  } else {
    partnerIds = focus.partnerIds;
    actIntimacy = focus.actIntimacy;
    freshness01 = focus.freshness01 ?? 1;
    kindWeight =
      focus.memoryKind === 'witnessed'
        ? T.masturbation.witnessedWeight
        : T.masturbation.participatedWeight;
    label = `override · intimacy ${actIntimacy.toFixed(1)}`;
  }

  if (!(freshness01 > 0.02) || partnerIds.length === 0) {
    return { ...empty, freshness01, label: 'stale / no partner' };
  }

  let relSum = 0;
  let orientMult = 1;
  for (const pid of partnerIds) {
    const edge = relationships ? getEdge(relationships, unit.id, pid) : null;
    relSum += relationship01FromBond(bondFromEdge(edge));
    const partner = unitsById?.[pid];
    if (partner && !sexualDesireAllowed(unit, partner)) {
      orientMult = Math.min(orientMult, T.masturbation.orientationFantasyMult);
    }
  }
  const relationship01 = relSum / partnerIds.length;
  const intimacy01 = Math.pow(
    Math.max(0, Math.min(1, actIntimacy / T.masturbation.intimacyRef)),
    T.masturbation.intimacyCurve
  );
  const fantasy01 = Math.max(
    0,
    Math.min(
      1,
      freshness01 * kindWeight * relationship01 * intimacy01 * orientMult
    )
  );

  return {
    fantasy01,
    freshness01,
    kindWeight,
    relationship01,
    intimacy01,
    orientationMult: orientMult,
    partnerIds,
    actIntimacy,
    label,
  };
}

function soloChannelQualities(
  r: ResolvedChannel,
  lust: number
): { partneredPsychRef: number; physio: number; softUnready: boolean; hardBlocked: boolean } {
  // Solo self-touch skips partner arousal hard-gates (you can start cold).
  // Clothing hard-blocks still apply. Mild warm-up tax while below partnered needA.
  const bodyContactOk = !r.clothingBlocked;
  const softBarrier = r.clothingBarrier?.softBarrier01 ?? 0;
  const stimCloth =
    r.clothingBlocked || r.accessTier === 'any'
      ? 1
      : clothingStimMult(softBarrier);
  const basePhysio = bodyContactOk
    ? Math.min(
        1,
        r.stimulation.physio * (0.35 + 0.65 * r.erogenous) * stimCloth
      )
    : 0;

  const P = T.psych;
  const prefNorm = Math.max(0, Math.min(1, r.preference / 10));
  const interest = Math.max(0.2, (lust || 40) / 50);
  const context = Math.max(0, Math.min(1, interest));
  const psychRaw =
    P.preferenceWeight * prefNorm +
    P.intensityMatchWeight * r.stimulation.intensityMatch +
    P.desireContextWeight * context;
  const intimacyPsych = Math.max(0.15, Math.min(1, r.action.intimacy / 9));
  // Solo partnered-style ref: no partner bond multiplier (self-touch is allowed).
  let partneredPsychRef = Math.min(
    1.25,
    psychRaw * P.outputScale * (0.55 + 0.45 * intimacyPsych)
  );
  let physio = basePhysio;
  const warmUpMult =
    r.arousalReadiness === 'ok'
      ? 1
      : r.arousalReadiness === 'softUnready'
        ? 0.88
        : 0.72;
  if (bodyContactOk && warmUpMult < 1) {
    partneredPsychRef *= warmUpMult;
    physio *= warmUpMult;
  }
  if (!bodyContactOk) {
    partneredPsychRef = 0;
    physio = 0;
  }

  return {
    partneredPsychRef,
    physio,
    softUnready: r.arousalReadiness !== 'ok' && bodyContactOk,
    hardBlocked: r.clothingBlocked,
  };
}

/**
 * Resolve one masturbation beat (self channels + optional fantasy focus).
 */
export function resolveMasturbationBeat(
  input: MasturbationBeatInput
): MasturbationBeatResult {
  const {
    unit,
    channels,
    holdSeconds,
    encounter,
    fantasy,
    relationships,
    itemsById,
    unitsById,
  } = input;
  const nowHours = input.nowHours ?? 0;
  const M = T.masturbation;

  if (channels.length < 1) {
    throw new Error('Masturbation needs at least one self channel');
  }

  const resolved = analyzeChannels(
    unit,
    unit,
    channels,
    encounter.arousal,
    undefined,
    {
      climaxCount: encounter.climaxCount,
      receptivity: encounter.receptivity,
    },
    itemsById
  );

  const lust = unit.lewdStats.dynamic.lust ?? 0;
  const parts = resolved.map((r) => soloChannelQualities(r, lust));
  const partneredPsychRef = softOr(parts.map((p) => p.partneredPsychRef));
  // Soft-OR channel physio, then apply self-stim dampening.
  const basePhysioQ = Math.min(1.15, softOr(parts.map((p) => p.physio)));
  const physioQuality = Math.min(1, basePhysioQ * M.selfPhysioMult);
  const erogenous = Math.max(0, ...resolved.map((r) => r.erogenous));
  const soloPsychBase = partneredPsychRef * M.soloPsychMult;
  const fantasyBreak = scoreMasturbationFantasy(
    unit,
    fantasy,
    nowHours,
    relationships,
    unitsById
  );
  const psychQuality = Math.min(
    M.fantasyPsychCeil,
    soloPsychBase +
      (partneredPsychRef - soloPsychBase) * fantasyBreak.fantasy01
  );

  const hardBlocked = parts.every((p) => p.hardBlocked);
  const softUnready = !hardBlocked && parts.some((p) => p.softUnready);

  const hormones = hormonesForUnit(unit);
  const bodily = hormones
    ? bodilyStateFromHormones(
        hormones,
        unit.lewdStats.static.ovulationCycleLength || 28
      )
    : null;
  const cycleRecv = bodily
    ? encounterCycleReceptivityMult(bodily.fertileCrest01)
    : 1;
  const seeded = {
    ...encounter,
    receptivity: Math.max(encounter.receptivity, cycleRecv),
  };

  const allowGains = !hardBlocked;
  const next = updateEncounterArousal(seeded, {
    psychQuality: allowGains ? psychQuality : 0,
    physioQuality: allowGains ? physioQuality : 0,
    erogenous,
    deltaT: Math.max(0.5, holdSeconds),
    sex: unit.sex,
    overstep: allowGains && resolved.some((r) => r.overstep),
    overstepSeverity: Math.max(0, ...resolved.map((r) => r.overstepSeverity)),
    violation: false,
    estrogen: hormones?.estrogen,
    testosterone: hormones?.testosterone,
    hypersensStimIntensity: allowGains
      ? Math.max(0, ...resolved.map((r) => (r.overstep ? r.channel.intensity : 0)))
      : 0,
  });

  const genitalPlay = channels.some((ch) =>
    isCycleSensitiveTarget(ch.targetPart)
  );
  const beatQuality01 = Math.max(
    0,
    Math.min(1, (psychQuality + physioQuality) / 2)
  );

  let working = unit;
  let secretionCloth01 = 0;
  let secretionRatePerSec = 0;
  if (allowGains && unit.sex === 'F' && bodily) {
    const secretion = accrueVaginalSecretion({
      unit,
      encounterArousal: next.arousal,
      holdSeconds,
      genitalPlay,
      bodily,
      beatQuality01,
    });
    working = secretion.unit;
    secretionCloth01 = secretion.cloth01;
    secretionRatePerSec = secretion.ratePerSec;
  }

  const orificeWet01 = blendOrificeSlick(
    working.lewdStats.dynamic.orificeSlick?.vagina
  ).wet01;
  const felt =
    unit.sex === 'F' && bodily
      ? feltWetness(bodily.wetness01, {
          lust: working.lewdStats.dynamic.lust ?? 0,
          orificeWet01,
          lubricationRate01: bodily.lubricationRate01,
        })
      : null;

  const maleClothCtx = maleGenitalClothContext(channels);
  let precumNote: string | null = null;
  if (unit.sex === 'M' && allowGains) {
    const precum = computePrecumVolume01({
      erection01: next.erection01 ?? 0,
      encounterArousal: next.arousal,
      genitalContact: maleClothCtx.genitalContact,
      holdSeconds: Math.max(0.5, holdSeconds),
      beatQuality01,
      underwearSemenScore: maleUnderwearSemenScore(working),
    });
    if (precum.volume01 > 0) {
      working = applyMaleOwnCrotchFluid(working, 'semen', precum.volume01, {
        posture: encounter.posture ?? 'standing',
      });
      precumNote = precumFlavorNote({
        volume01: precum.volume01,
        erection01: next.erection01 ?? 0,
        capped: precum.capped,
      });
    }
  }

  const lubricationFlavor: LubricationSoilFlavor =
    secretionCloth01 >= 0.002 || secretionRatePerSec >= 0.0006
      ? lubricationFlavorFromRate(
          Math.max(
            secretionRatePerSec,
            secretionCloth01 / Math.max(0.5, holdSeconds)
          )
        )
      : 'none';
  const word = lubricationFlavorLabel(lubricationFlavor);
  const feltForNote = felt?.feltWetness ?? 0;
  const lubricationNote =
    lubricationFlavor === 'none'
      ? precumNote
      : genitalPlay && feltForNote >= T.cycle.ambientWetnessThreshold
        ? `${word} · genital flush`
        : `${word} · cloth`;
  const ambientLubrication =
    (lubricationFlavor !== 'none' && secretionCloth01 >= 0.002) || !!precumNote;

  const discharges: FluidDischargeEvent[] = [];
  if (secretionCloth01 >= 0.002 && unit.sex === 'F') {
    discharges.push({
      fromId: unit.id,
      fromSex: unit.sex,
      kind: 'lubricationSurge',
      volume: secretionCloth01 / 0.55,
      climaxIndex: next.climaxCount,
      note: lubricationNote ?? bodily?.blurb ?? 'arousal slick',
    });
  }

  const lustFrom = working.lewdStats.dynamic.lust ?? 0;
  let lustTo = lustFrom;
  if (next.climaxed) {
    discharges.push(
      dischargeOnClimax({
        unitId: unit.id,
        sex: unit.sex,
        climaxCountAfter: next.climaxCount,
        role: 'recipient',
        female:
          unit.sex === 'F'
            ? {
                edgeAtClimax: next.edgeAtClimax,
                arousalAtClimax: next.arousalAtClimax,
                climaxCountAfter: next.climaxCount,
                lubricationRate01: bodily?.lubricationRate01 ?? 0.7,
                orificeWet01,
              }
            : undefined,
      })
    );
    if (unit.sex === 'M') {
      const semenEvt = discharges.find(
        (d) =>
          d.fromId === unit.id &&
          d.kind === 'semen' &&
          d.climaxIndex === next.climaxCount
      );
      const vol = semenEvt?.volume ?? 0.7;
      const CC = T.encounter.maleErection.clothedClimax;
      const share = maleClothCtx.dumpIntoClothes
        ? CC.dumpVolumeShare
        : CC.exposedLeakShare;
      working = applyMaleOwnCrotchFluid(working, 'semen', vol * share, {
        posture: encounter.posture ?? 'standing',
      });
    }
  }

  // ♀ secretion weep + climax cloth/orifice shares (same path as partnered).
  if (discharges.length > 0 && unit.sex === 'F') {
    working = applyDischargesToRecipientSoil(working, discharges, true, {
      encounterArousal: next.arousal,
      posture: encounter.posture ?? 'standing',
    }).unit;
  }

  if (next.climaxed) {
    const prior = Math.max(0, next.climaxCount - 1);
    const relief = Math.max(
      M.lustReliefFloor,
      M.lustReliefOnClimax * Math.pow(M.lustReliefPerPriorClimax, prior)
    );
    working = nudgeStandingLust(working, -relief);
    lustTo = working.lewdStats.dynamic.lust ?? lustTo;
  }

  const primary = resolved.reduce((a, b) =>
    a.physioScore >= b.physioScore ? a : b
  );
  const band = bandOutcome(primary.stimulation);
  const summary = [
    'solo',
    primary.action.verb,
    primary.targetName,
    fantasyBreak.fantasy01 > 0.05
      ? `fantasy ${(fantasyBreak.fantasy01 * 100).toFixed(0)}%`
      : 'blank mind',
  ].join(' · ');

  return {
    summary,
    resolved,
    psychQuality,
    physioQuality,
    partneredPsychRef,
    soloPsychBase,
    erogenous,
    fantasy: fantasyBreak,
    encounter: next,
    climaxed: next.climaxed,
    discharges,
    ambientLubrication,
    lubricationFlavor,
    lubricationNote,
    precumNote,
    unitAfter: working,
    lustFrom,
    lustTo,
    band,
    bandLabel: outcomeLabel(band),
    arousalHardBlocked: hardBlocked,
    arousalSoftUnready: softUnready,
  };
}

/** Default genital self-stim channel for Lab (sex-aware). */
export function defaultSoloGenitalChannel(
  sex: 'M' | 'F',
  intensity = 5,
  clothingAccess: LewdChannel['clothingAccess'] = 'underneath'
): LewdChannel {
  if (sex === 'M') {
    return {
      actorPart: 'handPalm',
      actionId: 'palmRub',
      targetPart: 'penisShaft',
      intensity,
      clothingAccess,
    };
  }
  return {
    actorPart: 'handFinger',
    actionId: 'fingerStroke',
    targetPart: 'clitoris',
    intensity,
    clothingAccess,
  };
}

export function createSoloEncounter(): EncounterArousalState {
  return createEncounterArousalState();
}

/** Expose raw physio before self mult for Lab readout. */
export function masturbationTuning() {
  return T.masturbation;
}

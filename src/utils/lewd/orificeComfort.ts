/**
 * Tease / probe / insert comfort: lubrication × soft-cap dilation × size × force.
 *
 * Soft-cap chain: tease → 1 finger → 2 fingers → tip → shaft → full.
 * Gentle open = mild stretch phys that settles if you stay at/below capacity.
 * Jumping the chain = faster dilation + sharp but recoverable discomfort
 * (surprise one finger ≠ ruin; surprise two/large is harsher).
 */

import type { Unit as DetailedUnit } from '../../types/characters';
import {
  chainJumpSteps,
  dilationSoftCapForSizeClass,
  insertableSizeClassFromChannel,
  isInsertAction,
  isProbeAction,
  isTeaseAction,
  openCapacityRankFromDilation,
  sizeRank,
  type InsertableSizeClass,
} from './insertableSize';
import type { LewdChannel } from './lewdChannels';
import { LEWD_TUNING as T } from './lewdTuning';
import {
  fadeOrificePlayFamily,
  getOrificePlayState,
  orificeFamilyFromTarget,
  orificeIdForFamily,
  type OrificePlayByFamily,
  type OrificePlayFamily,
  type OrificePlayState,
} from './orificePlayState';
import { blendOrificeSlick } from './orificeSlick';

export type OrificeActTier = 'tease' | 'probe' | 'insert';

export type OrificeComfortBand =
  | 'coaxing'
  | 'accepting'
  | 'forcing'
  | 'dryRefuse';

export interface OrificeComfortResult {
  family: OrificePlayFamily;
  tier: OrificeActTier;
  sizeClass: InsertableSizeClass;
  sizeRank: number;
  openCapacity: number;
  fit: number;
  jumpSteps: number;
  softCap01: number;
  lubeComfort01: number;
  sudden: boolean;
  band: OrificeComfortBand;
  refuse: boolean;
  qualityMult: number;
  physPerSec: number;
  /** Negative = settle relief applied as reduced net phys elsewhere. */
  settleReliefPerSec: number;
  psychShare: number;
  /** Rubbed-raw stress applied this beat (debug). */
  rawStress: number;
  /** First/aggravated orifice tear this beat (itemizedHealth apply upstream). */
  orificeTear: boolean;
  orificeTearHealthLoss: number;
  /** @deprecated alias of orificeTear for anal callers */
  analTear: boolean;
  analTearHealthLoss: number;
  nextState: OrificePlayState;
  note: string;
}

type OrificeRawTuning = typeof T.orificePlay.analRaw | typeof T.orificePlay.vaginalRaw;

/**
 * Rubbed-raw stress for anal / vagina: dryness primary, oversize + jump
 * exponential, band + intensity. Mild sizes stay light; lubed coax barely raws.
 * Vagina may further damp when secretion comfort is high.
 */
export function orificeRawStress01(
  R: OrificeRawTuning,
  input: {
    lubeComfort01: number;
    openCapacity: number;
    sizeRank: number;
    jumpSteps: number;
    band: OrificeComfortBand;
    intensity: number;
    /** Vaginal: natural secretion / felt-wet comfort credit. */
    secretionForgiveness?: boolean;
  }
): number {
  const dry01 = clamp01(1 - input.lubeComfort01);
  const dryStress = Math.pow(dry01, R.dryStressPower) * R.dryStressWeight;

  const overRanks = Math.max(0, input.sizeRank - input.openCapacity);
  const sizeStress =
    overRanks <= 0
      ? 0
      : Math.pow(R.sizeOverBase, overRanks * R.sizeOverExp) - 1;

  const jumpStress =
    input.jumpSteps <= 0
      ? 0
      : Math.pow(1 + R.jumpExtra, input.jumpSteps * R.jumpExp) - 1;

  const intensity01 = clamp01(Math.max(0, input.intensity) / 10);
  const intensityMult =
    R.intensityFloor +
    (1 - R.intensityFloor) * Math.pow(intensity01, R.intensityPower);

  let stress: number;
  if (input.sizeRank <= R.mildSizeRankMax) {
    stress =
      dryStress * R.bandMult[input.band] * R.mildSizeMult * intensityMult;
  } else {
    const overMild = input.sizeRank - R.mildSizeRankMax;
    const serious01 = clamp01(
      Math.pow(overMild / Math.max(0.01, R.sizeSeriousSpan), R.sizeSeriousPower)
    );
    const sizeGate = R.mildSizeMult + (1 - R.mildSizeMult) * serious01;
    stress =
      (dryStress + sizeStress + jumpStress) *
      R.bandMult[input.band] *
      sizeGate *
      intensityMult;
  }

  const inChainGentle =
    (input.band === 'accepting' || input.band === 'coaxing') &&
    overRanks <= 0.35 &&
    input.lubeComfort01 >= R.lubeSafeFloor;
  if (inChainGentle) {
    stress *= R.lubedAcceptingMult;
  }

  if (
    input.secretionForgiveness &&
    'secretionForgivenessMult' in R &&
    input.lubeComfort01 >=
      (('secretionComfortFloor' in R
        ? (R as typeof T.orificePlay.vaginalRaw).secretionComfortFloor
        : 0.28) as number)
  ) {
    stress *= (R as typeof T.orificePlay.vaginalRaw).secretionForgivenessMult;
  }

  return Math.min(R.stressCap, Math.max(0, stress));
}

/** @deprecated prefer orificeRawStress01(T.orificePlay.analRaw, …) */
export function analRawStress01(input: {
  lubeComfort01: number;
  openCapacity: number;
  sizeRank: number;
  jumpSteps: number;
  band: OrificeComfortBand;
  intensity: number;
}): number {
  return orificeRawStress01(T.orificePlay.analRaw, input);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function classifyOrificeTier(
  channel: LewdChannel,
  family: OrificePlayFamily
): OrificeActTier | null {
  const action = channel.actionId;
  const target = channel.targetPart;

  if (isInsertAction(action)) return 'insert';
  if (isProbeAction(action)) return 'probe';

  if (/^penis/i.test(channel.actorPart)) {
    if (/Deep$/i.test(target)) return 'insert';
    if (/Shallow$/i.test(target)) {
      return action === 'thrust' || action === 'grind' ? 'insert' : 'probe';
    }
    if (target === 'anus' || target === 'vaginaShallow') {
      return action === 'thrust' || action === 'grind' ? 'insert' : 'probe';
    }
  }

  // Surface tracing on the verge = tease (not probe).
  if (isTeaseAction(action)) {
    if (
      target === 'anus' ||
      /^labia/i.test(target) ||
      target === 'perinium' ||
      target === 'buttockUnderside'
    ) {
      return 'tease';
    }
    // Stroke into shallow cavity leans probe-ish only for non-trace strokes.
    if (
      action === 'fingerStroke' &&
      (/Shallow$/i.test(target) || /Deep$/i.test(target))
    ) {
      return 'probe';
    }
    if (family === 'anal' || family === 'vagina') return 'tease';
  }

  return null;
}

function lubeComfort01(
  unit: DetailedUnit,
  family: OrificePlayFamily,
  feltWetness01?: number
): number {
  const orificeId = orificeIdForFamily(family);
  const layers = unit.lewdStats.dynamic.orificeSlick?.[orificeId];
  const blend = blendOrificeSlick(layers);
  let comfort = blend.wet01 * blend.quality01;
  if (family === 'vagina' && feltWetness01 != null) {
    comfort = Math.max(comfort, feltWetness01 * 0.55);
  }
  return clamp01(comfort);
}

function dryThreshold(family: OrificePlayFamily): number {
  return family === 'anal'
    ? T.orificePlay.analDryThreshold
    : T.orificePlay.vaginalDryThreshold;
}

/**
 * Evaluate one orifice-targeting channel for ♀ recipient (v1).
 */
export function evaluateOrificeComfort(input: {
  channel: LewdChannel;
  recipient: DetailedUnit;
  orificePlay?: OrificePlayByFamily;
  holdSeconds: number;
  feltWetness01?: number;
  firstEntryHint?: boolean;
}): OrificeComfortResult | null {
  if (input.recipient.sex !== 'F') return null;
  const family = orificeFamilyFromTarget(input.channel.targetPart);
  if (!family || family === 'mouth') return null;

  const tier = classifyOrificeTier(input.channel, family);
  if (!tier) return null;

  const sizeClass = insertableSizeClassFromChannel(input.channel);
  if (!sizeClass) return null;

  const P = T.orificePlay;
  const state = getOrificePlayState(input.orificePlay, family);
  const openCapacity = openCapacityRankFromDilation(state.dilation01);
  const sRank = sizeRank(sizeClass);
  const fit = openCapacity - sRank;
  const jumpSteps = chainJumpSteps(openCapacity, sRank);
  const softCap01 = dilationSoftCapForSizeClass(sizeClass, tier);
  const lube = lubeComfort01(
    input.recipient,
    family,
    input.feltWetness01
  );
  const intensity = input.channel.intensity;
  const slack =
    tier === 'probe'
      ? P.probeFitSlack
      : tier === 'insert'
        ? P.insertFitSlack
        : 99;

  const isJump = jumpSteps > slack + 0.05;
  const sudden =
    isJump &&
    (intensity >= P.suddenIntensityFloor ||
      !!input.firstEntryHint ||
      state.lastSizeRank + 1.25 < sRank);

  const dt = Math.max(0.5, input.holdSeconds);
  let band: OrificeComfortBand = 'accepting';
  let refuse = false;
  let physPerSec = 0;
  let settleReliefPerSec = 0;
  let psychShare: number = P.forcePsychShare;
  let qualityMult: number = P.qualityMult.accepting;

  if (tier === 'insert' && lube < dryThreshold(family)) {
    if (family === 'anal') {
      band = 'dryRefuse';
      refuse = true;
      physPerSec = P.dryRefusePhysPerSec;
      psychShare = P.dryPsychShare;
      qualityMult = P.qualityMult.dryRefuse;
    } else {
      band = 'forcing';
      physPerSec = P.dryRefusePhysPerSec * 0.55;
      psychShare = P.dryPsychShare;
      qualityMult = P.qualityMult.forcing;
    }
  } else if (isJump) {
    // Jump the soft-cap chain: sharp distress, still recoverable.
    band = 'forcing';
    const jumpPhys = Math.min(
      P.jumpPhysPerSecCap,
      P.jumpPhysPerSecPerRank * Math.max(0.75, jumpSteps) * (sudden ? 1.25 : 1)
    );
    physPerSec = Math.max(P.forcePhysPerSec * 0.55, jumpPhys);
    psychShare = P.jumpPsychShare;
    qualityMult = P.jumpQualityMult;
    // One-finger surprise stays milder than two+/toy.
    if (sRank <= sizeRank('finger') && jumpSteps <= 1.25) {
      physPerSec *= 0.72;
      qualityMult = Math.max(qualityMult, 0.55);
    }
  } else if (tier === 'tease' || fit >= -slack) {
    const approaching =
      state.dilation01 < softCap01 - 0.02 &&
      lube >= dryThreshold(family) * 0.45;
    band = approaching ? 'coaxing' : 'accepting';
    qualityMult =
      band === 'coaxing' ? P.qualityMult.coaxing : P.qualityMult.accepting;
    if (approaching) {
      physPerSec = P.gentleStretchPhysPerSec * (0.65 + 0.35 * (intensity / 10));
      psychShare = 0.28;
    } else {
      // Settled at/below soft cap — distress eases so the next step can begin.
      settleReliefPerSec = P.settlePhysReliefPerSec;
      physPerSec = 0;
    }
  } else {
    band = 'forcing';
    physPerSec =
      P.forcePhysPerSec *
      (0.4 + 0.4 * Math.min(1, Math.abs(fit) / 2)) *
      (sudden ? 1.2 : 1);
    qualityMult = P.qualityMult.forcing;
  }

  // --- Dilation advance (soft-capped when gentle; faster when jumping) ---
  let dilation01 = state.dilation01;
  let stretchFatigue01 = state.stretchFatigue01;
  let raw01 = state.raw01 ?? 0;
  let tornThisEncounter =
    state.tornThisEncounter ?? state.analTornThisEncounter ?? false;
  let lastSizeRank = state.lastSizeRank;
  let rawStress = 0;
  let orificeTear = false;
  let orificeTearHealthLoss = 0;

  if (!refuse && lube >= dryThreshold(family) * 0.4) {
    if (band === 'coaxing' || (band === 'accepting' && dilation01 < softCap01)) {
      const room = Math.max(0, softCap01 - dilation01);
      const step =
        P.softCapApproachPerSec * dt * (0.35 + 0.65 * (room > 0 ? 1 : 0));
      dilation01 = Math.min(softCap01, dilation01 + Math.min(room, step));
      stretchFatigue01 += P.gentleStretchFatiguePerSec * dt;
    } else if (band === 'forcing' && !refuse) {
      // Jump opens faster, uncapped by the gentle soft cap (still ≤ 1).
      const jumpTarget = Math.min(1, softCap01 + 0.12 * Math.max(1, jumpSteps));
      dilation01 = Math.min(
        jumpTarget,
        dilation01 + P.jumpDilationPerSec * dt * (0.7 + 0.15 * jumpSteps)
      );
      stretchFatigue01 += 0.1 * dt * (sudden ? 1.35 : 1) * Math.max(1, jumpSteps * 0.65);
    } else if (band === 'accepting') {
      stretchFatigue01 = Math.max(
        0,
        stretchFatigue01 - P.settleFatigueDecayPerSec * dt
      );
    }
  }

  if (band === 'dryRefuse') {
    stretchFatigue01 += 0.14 * dt;
  }

  // --- Rubbed-raw (anal + vagina; dryness primary; force/oversize exponential) ---
  if (family === 'anal' || family === 'vagina') {
    const R = family === 'anal' ? P.analRaw : P.vaginalRaw;
    const secretionForgiveness =
      family === 'vagina' &&
      (lube >= P.vaginalRaw.secretionComfortFloor ||
        (input.feltWetness01 ?? 0) >= 0.35);
    rawStress = orificeRawStress01(R, {
      lubeComfort01: lube,
      openCapacity,
      sizeRank: sRank,
      jumpSteps,
      band,
      intensity,
      secretionForgiveness,
    });
    // Dry refuse / forcing still raw even when insert is refused.
    if (band === 'dryRefuse' || band === 'forcing' || tier !== 'tease') {
      raw01 = clamp01(raw01 + rawStress * R.rawPerSecAtRef * dt);
    } else if (rawStress > 0.02) {
      raw01 = clamp01(raw01 + rawStress * R.rawPerSecAtRef * dt);
    }
    if (
      (band === 'accepting' || band === 'coaxing') &&
      lube >= R.lubeSafeFloor &&
      rawStress < 0.15
    ) {
      raw01 = Math.max(0, raw01 - R.rawDecayPerSecSoothing * dt);
    }

    physPerSec += R.rawPhysPerSecAtFull * raw01;
    qualityMult *= 1 - R.rawQualityTaxAtFull * raw01;

    const forcingBand = band === 'forcing' || band === 'dryRefuse';
    if (forcingBand && raw01 >= R.tearRawThreshold) {
      if (!tornThisEncounter) {
        orificeTear = true;
        orificeTearHealthLoss = R.tearHealthLoss;
        tornThisEncounter = true;
        physPerSec += R.tearPhysSpike;
      } else if (raw01 >= R.aggravateRawFloor) {
        orificeTear = true;
        orificeTearHealthLoss = R.aggravateHealthPerSec * dt;
        physPerSec += R.tearPhysSpike * 0.35;
      }
    }
  }

  if (band === 'accepting' || band === 'coaxing') {
    lastSizeRank = Math.max(lastSizeRank, sRank);
  }

  dilation01 = clamp01(dilation01);
  stretchFatigue01 = clamp01(stretchFatigue01);
  raw01 = clamp01(raw01);
  if (stretchFatigue01 > 0.25) {
    qualityMult *= 1 - 0.3 * stretchFatigue01;
  }

  const rawNote =
    family === 'anal' || family === 'vagina'
      ? ` · raw=${(raw01 * 100).toFixed(0)}%${orificeTear ? ' TEAR' : ''}`
      : '';
  const note = `${family} ${tier} · ${sizeClass} · ${band} · dil=${(dilation01 * 100).toFixed(0)}%/${(softCap01 * 100).toFixed(0)}%cap fit=${fit.toFixed(1)} jump=${jumpSteps.toFixed(1)} lube=${(lube * 100).toFixed(0)}%${rawNote}`;

  return {
    family,
    tier,
    sizeClass,
    sizeRank: sRank,
    openCapacity,
    fit,
    jumpSteps,
    softCap01,
    lubeComfort01: lube,
    sudden,
    band,
    refuse,
    qualityMult,
    physPerSec,
    settleReliefPerSec,
    psychShare,
    rawStress,
    orificeTear,
    orificeTearHealthLoss,
    analTear: family === 'anal' && orificeTear,
    analTearHealthLoss: family === 'anal' ? orificeTearHealthLoss : 0,
    nextState: {
      ...state,
      dilation01,
      stretchFatigue01,
      raw01,
      tornThisEncounter,
      analTornThisEncounter: tornThisEncounter,
      lastSizeRank,
    },
    note,
  };
}

const BAND_SEVERITY: Record<OrificeComfortBand, number> = {
  coaxing: 0,
  accepting: 1,
  forcing: 2,
  dryRefuse: 3,
};

/** Merge several channel comfort results into one beat summary + state map. */
export function mergeOrificeComfortBeat(
  results: OrificeComfortResult[],
  prev: OrificePlayByFamily | undefined,
  dt: number
): {
  qualityMult: number;
  physPerSec: number;
  psychShare: number;
  refuse: boolean;
  band: OrificeComfortBand | null;
  notes: string[];
  nextPlay: OrificePlayByFamily;
  analTear: boolean;
  analTearHealthLoss: number;
  analRaw01: number;
  vaginalTear: boolean;
  vaginalTearHealthLoss: number;
  vaginalRaw01: number;
} {
  const nextPlay: OrificePlayByFamily = { ...(prev ?? {}) };
  const contacted = new Set<OrificePlayFamily>();

  let qualityMult = 1;
  let physPerSec = 0;
  let psychShare = 0;
  let refuse = false;
  let band: OrificeComfortBand | null = null;
  let analTear = false;
  let analTearHealthLoss = 0;
  let analRaw01 = prev?.anal?.raw01 ?? 0;
  let vaginalTear = false;
  let vaginalTearHealthLoss = 0;
  let vaginalRaw01 = prev?.vagina?.raw01 ?? 0;
  const notes: string[] = [];

  for (const r of results) {
    contacted.add(r.family);
    nextPlay[r.family] = r.nextState;
    qualityMult = Math.min(qualityMult, r.qualityMult);
    const netPhys = Math.max(0, r.physPerSec - r.settleReliefPerSec);
    if (netPhys > physPerSec) {
      physPerSec = netPhys;
      psychShare = r.psychShare;
    } else if (r.settleReliefPerSec > 0 && physPerSec < 0.05) {
      // Settling: no new phys chip; existing encounter phys decays via integrator.
      physPerSec = 0;
    }
    refuse = refuse || r.refuse;
    if (!band || BAND_SEVERITY[r.band] > BAND_SEVERITY[band]) {
      band = r.band;
    }
    if (r.family === 'anal') {
      analRaw01 = r.nextState.raw01;
      if (r.orificeTear) {
        analTear = true;
        analTearHealthLoss += r.orificeTearHealthLoss;
      }
    }
    if (r.family === 'vagina') {
      vaginalRaw01 = r.nextState.raw01;
      if (r.orificeTear) {
        vaginalTear = true;
        vaginalTearHealthLoss += r.orificeTearHealthLoss;
      }
    }
    notes.push(r.note);
  }

  for (const family of ['vagina', 'anal', 'mouth'] as OrificePlayFamily[]) {
    if (contacted.has(family)) continue;
    if (!nextPlay[family] && !prev?.[family]) continue;
    nextPlay[family] = fadeOrificePlayFamily(
      getOrificePlayState(nextPlay, family),
      dt,
      family
    );
  }

  return {
    qualityMult,
    physPerSec,
    psychShare,
    refuse,
    band,
    notes,
    nextPlay,
    analTear,
    analTearHealthLoss,
    analRaw01,
    vaginalTear,
    vaginalTearHealthLoss,
    vaginalRaw01,
  };
}

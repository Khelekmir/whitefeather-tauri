import type { Sex } from '../../types/characters';
import { arousalSoftCapForErogenous } from './erogenous';
import { LEWD_TUNING as T } from './lewdTuning';

/** Ephemeral encounter meters (0–100). Not the same as relational Desire. */
export interface EncounterArousalState {
  arousal: number;
  edge: number;
  /**
   * Compat / UI composite = max(phys, psych).
   * Prefer reading discomfortPhys / discomfortPsych for logic.
   */
  discomfort: number;
  /** Body sting / impact / stretch (spank, bite, overstep force). */
  discomfortPhys: number;
  /** Mind strain — reluctance, unready push, violation, cold pain. */
  discomfortPsych: number;
  /** Climaxes so far this encounter — drives compounding receptivity. */
  climaxCount: number;
  /** Multiplier on psych/physio/edge gains (starts 1, rises with climaxes). */
  receptivity: number;
  /**
   * Encounter-seconds left before a male can edge/climax again.
   * Written on male orgasm; decays with dt. Females stay 0.
   */
  refractorySecondsRemaining: number;
}

export interface EncounterArousalUpdate {
  psychQuality: number;
  physioQuality: number;
  erogenous: number;
  deltaT: number;
  /** Used to apply male refractory on climax. */
  sex?: Sex;
  overstep?: boolean;
  overstepSeverity?: number;
  /** Intimacy / consent violation — writes psych. */
  violation?: boolean;
  /**
   * Catalog pain rate already scaled for intensity/tolerance (phys/sec before dt).
   * Psych share of this chip is applied via painPsychShare (0–1+).
   */
  painPhysPerSec?: number;
  /** 0 = good-bond wanted pain; 1 = pain reads as threat. */
  painPsychShare?: number;
  /**
   * Extra overstep→psych share multiplier (e.g. soft-unready).
   * Applied on top of painPsychShare for overstep phys chips.
   */
  overstepPsychBoost?: number;
}

export interface EncounterArousalResult extends EncounterArousalState {
  climaxed: boolean;
  ruined: boolean;
  softCap: number;
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function syncComposite(phys: number, psych: number): number {
  return Math.max(phys, psych);
}

function normalizeState(state: EncounterArousalState): {
  arousal: number;
  edge: number;
  discomfortPhys: number;
  discomfortPsych: number;
  climaxCount: number;
  receptivity: number;
  refractorySecondsRemaining: number;
} {
  // Migrate legacy single-discomfort snapshots.
  const hasSplit =
    state.discomfortPhys != null || state.discomfortPsych != null;
  const phys = hasSplit
    ? clamp100(state.discomfortPhys ?? 0)
    : clamp100(state.discomfort ?? 0);
  const psych = hasSplit
    ? clamp100(state.discomfortPsych ?? 0)
    : clamp100(state.discomfort ?? 0);
  return {
    arousal: state.arousal,
    edge: state.edge,
    discomfortPhys: phys,
    discomfortPsych: psych,
    climaxCount: state.climaxCount,
    receptivity: state.receptivity,
    refractorySecondsRemaining: Math.max(
      0,
      state.refractorySecondsRemaining ?? 0
    ),
  };
}

export function createEncounterArousalState(): EncounterArousalState {
  return {
    arousal: 0,
    edge: 0,
    discomfort: 0,
    discomfortPhys: 0,
    discomfortPsych: 0,
    climaxCount: 0,
    receptivity: 1,
    refractorySecondsRemaining: 0,
  };
}

/** Seconds of refractory after a male climax (prior count = climaxes before this one). */
export function maleRefractorySecondsAfterClimax(priorClimaxCount: number): number {
  const R = T.encounter.refractory;
  const raw =
    R.baseSeconds + Math.max(0, priorClimaxCount) * R.perPriorClimaxExtraSeconds;
  return Math.min(R.maxSeconds, Math.max(0, raw));
}

/**
 * Integrate one beat into Arousal / Edge / dual Discomfort.
 * - Arousal uses diminishing returns toward the erogenous soft cap.
 * - Climaxes compound receptivity so later waves land harder / faster.
 * - Soft-block climax is mind-primary (psych); ruin if either track hard-caps.
 */
export function updateEncounterArousal(
  state: EncounterArousalState,
  update: EncounterArousalUpdate
): EncounterArousalResult {
  const E = T.encounter;
  const Er = T.erogenous;
  const dt = Math.max(0, update.deltaT);
  let {
    arousal,
    edge,
    discomfortPhys,
    discomfortPsych,
    climaxCount,
    receptivity,
    refractorySecondsRemaining,
  } = normalizeState(state);
  let climaxed = false;
  let ruined = false;

  const erogenous = Math.max(0, Math.min(1, update.erogenous));
  const softCapBoost = Math.min(18, climaxCount * 5);
  const softCap = Math.min(
    100,
    arousalSoftCapForErogenous(erogenous) + softCapBoost
  );

  if (dt <= 0) {
    const discomfort = syncComposite(discomfortPhys, discomfortPsych);
    return {
      arousal,
      edge,
      discomfort,
      discomfortPhys,
      discomfortPsych,
      climaxCount,
      receptivity,
      refractorySecondsRemaining,
      climaxed,
      ruined,
      softCap,
    };
  }

  // Tick down refractory before edge/climax checks.
  if (refractorySecondsRemaining > 0) {
    refractorySecondsRemaining = Math.max(0, refractorySecondsRemaining - dt);
  }
  const refractory = refractorySecondsRemaining > 0.001;

  let psychQ = Math.max(0, Math.min(1, update.psychQuality));
  let physioQ = Math.max(0, Math.min(1, update.physioQuality));
  if (update.overstep) {
    psychQ *= E.overstepQualityMult;
    physioQ *= E.overstepQualityMult;
  }

  const recv = Math.max(1, Math.min(E.receptivityCap, receptivity));
  psychQ = Math.min(1.15, psychQ * recv);
  physioQ = Math.min(1.15, physioQ * recv);

  const painShare = Math.max(0, update.painPsychShare ?? 0);
  const overstepPsychBoost = Math.max(0, update.overstepPsychBoost ?? 1);

  if (update.violation) {
    const violScale = Math.max(0.05, dt / T.defaultHoldSeconds);
    discomfortPsych = clamp100(
      discomfortPsych + E.discomfortViolationFlat * violScale
    );
  }

  // Catalog pain → phys, gated psych share
  const painPhysRate = Math.max(0, update.painPhysPerSec ?? 0);
  if (painPhysRate > 0) {
    const physChip = painPhysRate * dt;
    discomfortPhys = clamp100(discomfortPhys + physChip);
    discomfortPsych = clamp100(discomfortPsych + physChip * painShare);
  }

  if (update.overstep) {
    const sev = Math.max(0.25, Math.min(1, update.overstepSeverity ?? 0.6));
    const overstepEase = 1 / (1 + 0.12 * climaxCount);
    const physChip =
      E.discomfortOverstepPerSec * sev * overstepEase * dt;
    discomfortPhys = clamp100(discomfortPhys + physChip);
    const psychFromOver =
      physChip * E.overstepPsychShare * overstepPsychBoost * Math.max(painShare, 0.15);
    discomfortPsych = clamp100(discomfortPsych + psychFromOver);
  } else if (painPhysRate <= 0) {
    // Rest: both tracks decay (phys faster). Pain/overstep suppress decay.
    discomfortPhys = clamp100(
      discomfortPhys - E.discomfortPhysDecayPerSec * dt
    );
    discomfortPsych = clamp100(
      discomfortPsych - E.discomfortPsychDecayPerSec * dt
    );
    if (psychQ < 0.05 && physioQ < 0.05) {
      receptivity = Math.max(
        1,
        receptivity - E.receptivityIdleDecayPerSec * dt
      );
    }
  } else {
    // Pain without overstep: psych still decays slowly if share is tiny
    if (painShare < 0.12) {
      discomfortPsych = clamp100(
        discomfortPsych - E.discomfortPsychDecayPerSec * 0.35 * dt
      );
    }
  }

  const damp =
    1 /
    (1 +
      E.discomfortDampPhysK * (discomfortPhys / 100) +
      E.discomfortDampPsychK * (discomfortPsych / 100));

  // --- Arousal ---
  const arousalPush =
    (E.arousalPsychGainPerSec * psychQ + E.arousalPhysioGainPerSec * physioQ) *
    damp;

  if (arousal > softCap + 0.75) {
    arousal = clamp100(arousal - E.arousalDecayPerSec * 1.4 * dt);
  } else if (arousalPush > 0.02) {
    const fill = softCap > 1 ? Math.min(0.98, arousal / softCap) : 0.98;
    const diminish = Math.pow(1 - fill, E.arousalDiminishPower);
    const novelty =
      arousal < E.noveltyArousalBelow
        ? 1 +
          (E.noveltyBoostMax - 1) *
            (1 - arousal / Math.max(1, E.noveltyArousalBelow))
        : 1;
    const room = Math.max(0, softCap - arousal);
    if (room < 0.35) {
      arousal = Math.min(arousal, softCap);
    } else {
      const step = Math.min(room, arousalPush * novelty * diminish * dt);
      arousal = clamp100(arousal + step);
    }
  } else {
    arousal = clamp100(arousal - E.arousalDecayPerSec * dt);
  }

  // --- Edge (mind soft-block) ---
  const edgeRankGate =
    erogenous >= Er.edgeMinRank
      ? Math.pow(erogenous, Er.edgePhysioPower)
      : 0;
  const edgeThreshold = Math.max(
    E.climaxEdgeThresholdFloor,
    E.climaxEdgeThreshold - climaxCount * E.climaxEdgeThresholdPerPrior
  );
  const mindOk = discomfortPsych < E.discomfortPsychSoftCap;
  const canEdge =
    !refractory &&
    arousal >= E.edgeArousalFloor &&
    mindOk &&
    physioQ > 0.06 &&
    edgeRankGate > 0.02;

  if (canEdge) {
    edge = clamp100(
      edge + E.edgeGainPerSec * physioQ * edgeRankGate * damp * recv * dt
    );
  } else {
    const edgeDecay =
      E.edgeDecayPerSec * (refractory ? E.refractory.edgeDecayMult : 1);
    edge = clamp100(edge - edgeDecay * dt);
  }

  // --- Climax (mind soft-block + male refractory block) ---
  if (
    !refractory &&
    edge >= edgeThreshold &&
    mindOk &&
    arousal >= E.edgeArousalFloor
  ) {
    climaxed = true;
    const prior = climaxCount;
    climaxCount = prior + 1;
    receptivity = Math.min(
      E.receptivityCap,
      receptivity + E.receptivityPerClimax
    );

    const drop = Math.max(
      E.climaxArousalDropFloor,
      E.climaxArousalDrop - prior * E.climaxArousalDropPerPrior
    );
    const afterglow = Math.min(
      55,
      E.climaxAfterglowFloor + prior * E.climaxAfterglowFloorPerPrior
    );

    edge = E.climaxEdgeReset;
    arousal = clamp100(Math.max(afterglow, arousal - drop));
    discomfortPsych = clamp100(
      discomfortPsych - E.climaxDiscomfortPsychRelief
    );
    discomfortPhys = clamp100(discomfortPhys - E.climaxDiscomfortPhysRelief);

    if (update.sex === 'M') {
      refractorySecondsRemaining = maleRefractorySecondsAfterClimax(prior);
    }
  }

  if (
    discomfortPhys >= E.discomfortPhysHardCap ||
    discomfortPsych >= E.discomfortPsychHardCap
  ) {
    ruined = true;
    edge = 0;
    arousal = clamp100(arousal * 0.55);
  }

  const discomfort = syncComposite(discomfortPhys, discomfortPsych);

  return {
    arousal: round1(arousal),
    edge: round1(edge),
    discomfort: round1(discomfort),
    discomfortPhys: round1(discomfortPhys),
    discomfortPsych: round1(discomfortPsych),
    climaxCount,
    receptivity: round2(receptivity),
    refractorySecondsRemaining: round1(refractorySecondsRemaining),
    climaxed,
    ruined,
    softCap: round1(softCap),
  };
}

export function idleEncounterArousal(
  state: EncounterArousalState,
  deltaT: number,
  sex?: Sex
): EncounterArousalState {
  const r = updateEncounterArousal(state, {
    psychQuality: 0,
    physioQuality: 0,
    erogenous: 0,
    deltaT,
    sex,
    overstep: false,
    violation: false,
  });
  return {
    arousal: r.arousal,
    edge: r.edge,
    discomfort: r.discomfort,
    discomfortPhys: r.discomfortPhys,
    discomfortPsych: r.discomfortPsych,
    climaxCount: r.climaxCount,
    receptivity: r.receptivity,
    refractorySecondsRemaining: r.refractorySecondsRemaining,
  };
}

import { arousalSoftCapForErogenous } from './erogenous';
import { LEWD_TUNING as T } from './lewdTuning';

/** Ephemeral encounter meters (0–100). Not the same as relational Desire. */
export interface EncounterArousalState {
  arousal: number;
  edge: number;
  discomfort: number;
  /** Climaxes so far this encounter — drives compounding receptivity. */
  climaxCount: number;
  /** Multiplier on psych/physio/edge gains (starts 1, rises with climaxes). */
  receptivity: number;
}

export interface EncounterArousalUpdate {
  psychQuality: number;
  physioQuality: number;
  erogenous: number;
  deltaT: number;
  overstep?: boolean;
  overstepSeverity?: number;
  violation?: boolean;
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

export function createEncounterArousalState(): EncounterArousalState {
  return {
    arousal: 0,
    edge: 0,
    discomfort: 0,
    climaxCount: 0,
    receptivity: 1,
  };
}

/**
 * Integrate one beat into Arousal / Edge / Discomfort.
 * - Arousal uses diminishing returns toward the erogenous soft cap (first kiss hits harder).
 * - Climaxes compound receptivity so later waves land harder / faster.
 */
export function updateEncounterArousal(
  state: EncounterArousalState,
  update: EncounterArousalUpdate
): EncounterArousalResult {
  const E = T.encounter;
  const Er = T.erogenous;
  const dt = Math.max(0, update.deltaT);
  let { arousal, edge, discomfort, climaxCount, receptivity } = state;
  let climaxed = false;
  let ruined = false;

  const erogenous = Math.max(0, Math.min(1, update.erogenous));
  // Soft cap creeps up slightly as they're more undone by prior climaxes
  const softCapBoost = Math.min(18, climaxCount * 5);
  const softCap = Math.min(
    100,
    arousalSoftCapForErogenous(erogenous) + softCapBoost
  );

  if (dt <= 0) {
    return {
      arousal,
      edge,
      discomfort,
      climaxCount,
      receptivity,
      climaxed,
      ruined,
      softCap,
    };
  }

  let psychQ = Math.max(0, Math.min(1, update.psychQuality));
  let physioQ = Math.max(0, Math.min(1, update.physioQuality));
  if (update.overstep) {
    psychQ *= E.overstepQualityMult;
    physioQ *= E.overstepQualityMult;
  }

  // Compounding: each climax makes subsequent stimulation land harder
  const recv = Math.max(1, Math.min(E.receptivityCap, receptivity));
  psychQ = Math.min(1.15, psychQ * recv);
  physioQ = Math.min(1.15, physioQ * recv);

  if (update.violation) {
    discomfort = clamp100(discomfort + E.discomfortViolationFlat);
  }

  if (update.overstep) {
    const sev = Math.max(0.25, Math.min(1, update.overstepSeverity ?? 0.6));
    // Slightly more tolerant of intensity after several climaxes (wrecked openness)
    const overstepEase = 1 / (1 + 0.12 * climaxCount);
    discomfort = clamp100(
      discomfort + E.discomfortOverstepPerSec * sev * overstepEase * dt
    );
  } else {
    discomfort = clamp100(discomfort - E.discomfortDecayPerSec * dt);
    // Receptivity cools slowly only while idle-ish
    if (psychQ < 0.05 && physioQ < 0.05) {
      receptivity = Math.max(
        1,
        receptivity - E.receptivityIdleDecayPerSec * dt
      );
    }
  }

  const damp = 1 / (1 + E.discomfortDampK * (discomfort / 100));

  // --- Arousal with diminishing returns toward soft cap ---
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

  // --- Edge ---
  const edgeRankGate =
    erogenous >= Er.edgeMinRank
      ? Math.pow(erogenous, Er.edgePhysioPower)
      : 0;
  const edgeThreshold = Math.max(
    E.climaxEdgeThresholdFloor,
    E.climaxEdgeThreshold - climaxCount * E.climaxEdgeThresholdPerPrior
  );
  const canEdge =
    arousal >= E.edgeArousalFloor &&
    discomfort < E.discomfortSoftCap &&
    physioQ > 0.06 &&
    edgeRankGate > 0.02;

  if (canEdge) {
    edge = clamp100(
      edge + E.edgeGainPerSec * physioQ * edgeRankGate * damp * recv * dt
    );
  } else {
    edge = clamp100(edge - E.edgeDecayPerSec * dt);
  }

  // --- Climax (compounding aftermath) ---
  if (
    edge >= edgeThreshold &&
    discomfort < E.discomfortSoftCap &&
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
    discomfort = clamp100(discomfort - E.climaxDiscomfortRelief);
  }

  if (discomfort >= E.discomfortHardCap) {
    ruined = true;
    edge = 0;
    arousal = clamp100(arousal * 0.55);
  }

  return {
    arousal: round1(arousal),
    edge: round1(edge),
    discomfort: round1(discomfort),
    climaxCount,
    receptivity: round2(receptivity),
    climaxed,
    ruined,
    softCap: round1(softCap),
  };
}

export function idleEncounterArousal(
  state: EncounterArousalState,
  deltaT: number
): EncounterArousalState {
  const r = updateEncounterArousal(state, {
    psychQuality: 0,
    physioQuality: 0,
    erogenous: 0,
    deltaT,
    overstep: false,
    violation: false,
  });
  return {
    arousal: r.arousal,
    edge: r.edge,
    discomfort: r.discomfort,
    climaxCount: r.climaxCount,
    receptivity: r.receptivity,
  };
}

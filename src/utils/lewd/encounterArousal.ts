import type { Sex } from '../../types/characters';
import { arousalSoftCapForErogenous } from './erogenous';
import { bodyCommit01 } from './intimacyBond';
import { LEWD_TUNING as T } from './lewdTuning';

/**
 * Body posture for cloth / skin fluid routing (Lab stub; scene tags later).
 * - standing: overflow → inner thigh / calf
 * - seated / lying: pool on seat (no “up the thighs”)
 * - handsKnees: face-down ass-up — runoff toward knees + partner stub
 * - sideLying: spooning / side entry — lower hip/seat + thigh
 * - mounted: cowgirl — overflow can soil partner’s crotch cloth (stub)
 */
export type EncounterPosture =
  | 'standing'
  | 'seated'
  | 'lying'
  | 'handsKnees'
  | 'sideLying'
  | 'mounted';

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
  /**
   * Seconds left in the post-orgasm sensitivity window (“orgasm duration”).
   * High intensity on hypersens parts or a rapid re-climax builds phys discomfort.
   */
  orgasmSecondsRemaining?: number;
  /** Cloth drip / seat-pool routing. Default standing. */
  posture?: EncounterPosture;
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
  /**
   * ♀ estrogen for arousal gain + psych softCap (ln-scaled; E peaks ~20×).
   * Testosterone is applied on act arousal gates, not here.
   * Omit for males or when unknown.
   */
  estrogen?: number;
  /** @deprecated unused on gain path — T lowers act gates in arousalGate */
  testosterone?: number;
  /**
   * Max intensity (1–10) on a post-orgasm hypersensitive target this beat.
   * Used only while orgasmSecondsRemaining > 0.
   */
  hypersensStimIntensity?: number;
}

/** Psych continuum bands for Lab / prose. */
export type PsychDiscomfortBand =
  | 'clear'
  | 'notice'
  | 'strain'
  | 'overwhelm'
  | 'break';

export function psychDiscomfortBand(psych: number): PsychDiscomfortBand {
  const C = T.encounter.psychContinuum;
  const hard = T.encounter.discomfortPsychHardCap;
  if (psych >= hard) return 'break';
  if (psych >= C.overwhelm) return 'overwhelm';
  if (psych >= C.strain) return 'strain';
  if (psych >= C.notice) return 'notice';
  return 'clear';
}

/**
 * How mind strain shapes arousal/edge: coexist with diminishing returns until
 * overwhelm, then accelerating decay (caught-in-the-moment → mind catches up).
 */
export function psychArousalEdgeResponse(psych: number): {
  gainMult: number;
  decayPerSec: number;
  tipAllowed: boolean;
  edgeAccrueAllowed: boolean;
  band: PsychDiscomfortBand;
} {
  const C = T.encounter.psychContinuum;
  const hard = T.encounter.discomfortPsychHardCap;
  const p = Math.max(0, Math.min(100, psych));
  const band = psychDiscomfortBand(p);

  if (p < C.notice) {
    return {
      gainMult: 1,
      decayPerSec: 0,
      tipAllowed: true,
      edgeAccrueAllowed: true,
      band,
    };
  }
  if (p < C.strain) {
    const t = (p - C.notice) / Math.max(0.01, C.strain - C.notice);
    return {
      gainMult: 1 - (1 - C.gainMultAtStrain) * t,
      decayPerSec: 0,
      tipAllowed: true,
      edgeAccrueAllowed: true,
      band,
    };
  }
  if (p < C.overwhelm) {
    const t = (p - C.strain) / Math.max(0.01, C.overwhelm - C.strain);
    return {
      gainMult:
        C.gainMultAtStrain -
        (C.gainMultAtStrain - C.gainMultAtOverwhelm) * t,
      decayPerSec: 0,
      tipAllowed: true,
      edgeAccrueAllowed: true,
      band,
    };
  }
  // Overwhelm → break: no tip, forced decay that accelerates with psych.
  const t = Math.min(
    1,
    (p - C.overwhelm) / Math.max(0.01, hard - C.overwhelm)
  );
  const decay =
    C.overwhelmDecayPerSec + C.overwhelmDecayAccel * t * t;
  return {
    gainMult: 0,
    decayPerSec: decay,
    tipAllowed: false,
    edgeAccrueAllowed: false,
    band,
  };
}

/** Targets that write overstim phys inside the post-orgasm sensitivity window. */
export function isPostOrgasmHypersensTarget(part: string): boolean {
  return (
    part === 'clitoris' ||
    part === 'labiaMinora' ||
    part === 'urethra' ||
    part === 'penisHead' ||
    part === 'penisHeadUnderside' ||
    /^glans/i.test(part)
  );
}

export function postOrgasmWindowSeconds(priorClimaxCount: number): number {
  const P = T.encounter.postOrgasm;
  return Math.min(
    P.durationCapSeconds,
    P.durationBaseSeconds +
      Math.max(0, priorClimaxCount) * P.durationPerPriorSeconds
  );
}

export interface EncounterArousalResult extends EncounterArousalState {
  climaxed: boolean;
  ruined: boolean;
  softCap: number;
  /** Edge at tip (before reset); 0 if no climax this beat. */
  edgeAtClimax: number;
  /** Arousal at tip (before afterglow drop); 0 if no climax. */
  arousalAtClimax: number;
  /** Instantaneous edge push used for tip check. */
  tipPush: number;
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
  orgasmSecondsRemaining: number;
  posture: EncounterPosture;
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
    orgasmSecondsRemaining: Math.max(0, state.orgasmSecondsRemaining ?? 0),
    posture: state.posture ?? 'standing',
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
    orgasmSecondsRemaining: 0,
    posture: 'standing',
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
 * - Psych continuum: coexist with gain until overwhelm, then accelerating decay.
 * - Climaxes compound receptivity + resolve-melt intimacy credit (elsewhere).
 * - Post-orgasm window: hypersens overstim → phys; rapid re-climax → phys spike.
 * - Ruin if either discomfort track hard-caps.
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
    orgasmSecondsRemaining,
    posture,
  } = normalizeState(state);
  let climaxed = false;
  let ruined = false;
  let edgeAtClimax = 0;
  let arousalAtClimax = 0;
  let tipPush = 0;

  const erogenous = Math.max(0, Math.min(1, update.erogenous));
  const softCapBoost = Math.min(18, climaxCount * 5);

  // ♀ estrogen → arousal gain (physio + psych equally) + psych-led softCap.
  // Testosterone is not used here (it lowers act arousal gates elsewhere).
  let hormoneGainMult = 1;
  let psychSoftCapBonus = 0;
  if (update.sex === 'F') {
    const H = E.femaleHormoneArousal;
    const e = Math.max(1, update.estrogen ?? 1);
    const lnE = Math.log(e);
    const lnRef = Math.log(Math.max(1.01, H.estrogenGainRef));
    hormoneGainMult = Math.max(
      H.gainMultMin,
      Math.min(H.gainMultMax, 1 + H.estrogenLogWeight * (lnE - lnRef))
    );
    const lnPeak = Math.log(Math.max(1.01, H.estrogenPeakRef));
    const estrogen01 = Math.max(0, Math.min(1, lnE / lnPeak));
    const psychShare =
      update.psychQuality + update.physioQuality > 1e-6
        ? update.psychQuality /
          Math.max(0.05, update.psychQuality + update.physioQuality)
        : 0;
    // Equal E voice on psych track softCap; pure social (psychShare≈1) gets full bonus.
    psychSoftCapBonus =
      H.psychSoftCapBonusMax * estrogen01 * Math.max(0.15, psychShare);
  }

  const softCap = Math.min(
    100,
    arousalSoftCapForErogenous(erogenous) + softCapBoost + psychSoftCapBonus
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
      orgasmSecondsRemaining,
      posture,
      climaxed,
      ruined,
      softCap,
      edgeAtClimax,
      arousalAtClimax,
      tipPush,
    };
  }

  // Tick down refractory + orgasm sensitivity window before edge/climax checks.
  if (refractorySecondsRemaining > 0) {
    refractorySecondsRemaining = Math.max(0, refractorySecondsRemaining - dt);
  }
  const refractory = refractorySecondsRemaining > 0.001;
  const inOrgasmWindow = orgasmSecondsRemaining > 0.001;

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
      physChip *
      E.overstepPsychShare *
      overstepPsychBoost *
      Math.max(painShare, 0.15);
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

  // Post-orgasm hypersens overstim → phys (gentle touch below floor is fine).
  const PO = E.postOrgasm;
  const hypersensI = Math.max(0, update.hypersensStimIntensity ?? 0);
  if (inOrgasmWindow && hypersensI >= PO.overstimIntensityFloor) {
    const intensityScale = hypersensI / 5;
    const over =
      (hypersensI - PO.overstimIntensityFloor) /
      Math.max(0.5, 10 - PO.overstimIntensityFloor);
    const physChip =
      PO.overstimPhysPerSecAtIntensity5 *
      intensityScale *
      (0.45 + 0.55 * Math.max(0, Math.min(1, over))) *
      dt;
    discomfortPhys = clamp100(discomfortPhys + physChip);
  }

  // Significant phys discomfort bleeds into mind (body signal → flinch / fear).
  const P2P = E.physToPsych;
  if (discomfortPhys > P2P.floor) {
    const span = Math.max(1, 100 - P2P.floor);
    const t = Math.min(1, (discomfortPhys - P2P.floor) / span);
    const bleed = P2P.ratePerSecAtFull * Math.pow(t, P2P.curve) * dt;
    discomfortPsych = clamp100(discomfortPsych + bleed);
  }

  if (orgasmSecondsRemaining > 0) {
    orgasmSecondsRemaining = Math.max(0, orgasmSecondsRemaining - dt);
  }

  const psychResp = psychArousalEdgeResponse(discomfortPsych);
  const physDamp =
    1 / (1 + E.discomfortDampPhysK * (discomfortPhys / 100));
  // Heated body keeps a physio-led gain floor through strain (mind objects,
  // body still climbs). At overwhelm, psychResp.gainMult is 0 and steers.
  const heatedPhysioFloor =
    psychResp.edgeAccrueAllowed && physioQ > 0.08
      ? bodyCommit01(arousal) * T.bond.bodyCommit.physioMult * 0.42
      : 0;
  const effectiveGainMult = Math.max(psychResp.gainMult, heatedPhysioFloor);

  // --- Arousal (psych continuum: diminish, then overwhelm decay) ---
  const arousalPush =
    (E.arousalPsychGainPerSec * psychQ + E.arousalPhysioGainPerSec * physioQ) *
    physDamp *
    effectiveGainMult *
    hormoneGainMult;

  if (psychResp.decayPerSec > 0.02) {
    arousal = clamp100(arousal - psychResp.decayPerSec * dt);
  } else if (arousal > softCap + 0.75) {
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

  // --- Edge (psych continuum replaces binary mind soft-block) ---
  const edgeRankGate =
    erogenous >= Er.edgeMinRank
      ? Math.pow(erogenous, Er.edgePhysioPower)
      : 0;
  const canEdge =
    !refractory &&
    psychResp.edgeAccrueAllowed &&
    arousal >= E.edgeArousalFloor &&
    physioQ > 0.06 &&
    edgeRankGate > 0.02;

  // Raw push (pre-clamp) is the tip signal — ceiling does not block tipping.
  // Tip requires edge *already* at minEdge before this push (rebuild after reset).
  const edgeBeforePush = edge;
  let rawEdgePush = 0;
  if (canEdge) {
    rawEdgePush =
      E.edgeGainPerSec *
      physioQ *
      edgeRankGate *
      physDamp *
      effectiveGainMult *
      recv *
      dt;
    edge = clamp100(edge + rawEdgePush);
  } else {
    let edgeDecay =
      E.edgeDecayPerSec * (refractory ? E.refractory.edgeDecayMult : 1);
    if (psychResp.decayPerSec > 0.02) {
      edgeDecay +=
        psychResp.decayPerSec * E.psychContinuum.overwhelmEdgeDecayMult;
    }
    edge = clamp100(edge - edgeDecay * dt);
  }
  tipPush = rawEdgePush;

  // --- Climax via edge-tip (overwhelm blocks tip; male refractory unchanged) ---
  const Tip = E.climaxTip;
  const a01 = arousal / 100;
  // Use pre-push edge for tip requirement shrink + minEdge gate.
  const e01 = edgeBeforePush / 100;
  const tipEase = Math.min(
    Tip.tipReqEaseCap,
    climaxCount * Tip.tipReqEasePerPrior
  );
  const tipRequirement = Math.max(
    Tip.tipReqFloor,
    Tip.tipReqBase *
      (1 - Tip.arousalWeight * a01) *
      (1 - Tip.edgeWeight * e01) *
      (1 - tipEase)
  );

  if (
    !refractory &&
    psychResp.tipAllowed &&
    arousal >= E.edgeArousalFloor &&
    edgeBeforePush >= Tip.minEdge &&
    rawEdgePush >= tipRequirement
  ) {
    climaxed = true;
    edgeAtClimax = edge;
    arousalAtClimax = arousal;
    const prior = climaxCount;
    const wasInOrgasmWindow = inOrgasmWindow;
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

    // Rapid re-climax while still sensitive → phys spike (overwhelmed body).
    if (wasInOrgasmWindow) {
      discomfortPhys = clamp100(
        discomfortPhys + PO.rapidClimaxPhysSpike
      );
    }
    orgasmSecondsRemaining = postOrgasmWindowSeconds(prior);

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
    orgasmSecondsRemaining: round1(orgasmSecondsRemaining),
    posture,
    climaxed,
    ruined,
    softCap: round1(softCap),
    edgeAtClimax: round1(edgeAtClimax),
    arousalAtClimax: round1(arousalAtClimax),
    tipPush: round2(tipPush),
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
    orgasmSecondsRemaining: r.orgasmSecondsRemaining ?? 0,
    posture: r.posture ?? state.posture ?? 'standing',
  };
}

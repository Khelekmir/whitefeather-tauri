import { COMBAT_TUNING } from './combatTuning';
import type { RhythmCompetenceBreakdown } from './rhythmCompetence';

export type RhythmGrade = 'miss' | 'hit' | 'crit';

export type RhythmMissKind = 'early' | 'late' | 'none';

export interface RhythmWindow {
  durationMs: number;
  startScale: number;
  endScale: number;
  /** |outerScale − 1| ≤ critBand → crit */
  critBand: number;
  /** |outerScale − 1| ≤ hitBand → hit */
  hitBand: number;
  rotationDegrees: number;
  critAttackMultiplier: number;
  /** Echo of inputs for UI / logs */
  windowFactor: number;
  competence: number;
}

export interface ScaleRhythmWindowInput {
  /** Stance matchup windowFactor (guarded &lt; 1, exposed &gt; 1). */
  windowFactor?: number;
  /**
   * Attacker competence 0..1+ from weapon/strike transfer
   * (`calcRhythmCompetence`). Defaults to 1 (no skill tax) for tests.
   */
  competence?: number;
  /** From calcRhythmCompetence.speedFactor — eases collapse when high. */
  speedFactor?: number;
  /** From calcRhythmCompetence.luckFactor — widens crit band when high. */
  luckFactor?: number;
}

const R = COMBAT_TUNING.rhythm;
const Comp = R.competence;

/**
 * Build effective QTE window from stance matchup + attacker competence.
 *
 * - windowFactor &lt; 1 (guarded) → tighter bands + faster shrink
 * - low competence → much tighter bands + faster shrink (untrained)
 * - high speed → slower shrink (easier)
 * - high luck → wider crit band only
 */
export function scaleRhythmWindow(
  input: ScaleRhythmWindowInput | number = {}
): RhythmWindow {
  // Back-compat: scaleRhythmWindow(0.84) still works
  const opts: ScaleRhythmWindowInput =
    typeof input === 'number' ? { windowFactor: input } : input;

  const wf = Math.max(0.35, Math.min(1.4, opts.windowFactor ?? 1));
  const competence = Math.max(0, Math.min(1.25, opts.competence ?? 1));
  const speedFactor = Math.max(0, Math.min(1.15, opts.speedFactor ?? 0.5));
  const luckFactor = Math.max(0, Math.min(1.15, opts.luckFactor ?? 0.5));

  const stanceBandScale = 1 - (1 - wf) * R.windowBandInfluence;
  const competenceBandScale = Comp.bandFloor + (1 - Comp.bandFloor) * competence;
  const bandScale = stanceBandScale * competenceBandScale;

  const stanceSpeed = 1 + (1 - Math.min(1, wf)) * 0.35;
  const untrainedHaste = 1 + (1 - Math.min(1, competence)) * Comp.untrainedHaste;
  const speedEase = 1 + speedFactor * Comp.speedEase;
  const durationMs = Math.round(
    (R.durationMs / (stanceSpeed * untrainedHaste)) * speedEase
  );

  const luckCrit = 1 + luckFactor * Comp.luckCritBonus;

  return {
    durationMs: Math.max(350, durationMs),
    startScale: R.startScale,
    endScale: R.endScale,
    critBand: Math.max(0.02, R.critBand * bandScale * luckCrit),
    hitBand: Math.max(0.05, R.hitBand * bandScale),
    rotationDegrees: R.rotationDegrees,
    critAttackMultiplier: R.critAttackMultiplier,
    windowFactor: wf,
    competence,
  };
}

/** Convenience when you already have a competence breakdown. */
export function scaleRhythmWindowFromCompetence(
  windowFactor: number,
  competence: RhythmCompetenceBreakdown
): RhythmWindow {
  return scaleRhythmWindow({
    windowFactor,
    competence: competence.competence,
    speedFactor: competence.speedFactor,
    luckFactor: competence.luckFactor,
  });
}

/** Outer square scale at normalized time t ∈ [0, 1]. */
export function outerScaleAt(t: number, window: RhythmWindow): number {
  const u = Math.max(0, Math.min(1, t));
  return window.startScale + (window.endScale - window.startScale) * u;
}

export function gradeOuterScale(
  scale: number,
  window: RhythmWindow
): { grade: RhythmGrade; missKind: RhythmMissKind; error: number } {
  const error = scale - 1;
  const abs = Math.abs(error);
  if (abs <= window.critBand) {
    return { grade: 'crit', missKind: 'none', error };
  }
  if (abs <= window.hitBand) {
    return { grade: 'hit', missKind: 'none', error };
  }
  return {
    grade: 'miss',
    missKind: error > 0 ? 'early' : 'late',
    error,
  };
}

export type AttackTimingZone =
  | 'miss'
  | 'dodge'
  | 'parry'
  | 'hit'
  | 'crit';

export interface NpcDefenseZoneGrade {
  outcome: AttackTimingZone;
  missKind: RhythmMissKind;
  error: number;
  /** Position in hit band [0,1] early→late (only if in hit band). */
  hitU: number | null;
  /** Position in crit band [0,1] (only if in crit band). */
  critU: number | null;
  dodgeChance: number;
  parryChance: number;
}

/**
 * Map press scale into miss / NPC dodge / NPC parry / hit / crit using
 * defender chances carved from hit-band edges (and parry from crit edges).
 *
 * Hit band (u = 0 early outer → 1 late outer):
 *   [0, D/2) dodge · [D/2, D/2+P/2) parry · middle clean · symmetric late
 * Crit band: [0, P/2) and (1-P/2, 1] → parry; middle → crit.
 * If D+P > 1, both are scaled down proportionally.
 */
export function gradeOuterScaleWithNpcDefense(
  scale: number,
  window: RhythmWindow,
  dodgeChance: number,
  parryChance: number
): NpcDefenseZoneGrade {
  const error = scale - 1;
  const abs = Math.abs(error);
  let d = Math.max(0, Math.min(1, dodgeChance));
  let p = Math.max(0, Math.min(1, parryChance));
  if (d + p > 1) {
    const s = 1 / (d + p);
    d *= s;
    p *= s;
  }

  if (abs > window.hitBand) {
    return {
      outcome: 'miss',
      missKind: error > 0 ? 'early' : 'late',
      error,
      hitU: null,
      critU: null,
      dodgeChance: d,
      parryChance: p,
    };
  }

  // Crit window: only parry eats edges (not dodge).
  if (abs <= window.critBand && window.critBand > 1e-9) {
    const critU = (error + window.critBand) / (2 * window.critBand);
    const halfP = p / 2;
    if (p > 0 && (critU < halfP || critU > 1 - halfP)) {
      return {
        outcome: 'parry',
        missKind: 'none',
        error,
        hitU: (error + window.hitBand) / (2 * window.hitBand),
        critU,
        dodgeChance: d,
        parryChance: p,
      };
    }
    return {
      outcome: 'crit',
      missKind: 'none',
      error,
      hitU: (error + window.hitBand) / (2 * window.hitBand),
      critU,
      dodgeChance: d,
      parryChance: p,
    };
  }

  // Hit band outside crit: dodge at outer edges, parry adjacent inward.
  const hitU = (error + window.hitBand) / (2 * window.hitBand);
  const halfD = d / 2;
  const halfP = p / 2;
  if (d > 0 && (hitU < halfD || hitU > 1 - halfD)) {
    return {
      outcome: 'dodge',
      missKind: 'none',
      error,
      hitU,
      critU: null,
      dodgeChance: d,
      parryChance: p,
    };
  }
  if (
    p > 0 &&
    ((hitU >= halfD && hitU < halfD + halfP) ||
      (hitU > 1 - halfD - halfP && hitU <= 1 - halfD))
  ) {
    return {
      outcome: 'parry',
      missKind: 'none',
      error,
      hitU,
      critU: null,
      dodgeChance: d,
      parryChance: p,
    };
  }
  return {
    outcome: 'hit',
    missKind: 'none',
    error,
    hitU,
    critU: null,
    dodgeChance: d,
    parryChance: p,
  };
}

/** Grade a press at normalized time t. */
export function gradeTiming(
  t: number,
  window: RhythmWindow
): { grade: RhythmGrade; missKind: RhythmMissKind; scale: number; error: number } {
  const scale = outerScaleAt(t, window);
  const graded = gradeOuterScale(scale, window);
  return { ...graded, scale };
}

/**
 * Normalized time t when outer scale equals `scale`
 * (linear shrink from startScale → endScale).
 */
export function timeAtScale(scale: number, window: RhythmWindow): number {
  const span = window.endScale - window.startScale;
  if (Math.abs(span) < 1e-9) return 0;
  return (scale - window.startScale) / span;
}

/**
 * How long (ms) the outer square spends inside the hit / crit scale bands
 * while shrinking. Useful for Battleground preview notes.
 */
export function bandDurationsMs(window: RhythmWindow): {
  totalMs: number;
  hitMs: number;
  critMs: number;
} {
  const span = window.endScale - window.startScale;
  if (Math.abs(span) < 1e-9 || window.durationMs <= 0) {
    return { totalMs: window.durationMs, hitMs: 0, critMs: 0 };
  }

  const durationInBand = (band: number): number => {
    const lo = 1 - band;
    const hi = 1 + band;
    const tEnter = Math.max(0, Math.min(1, timeAtScale(hi, window)));
    const tLeave = Math.max(0, Math.min(1, timeAtScale(lo, window)));
    const dt = Math.max(0, tLeave - tEnter);
    return Math.round(window.durationMs * dt);
  };

  return {
    totalMs: window.durationMs,
    hitMs: durationInBand(window.hitBand),
    critMs: durationInBand(window.critBand),
  };
}

export function rhythmGradeLabel(grade: RhythmGrade): string {
  switch (grade) {
    case 'crit':
      return 'CRIT';
    case 'hit':
      return 'HIT';
    case 'miss':
      return 'MISS';
  }
}

/**
 * Defense QTE labels — avoid attack-flavored "HIT"/"CRIT".
 * Maps timing bands: crit → precise/clean, hit → sloppy/edge.
 */
export function defenseRhythmGradeLabel(
  verb: 'dodge' | 'parry' | 'block',
  grade: RhythmGrade
): string {
  if (verb === 'dodge') {
    if (grade === 'crit') return 'PRECISE DODGE';
    if (grade === 'hit') return 'SLOPPY DODGE';
    return 'DODGE FAIL';
  }
  if (verb === 'block') {
    if (grade === 'crit') return 'REDIRECTING BLOCK';
    if (grade === 'hit') return 'FLAT BLOCK';
    return 'BLOCK FAIL';
  }
  if (grade === 'crit') return 'CLEAN PARRY';
  if (grade === 'hit') return 'EDGE PARRY';
  return 'PARRY FAIL';
}

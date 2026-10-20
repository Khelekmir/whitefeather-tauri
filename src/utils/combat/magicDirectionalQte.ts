/**
 * Magical combat — directional timed QTE (arrow keys / WASD).
 * Hit/miss/crit: correct direction + timing within competence-scaled windows.
 * Crit is a percentage of the hit window (luck-widened). Sequence hit = all beats hit;
 * each crit beat stacks power via magicCritPowerMultiplier.
 * Visual: collapsing arrowhead eclipses a center outline (all four dirs overlaid).
 */

import { COMBAT_TUNING } from './combatTuning';
import {
  calcWildMagicBacklash,
  magicSequencePowerMultiplier,
  type WildMagicBacklash,
} from './magicCompetence';

export type MagicQteDirection = 'up' | 'down' | 'left' | 'right';

export type MagicQteMissKind =
  | 'none'
  | 'early'
  | 'late'
  | 'wrongDirection'
  | 'timeout';

/** Per-beat grade: miss / hit / crit (replaces binary pass/fail). */
export type MagicQteGrade = 'miss' | 'hit' | 'crit';

export interface MagicDirectionalWindow {
  durationMs: number;
  successWindowMs: number;
  startScale: number;
  endScale: number;
  /**
   * Crit half-width as a fraction of hit half-width (0..1).
   * Omit / default from tuning baseCritFraction when not competence-scaled.
   */
  critFraction?: number;
}

export interface MagicQteGradeResult {
  grade: MagicQteGrade;
  missKind: MagicQteMissKind;
  /** Required direction for this trial. */
  required: MagicQteDirection;
  /** Direction the player pressed, if any. */
  pressed: MagicQteDirection | null;
  /** Elapsed ms at press / timeout. */
  elapsedMs: number;
  /** Wall-clock ms when outer scale == 1 (perfect eclipse). */
  perfectMs: number;
  /** elapsedMs − perfectMs (negative = early). */
  timingErrorMs: number;
  /** Outer arrow scale at resolve. */
  scale: number;
}

export const MAGIC_QTE_DIRECTIONS: readonly MagicQteDirection[] = [
  'up',
  'down',
  'left',
  'right',
] as const;

export function defaultMagicDirectionalWindow(
  overrides?: Partial<MagicDirectionalWindow>
): MagicDirectionalWindow {
  const T = COMBAT_TUNING.magicDirectionalQte;
  const C = COMBAT_TUNING.magicCompetence;
  return {
    durationMs: overrides?.durationMs ?? T.durationMs,
    successWindowMs: overrides?.successWindowMs ?? T.successWindowMs,
    startScale: overrides?.startScale ?? T.startScale,
    endScale: overrides?.endScale ?? T.endScale,
    critFraction: overrides?.critFraction ?? C.baseCritFraction,
  };
}

/** Elapsed ms when outer scale equals 1 (matches center outline size). */
export function perfectEclipseMs(window: MagicDirectionalWindow): number {
  const span = window.startScale - window.endScale;
  if (!(span > 0) || !(window.durationMs > 0)) return window.durationMs * 0.5;
  const t = (window.startScale - 1) / span;
  return Math.max(0, Math.min(1, t)) * window.durationMs;
}

export function scaleAtElapsedMs(
  elapsedMs: number,
  window: MagicDirectionalWindow
): number {
  const t = Math.max(0, Math.min(1, elapsedMs / Math.max(1, window.durationMs)));
  return window.startScale + (window.endScale - window.startScale) * t;
}

export function pickRandomMagicDirection(
  rng: () => number = Math.random
): MagicQteDirection {
  const i = Math.floor(rng() * MAGIC_QTE_DIRECTIONS.length) % MAGIC_QTE_DIRECTIONS.length;
  return MAGIC_QTE_DIRECTIONS[i]!;
}

/**
 * Map keyboard event to a magic QTE direction.
 * Arrows and WASD (and hjkl optional? — stick to arrows + WASD per design).
 */
export function magicDirectionFromKey(key: string): MagicQteDirection | null {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'up';
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down';
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right';
    default:
      return null;
  }
}

function resolveCritFraction(window: MagicDirectionalWindow): number {
  const raw =
    window.critFraction ?? COMBAT_TUNING.magicCompetence.baseCritFraction;
  return Math.max(0, Math.min(1, raw));
}

export function gradeMagicDirectionalInput(input: {
  required: MagicQteDirection;
  pressed: MagicQteDirection | null;
  elapsedMs: number;
  window?: MagicDirectionalWindow;
  /** True when the collapse finished with no valid press. */
  timedOut?: boolean;
}): MagicQteGradeResult {
  const window = input.window ?? defaultMagicDirectionalWindow();
  const perfectMs = perfectEclipseMs(window);
  const elapsedMs = Math.max(0, input.elapsedMs);
  const scale = scaleAtElapsedMs(elapsedMs, window);
  const timingErrorMs = elapsedMs - perfectMs;
  const hitHalf = window.successWindowMs * 0.5;
  const critHalf = hitHalf * resolveCritFraction(window);

  if (input.timedOut || input.pressed == null) {
    return {
      grade: 'miss',
      missKind: 'timeout',
      required: input.required,
      pressed: input.pressed,
      elapsedMs,
      perfectMs,
      timingErrorMs,
      scale,
    };
  }

  if (input.pressed !== input.required) {
    return {
      grade: 'miss',
      missKind: 'wrongDirection',
      required: input.required,
      pressed: input.pressed,
      elapsedMs,
      perfectMs,
      timingErrorMs,
      scale,
    };
  }

  const absErr = Math.abs(timingErrorMs);
  if (absErr <= critHalf) {
    return {
      grade: 'crit',
      missKind: 'none',
      required: input.required,
      pressed: input.pressed,
      elapsedMs,
      perfectMs,
      timingErrorMs,
      scale,
    };
  }

  if (absErr <= hitHalf) {
    return {
      grade: 'hit',
      missKind: 'none',
      required: input.required,
      pressed: input.pressed,
      elapsedMs,
      perfectMs,
      timingErrorMs,
      scale,
    };
  }

  return {
    grade: 'miss',
    missKind: timingErrorMs < 0 ? 'early' : 'late',
    required: input.required,
    pressed: input.pressed,
    elapsedMs,
    perfectMs,
    timingErrorMs,
    scale,
  };
}

export function magicQteGradeLabel(grade: MagicQteGrade): string {
  switch (grade) {
    case 'crit':
      return 'CRIT';
    case 'hit':
      return 'HIT';
    case 'miss':
      return 'MISS';
  }
}

export function magicQteMissLabel(missKind: MagicQteMissKind): string {
  switch (missKind) {
    case 'none':
      return '';
    case 'early':
      return 'early';
    case 'late':
      return 'late';
    case 'wrongDirection':
      return 'wrong direction';
    case 'timeout':
      return 'timeout';
  }
}

/**
 * How the collapsing glyph is shown for a beat (spell decipher presentation).
 * - hidden: eclipse overlay only (timing not yet studied)
 * - spinning: collapses with tip landing on required dir at eclipse (skill-readable)
 * - directional: true (or already-known) arrow shown upright
 */
export type MagicQteArrowMode = 'hidden' | 'spinning' | 'directional';

/** Degrees for an up-pointing glyph rotated to face each cardinal. */
export const MAGIC_DIR_DEGREES: Record<MagicQteDirection, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
};

/** Normalized time when outer scale == 1 (perfect eclipse). */
export function magicPerfectEclipseT(window: {
  startScale: number;
  endScale: number;
}): number {
  const span = window.startScale - window.endScale;
  if (!(span > 0)) return 0.5;
  return Math.max(0, Math.min(1, (window.startScale - 1) / span));
}

/**
 * Spinning-glyph rotation (degrees) at normalized collapse time t.
 * Lands on `required` at perfect eclipse; `spinDegrees` is signed relative travel
 * across the full collapse (random CW/CCW × 50–150% of base).
 */
export function magicSpinRotationAt(
  t: number,
  window: { startScale: number; endScale: number },
  required: MagicQteDirection,
  spinDegrees: number
): number {
  const u = Math.max(0, Math.min(1, t));
  return (
    MAGIC_DIR_DEGREES[required] +
    spinDegrees * (u - magicPerfectEclipseT(window))
  );
}

/** Pick signed spinDegrees for one undeciphered beat (random dir + 50–150% speed). */
export function pickMagicSpinDegrees(rng: () => number = Math.random): number {
  const T = COMBAT_TUNING.magicDirectionalQte;
  const min = T.spinSpeedMin;
  const max = T.spinSpeedMax;
  const speed = min + rng() * Math.max(0, max - min);
  const sign = rng() < 0.5 ? -1 : 1;
  return T.spinBaseDegrees * speed * sign;
}

/** One beat in a spell formula — direction + delay from sequence start. */
export interface MagicQteSequenceBeatSpec {
  /** Required input for grading (may be random when undeciphered). */
  direction: MagicQteDirection;
  /** Absolute start delay from sequence begin (ms). */
  startAtMs: number;
  /** Authored formula direction (when different from grading `direction`). */
  trueDirection?: MagicQteDirection;
  arrowMode?: MagicQteArrowMode;
  timingKnown?: boolean;
  directionKnown?: boolean;
  /**
   * Signed relative rotation across the collapse for spinning mode.
   * Tip = MAGIC_DIR_DEGREES[direction] at perfect eclipse.
   */
  spinDegrees?: number;
}

export interface MagicQteSequenceSpec {
  id: string;
  label: string;
  beats: MagicQteSequenceBeatSpec[];
  /** Optional spell id for labs / resolve (e.g. flux). */
  spellId?: string;
  /** Decipher 0–1 used to build this presentation (lab / combat). */
  decipher01?: number;
  timingsKnown?: number;
  directionsKnown?: number;
}

export interface MagicQteSequenceBeatResult extends MagicQteGradeResult {
  beatIndex: number;
  startAtMs: number;
}

export interface MagicQteSequenceResult {
  specId: string;
  beats: MagicQteSequenceBeatResult[];
  /** Beats with correct direction + timing (hit or crit). */
  hitCount: number;
  critCount: number;
  /** Mistimed, wrong direction, or timeout. */
  missCount: number;
  /** Correct direction regardless of timing (excludes wrongDirection / timeout). */
  correctDirectionCount: number;
  /** True when every beat was timed (hit or crit). */
  allTimed: boolean;
  /**
   * (hitCount / beats) * critPowerMult ^ critCount.
   * Mistimed beats cut base power; they do not void the cast.
   */
  powerMultiplier: number;
  /** Base power fraction before crit stack (hitCount / beats). */
  basePower01: number;
  /**
   * Cast connects when every beat has the correct direction (timing may be early/late).
   * Wrong direction / timeout on any beat → miss (no page).
   * Mistimed correct-direction beats still connect at reduced power.
   */
  grade: 'miss' | 'hit';
  /**
   * Caster backlash when mistimes exceed half of non-skipped (non-timeout) beats.
   * Damage apply is deferred — backlashPower01 is the contract stub.
   */
  wildMagic: WildMagicBacklash;
}

/** Aggregate beat grades: mistimed cuts power; crits multiply after base. */
export function summarizeMagicSequenceResult(
  specId: string,
  beats: MagicQteSequenceBeatResult[]
): MagicQteSequenceResult {
  const critCount = beats.filter((b) => b.grade === 'crit').length;
  const hitCount = beats.filter(
    (b) => b.grade === 'hit' || b.grade === 'crit'
  ).length;
  const missCount = beats.filter((b) => b.grade === 'miss').length;
  const mistimedCount = beats.filter(
    (b) => b.missKind === 'early' || b.missKind === 'late'
  ).length;
  const skippedCount = beats.filter((b) => b.missKind === 'timeout').length;
  const wrongDirectionCount = beats.filter(
    (b) => b.missKind === 'wrongDirection'
  ).length;
  const correctDirectionCount = beats.filter(
    (b) =>
      b.pressed === b.required &&
      (b.grade === 'hit' ||
        b.grade === 'crit' ||
        b.missKind === 'early' ||
        b.missKind === 'late')
  ).length;
  const allDirectionsCorrect =
    beats.length > 0 && correctDirectionCount === beats.length;
  const allTimed = missCount === 0 && beats.length > 0;
  const basePower01 = beats.length > 0 ? hitCount / beats.length : 0;
  // Power only applies when the cast connects (all directions correct).
  const powerMultiplier = allDirectionsCorrect
    ? magicSequencePowerMultiplier(hitCount, beats.length, critCount)
    : 0;
  const wildMagic = calcWildMagicBacklash({
    beatCount: beats.length,
    mistimedCount,
    skippedCount,
    wrongDirectionCount,
  });
  return {
    specId,
    beats,
    hitCount,
    critCount,
    missCount,
    correctDirectionCount,
    allTimed,
    powerMultiplier,
    basePower01: allDirectionsCorrect ? basePower01 : 0,
    grade: allDirectionsCorrect ? 'hit' : 'miss',
    wildMagic,
  };
}

/** Build evenly staggered beats (spell formula pattern). */
export function buildStaggeredMagicSequence(
  directions: readonly MagicQteDirection[],
  staggerMs: number = COMBAT_TUNING.magicDirectionalQte.sequenceStaggerMs,
  opts?: { id?: string; label?: string; spellId?: string }
): MagicQteSequenceSpec {
  return {
    id: opts?.id ?? `seq_${directions.join('_')}`,
    label: opts?.label ?? directions.join(' → '),
    spellId: opts?.spellId,
    beats: directions.map((direction, i) => ({
      direction,
      startAtMs: i * staggerMs,
    })),
  };
}

/**
 * @deprecated Prefer buildSpellSequence / spellSequenceSpec from spellQteFormulas.
 * Kept as a thin Flux-shaped fallback for older call sites.
 */
export const TEST_SPELL_SEQUENCE_LRU = buildStaggeredMagicSequence(
  ['left', 'right', 'up', 'down'],
  COMBAT_TUNING.magicDirectionalQte.sequenceStaggerMs,
  { id: 'test_lru', label: 'Legacy Flux stub · ← → ↑ ↓', spellId: 'flux' }
);

/** Opacity 0→1 over fadeInMs for a beat that began `ageMs` ago. */
export function magicQteFadeInOpacity(
  ageMs: number,
  fadeInMs: number = COMBAT_TUNING.magicDirectionalQte.fadeInMs
): number {
  if (!(fadeInMs > 0)) return 1;
  return Math.max(0, Math.min(1, ageMs / fadeInMs));
}

/** Opacity 1→0 over fadeOutMs after a beat resolved `sinceResolveMs` ago. */
export function magicQteResolvedFadeOpacity(
  sinceResolveMs: number,
  fadeOutMs: number = COMBAT_TUNING.magicDirectionalQte.resolvedFadeOutMs
): number {
  if (!(fadeOutMs > 0)) return 0;
  return Math.max(0, Math.min(1, 1 - sinceResolveMs / fadeOutMs));
}

/**
 * 0 at startScale → 1 once scale ≤ 1 (eclipse).
 * Used to ease center-outline brightness with the collapsing arrow.
 */
export function magicQteOutlineApproach01(
  scale: number,
  startScale: number
): number {
  if (!(startScale > 1)) return 1;
  if (scale <= 1) return 1;
  return Math.max(0, Math.min(1, (startScale - scale) / (startScale - 1)));
}

/** Dim→bright outline opacity from approach01 (smoothstep, no snap-on flash). */
export function magicQteOutlineOpacity(
  approach01: number,
  dim = 0.35,
  bright = 0.95
): number {
  const a = Math.max(0, Math.min(1, approach01));
  const t = a * a * (3 - 2 * a);
  return dim + (bright - dim) * t;
}

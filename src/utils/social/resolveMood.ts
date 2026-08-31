import {
  MOOD_CLASSES,
  MOOD_RECEPTIVITY,
  type MoodClass,
  type MoodReceptivity,
} from '../../data/social/moodClasses';
import { composeFlavor, getMoodLexicon } from '../../data/social/moodLexicons';
import {
  parseTemperament,
  type ParsedTemperament,
  type TemperamentPrimary,
} from '../../data/social/temperaments';
import type { Sex, Unit as DetailedUnit } from '../../types/characters';
import { cycleTellForUnit } from '../../data/social/cycleLexicon';
import {
  cyclePressureBias,
  hormonesForUnit,
} from '../lewd/ovulationCycle';
import { derivePainLoad } from './painLoad';
import { readPersonalizedValue } from './durablePressureState';
import { MOOD_RESOLVE_TUNING as T } from './moodResolveTuning';

export type AffectBand = 'low' | 'med' | 'high';

/** Continuous 0–100 drivers used for scoring (bands kept for debug display). */
export interface AffectLevels {
  lust: number;
  belonging: number;
  stress: number;
  energy: number;
  agency: number;
  pride: number;
  shame: number;
  painLoad: number;
}

export interface AffectVector {
  lust: AffectBand;
  belonging: AffectBand;
  stress: AffectBand;
  energy: AffectBand;
  agency: AffectBand;
  pride: AffectBand;
  shame: AffectBand;
  painLoad: AffectBand;
}

export interface ResolvedMood {
  temperament: ParsedTemperament;
  levels: AffectLevels;
  affect: AffectVector;
  affectKey: string;
  /** Dominant gameplay mood. */
  moodClass: MoodClass;
  /** Runner-up tint, if gated rules allow. */
  tintClass: MoodClass | null;
  /** 0–1 how strong the tint is when present (ratio-based). */
  tintStrength: number;
  primaryScore: number;
  secondaryScore: number;
  flavor: string;
  tell: string;
  /** Cycle phenomenology tell (null for non-cycling cast). */
  cycleTell: string | null;
  receptivity: MoodReceptivity;
  rationale: string[];
  /** Why tint was skipped, when relevant (lab). */
  tintNote: string | null;
}

const LEVELS: { max: number; label: AffectBand }[] = [
  { max: 33, label: 'low' },
  { max: 66, label: 'med' },
  { max: 100, label: 'high' },
];

export function bandFrom100(value: number): AffectBand {
  const v = Math.max(0, Math.min(100, value));
  for (const row of LEVELS) {
    if (v <= row.max) return row.label;
  }
  return 'high';
}

/** Smooth 0–1 influence from a 0–100 meter (responsive to small nudges). */
export function soft01(value: number): number {
  const x = Math.max(0, Math.min(100, value));
  const z = T.softSteepness * (x - T.softMidpoint);
  return 1 / (1 + Math.exp(-z));
}

/** High-end emphasis: stronger when meter is clearly elevated. */
export function softHigh(value: number): number {
  return Math.pow(soft01(value), 1.15);
}

/** Low-end emphasis: stronger when meter is clearly depleted. */
export function softLow(value: number): number {
  return Math.pow(1 - soft01(value), 1.15);
}

function blendReceptivity(
  primary: MoodClass,
  secondary: MoodClass | null,
  tintStrength: number
): MoodReceptivity {
  const a = MOOD_RECEPTIVITY[primary];
  if (!secondary || tintStrength <= 0) return { ...a };
  const b = MOOD_RECEPTIVITY[secondary];
  const wp = T.receptivityPrimaryShare;
  const ws = T.receptivitySecondaryShare * tintStrength;
  const wSum = wp + ws;
  const mix = (x: number, y: number) => (x * wp + y * ws) / wSum;
  return {
    chore: mix(a.chore, b.chore),
    talk: mix(a.talk, b.talk),
    friction: mix(a.friction, b.friction),
    bond: mix(a.bond, b.bond),
  };
}

function scoreClassContinuous(
  primary: TemperamentPrimary,
  secondary: TemperamentPrimary,
  primaryWeight: number,
  L: AffectLevels
): {
  scores: Record<MoodClass, number>;
  rationale: string[];
} {
  const scores = Object.fromEntries(MOOD_CLASSES.map((c) => [c, 0])) as Record<
    MoodClass,
    number
  >;
  const rationale: string[] = [];

  const add = (cls: MoodClass, amount: number, why: string) => {
    if (amount <= 0.02) return;
    scores[cls] += amount;
    if (amount >= 0.28) rationale.push(why);
  };

  const wP = primaryWeight;
  const wS = 1 - primaryWeight;

  const sHi = softHigh(L.stress);
  const sLo = softLow(L.stress);
  const bHi = softHigh(L.belonging);
  const bLo = softLow(L.belonging);
  const lHi = softHigh(L.lust);
  const eHi = softHigh(L.energy);
  const eLo = softLow(L.energy);
  const aHi = softHigh(L.agency);
  const aLo = softLow(L.agency);
  const pHi = softHigh(L.pride);
  const shHi = softHigh(L.shame);
  const painHi = softHigh(L.painLoad);

  const paint = (who: TemperamentPrimary, w: number, tag: string) => {
    // Stress
    if (who === 'Choleric') add('irritable', 1.25 * w * sHi, `${tag} stress→irritable`);
    if (who === 'Melancholic') add('melancholy', 1.2 * w * sHi, `${tag} stress→melancholy`);
    if (who === 'Sanguine') add('anxious', 0.95 * w * sHi, `${tag} stress→anxious`);
    if (who === 'Phlegmatic') add('withdrawn', 0.9 * w * sHi, `${tag} stress→withdrawn`);
    add('overwhelmed', 0.45 * w * sHi * eLo, `${tag} stress×fatigue`);
    if (who === 'Choleric') add('driven', 0.55 * w * soft01(L.stress) * (1 - sHi), `${tag} edged drive`);

    // Belonging
    if (who === 'Sanguine') {
      add('warm', 1.15 * w * bHi, `${tag} belonging→warm`);
      add('playful', 0.85 * w * bHi * eHi, `${tag} belonging→playful`);
    }
    if (who === 'Choleric') {
      add('warm', 0.55 * w * bHi, `${tag} belonging→warm`);
      add('driven', 0.5 * w * bHi, `${tag} belonging→driven`);
    }
    if (who === 'Phlegmatic') add('warm', 1.0 * w * bHi, `${tag} belonging→quiet warm`);
    if (who === 'Melancholic') {
      add('affectionate', 0.75 * w * bHi, `${tag} belonging→tender`);
      add('open', 0.55 * w * bHi, `${tag} belonging→open`);
    }
    add('open', 0.35 * w * soft01(L.belonging) * soft01(100 - Math.abs(L.belonging - 50)), `${tag} steady`);
    if (who === 'Melancholic') add('melancholy', 0.9 * w * bLo, `${tag} lonely`);
    if (who === 'Choleric') add('frustrated', 0.7 * w * bLo, `${tag} unsupported`);
    if (who === 'Sanguine') add('withdrawn', 0.6 * w * bLo, `${tag} starved of company`);
    if (who === 'Phlegmatic') add('withdrawn', 0.55 * w * bLo, `${tag} detached`);

    // Lust
    if (who === 'Sanguine') {
      add('playful', 0.85 * w * lHi, `${tag} lust→playful`);
      add('affectionate', 0.75 * w * lHi, `${tag} lust→affectionate`);
    }
    if (who === 'Choleric') {
      add('frustrated', 0.6 * w * lHi * (0.4 + bLo), `${tag} lust→impatient`);
      add('affectionate', 0.55 * w * lHi, `${tag} lust→claiming`);
    }
    if (who === 'Melancholic') {
      add('affectionate', 0.8 * w * lHi, `${tag} lust→yearning`);
      add('frustrated', 0.7 * w * lHi * bLo, `${tag} yearning+lonely`);
    }
    if (who === 'Phlegmatic') add('affectionate', 0.65 * w * lHi, `${tag} lust→slow burn`);

    // Energy
    add('tired', 1.05 * w * eLo, `${tag} low energy`);
    if (who === 'Sanguine') add('playful', 0.55 * w * eHi, `${tag} high energy`);
    if (who === 'Choleric') add('driven', 0.6 * w * eHi, `${tag} high energy`);

    // Agency
    if (who === 'Choleric') add('frustrated', 0.85 * w * aLo, `${tag} low agency`);
    if (who === 'Melancholic') add('withdrawn', 0.65 * w * aLo, `${tag} helpless`);
    if (who === 'Choleric') add('driven', 0.55 * w * aHi, `${tag} high agency`);
    add('open', 0.3 * w * aHi, `${tag} capable`);

    // Pride / shame
    if (who === 'Choleric') add('driven', 0.6 * w * pHi, `${tag} pride`);
    if (who === 'Sanguine') add('warm', 0.45 * w * pHi, `${tag} pride`);
    if (who === 'Melancholic') add('melancholy', 0.75 * w * shHi, `${tag} shame`);
    if (who === 'Choleric') add('irritable', 0.6 * w * shHi, `${tag} shame`);
    if (who === 'Sanguine') add('withdrawn', 0.55 * w * shHi, `${tag} shame`);
    if (who === 'Phlegmatic') add('withdrawn', 0.6 * w * shHi, `${tag} shame`);

    // Pain
    add('tired', 0.55 * w * painHi, `${tag} pain`);
    if (who === 'Choleric') add('irritable', 0.5 * w * painHi, `${tag} pain`);
    if (who === 'Melancholic') add('melancholy', 0.45 * w * painHi, `${tag} pain`);
  };

  paint(primary, wP, 'primary');
  paint(secondary, wS, 'secondary');

  // Cross-terms (continuous)
  add('frustrated', 0.85 * lHi * bLo, 'lust without belonging');
  add('overwhelmed', 0.95 * sHi * eLo, 'stressed+spent');
  add('warm', 0.55 * bHi * sLo * (1 - 0.5 * eLo), 'connected & easy');
  add('withdrawn', 0.5 * shHi * softLow(L.pride), 'shame without pride');

  // Global dampers on spark when depleted / hurting
  scores.playful *= 1 - 0.45 * eLo;
  scores.driven *= 1 - 0.4 * eLo;
  scores.playful *= 1 - 0.5 * painHi;
  scores.tired *= 1 + 0.2 * eLo;

  if (rationale.length > 5) rationale.length = 5;
  return { scores, rationale };
}

function pickPrimaryAndTint(scores: Record<MoodClass, number>): {
  primary: MoodClass;
  secondary: MoodClass | null;
  primaryScore: number;
  secondaryScore: number;
  tintStrength: number;
  tintNote: string | null;
} {
  const ranked = [...MOOD_CLASSES]
    .map((c) => ({ c, s: scores[c] }))
    .sort((a, b) => b.s - a.s);

  const top = ranked[0] ?? { c: 'open' as MoodClass, s: 0 };
  const runner = ranked[1] ?? { c: 'open' as MoodClass, s: 0 };
  const primaryScore = top.s;
  const secondaryScore = runner.s;
  const lead = primaryScore - secondaryScore;
  const ratio = primaryScore > 1e-6 ? secondaryScore / primaryScore : 0;

  let tintNote: string | null = null;
  let secondary: MoodClass | null = null;
  let tintStrength = 0;

  if (primaryScore >= T.exceptionalPrimaryScore) {
    tintNote = `tint suppressed — primary exceptional (${primaryScore.toFixed(2)} ≥ ${T.exceptionalPrimaryScore})`;
  } else if (lead >= T.exceptionalLeadMargin) {
    tintNote = `tint suppressed — clear lead (${lead.toFixed(2)} ≥ ${T.exceptionalLeadMargin})`;
  } else if (ratio < T.tintRatioMin) {
    tintNote = `tint suppressed — runner-up weak (ratio ${ratio.toFixed(2)} < ${T.tintRatioMin})`;
  } else if (runner.c === top.c) {
    tintNote = 'tint suppressed — no distinct runner-up';
  } else {
    secondary = runner.c;
    // Map ratio from [tintRatioMin, 1] → (0, 1]
    tintStrength = Math.max(
      0.15,
      Math.min(1, (ratio - T.tintRatioMin) / (1 - T.tintRatioMin))
    );
    tintNote = null;
  }

  return {
    primary: top.c,
    secondary,
    primaryScore,
    secondaryScore,
    tintStrength,
    tintNote,
  };
}

export function levelsFromUnit(unit: DetailedUnit): AffectLevels {
  const hormones = hormonesForUnit(unit);
  const bias = hormones ? cyclePressureBias(hormones.phase) : null;
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return {
    lust: readPersonalizedValue(unit, 'lust'),
    belonging: readPersonalizedValue(unit, 'belonging'),
    stress: clamp(readPersonalizedValue(unit, 'stress') + (bias?.stress ?? 0)),
    energy: clamp(readPersonalizedValue(unit, 'energy') + (bias?.energy ?? 0)),
    agency: readPersonalizedValue(unit, 'agency'),
    pride: readPersonalizedValue(unit, 'pride'),
    shame: clamp(readPersonalizedValue(unit, 'shame') + (bias?.shame ?? 0)),
    painLoad: derivePainLoad(unit.combatStats.itemizedHealth),
  };
}

export function affectFromLevels(L: AffectLevels): AffectVector {
  return {
    lust: bandFrom100(L.lust),
    belonging: bandFrom100(L.belonging),
    stress: bandFrom100(L.stress),
    energy: bandFrom100(L.energy),
    agency: bandFrom100(L.agency),
    pride: bandFrom100(L.pride),
    shame: bandFrom100(L.shame),
    painLoad: bandFrom100(L.painLoad),
  };
}

export function affectFromUnit(unit: DetailedUnit): AffectVector {
  return affectFromLevels(levelsFromUnit(unit));
}

/**
 * Continuous pressure scoring → primary mood class + optional secondary tint.
 */
export function resolveMood(unit: DetailedUnit): ResolvedMood {
  const temperament = parseTemperament(unit.socialStats.static.temperament);
  const levels = levelsFromUnit(unit);
  const affect = affectFromLevels(levels);
  const affectKey = [
    affect.lust,
    affect.belonging,
    affect.stress,
    affect.energy,
    affect.agency,
    affect.pride,
    affect.shame,
    affect.painLoad,
  ].join('-');

  const { scores, rationale } = scoreClassContinuous(
    temperament.primary,
    temperament.secondary,
    T.primaryWeight,
    levels
  );
  const picked = pickPrimaryAndTint(scores);
  const lexicon = getMoodLexicon(temperament.blend);
  const { line, tell } = composeFlavor(
    lexicon,
    picked.primary,
    unit.sex,
    picked.secondary
  );
  const cycleTell = cycleTellForUnit(unit);
  const tellWithCycle = cycleTell ? `${tell} — and ${cycleTell}` : tell;

  return {
    temperament,
    levels,
    affect,
    affectKey,
    moodClass: picked.primary,
    tintClass: picked.secondary,
    tintStrength: picked.tintStrength,
    primaryScore: picked.primaryScore,
    secondaryScore: picked.secondaryScore,
    flavor: line,
    tell: tellWithCycle,
    cycleTell,
    receptivity: blendReceptivity(
      picked.primary,
      picked.secondary,
      picked.tintStrength
    ),
    rationale,
    tintNote: picked.tintNote,
  };
}

export function resolveMoodAsBlend(
  unit: DetailedUnit,
  blend: string,
  sex: Sex = unit.sex
): ResolvedMood {
  const fake = {
    ...unit,
    sex,
    socialStats: {
      ...unit.socialStats,
      static: { ...unit.socialStats.static, temperament: blend },
    },
  };
  return resolveMood(fake);
}

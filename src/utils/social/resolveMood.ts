import {
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
import { derivePainLoad } from './painLoad';
import { readPersonalizedValue } from './durablePressureState';

export type AffectBand = 'low' | 'med' | 'high';

/** Forward-looking drivers — no legacy happiness axis. */
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
  affect: AffectVector;
  affectKey: string;
  moodClass: MoodClass;
  /** Player-facing phrase (may hide the math). */
  flavor: string;
  /** Behavioral tell for UI / dialogue direction. */
  tell: string;
  receptivity: MoodReceptivity;
  /** Why this class won — lab / debug. */
  rationale: string[];
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

function scoreClass(
  primary: TemperamentPrimary,
  secondary: TemperamentPrimary,
  primaryWeight: number,
  a: AffectVector
): { moodClass: MoodClass; rationale: string[] } {
  const scores: Partial<Record<MoodClass, number>> = {};
  const rationale: string[] = [];

  const add = (cls: MoodClass, amount: number, why: string) => {
    scores[cls] = (scores[cls] ?? 0) + amount;
    if (amount >= 0.35) rationale.push(why);
  };

  const wP = primaryWeight;
  const wS = 1 - primaryWeight;

  const paint = (who: TemperamentPrimary, w: number, tag: string) => {
    if (a.stress === 'high') {
      if (who === 'Choleric') add('irritable', 1.2 * w, `${tag} stress→irritable`);
      if (who === 'Melancholic') add('melancholy', 1.15 * w, `${tag} stress→melancholy`);
      if (who === 'Sanguine') add('anxious', 0.9 * w, `${tag} stress→anxious`);
      if (who === 'Phlegmatic') add('withdrawn', 0.85 * w, `${tag} stress→withdrawn`);
      add('overwhelmed', 0.35 * w, `${tag} high stress`);
    }
    if (a.stress === 'med' && who === 'Choleric') {
      add('driven', 0.4 * w, `${tag} edged drive`);
    }

    // Belonging stands in for social warmth / connection (replaces happiness)
    if (a.belonging === 'high') {
      if (who === 'Sanguine') add('warm', 1.1 * w, `${tag} belonging→warm`);
      if (who === 'Sanguine') add('playful', 0.75 * w, `${tag} belonging→playful`);
      if (who === 'Choleric') add('warm', 0.5 * w, `${tag} belonging→warm`);
      if (who === 'Choleric') add('driven', 0.45 * w, `${tag} belonging→driven`);
      if (who === 'Phlegmatic') add('warm', 0.95 * w, `${tag} belonging→quiet warm`);
      if (who === 'Melancholic') add('affectionate', 0.7 * w, `${tag} belonging→tender`);
      if (who === 'Melancholic') add('open', 0.55 * w, `${tag} belonging→open`);
    }
    if (a.belonging === 'med') add('open', 0.45 * w, `${tag} steady belonging`);
    if (a.belonging === 'low') {
      if (who === 'Melancholic') add('melancholy', 0.85 * w, `${tag} lonely`);
      if (who === 'Choleric') add('frustrated', 0.65 * w, `${tag} unsupported`);
      if (who === 'Sanguine') add('withdrawn', 0.55 * w, `${tag} starved of company`);
      if (who === 'Phlegmatic') add('withdrawn', 0.5 * w, `${tag} detached`);
    }

    if (a.lust === 'high') {
      if (who === 'Sanguine') add('playful', 0.8 * w, `${tag} lust→playful`);
      if (who === 'Sanguine') add('affectionate', 0.7 * w, `${tag} lust→affectionate`);
      if (who === 'Choleric') add('frustrated', 0.55 * w, `${tag} lust→impatient`);
      if (who === 'Choleric') add('affectionate', 0.5 * w, `${tag} lust→claiming`);
      if (who === 'Melancholic') add('affectionate', 0.75 * w, `${tag} lust→yearning`);
      if (who === 'Melancholic' && a.belonging === 'low')
        add('frustrated', 0.65 * w, `${tag} yearning+lonely`);
      if (who === 'Phlegmatic') add('affectionate', 0.6 * w, `${tag} lust→slow burn`);
    }

    if (a.energy === 'low') add('tired', 1.0 * w, `${tag} low energy`);
    if (a.energy === 'high') {
      if (who === 'Sanguine') add('playful', 0.5 * w, `${tag} high energy`);
      if (who === 'Choleric') add('driven', 0.55 * w, `${tag} high energy`);
    }

    if (a.agency === 'low') {
      if (who === 'Choleric') add('frustrated', 0.8 * w, `${tag} low agency`);
      if (who === 'Melancholic') add('withdrawn', 0.6 * w, `${tag} helpless`);
    }
    if (a.agency === 'high') {
      if (who === 'Choleric') add('driven', 0.5 * w, `${tag} high agency`);
      add('open', 0.25 * w, `${tag} capable`);
    }

    if (a.pride === 'high') {
      if (who === 'Choleric') add('driven', 0.55 * w, `${tag} pride`);
      if (who === 'Sanguine') add('warm', 0.4 * w, `${tag} pride`);
    }
    if (a.shame === 'high') {
      if (who === 'Melancholic') add('melancholy', 0.7 * w, `${tag} shame`);
      if (who === 'Choleric') add('irritable', 0.55 * w, `${tag} shame`);
      if (who === 'Sanguine') add('withdrawn', 0.5 * w, `${tag} shame`);
      if (who === 'Phlegmatic') add('withdrawn', 0.55 * w, `${tag} shame`);
    }

    if (a.painLoad === 'high') {
      add('tired', 0.5 * w, `${tag} pain`);
      if (who === 'Choleric') add('irritable', 0.45 * w, `${tag} pain`);
      if (who === 'Melancholic') add('melancholy', 0.4 * w, `${tag} pain`);
    }
  };

  paint(primary, wP, 'primary');
  paint(secondary, wS, 'secondary');

  if (a.lust === 'high' && a.belonging === 'low') add('frustrated', 0.8, 'lust without belonging');
  if (a.stress === 'high' && a.energy === 'low') add('overwhelmed', 0.9, 'stressed+spent');
  if (a.belonging === 'high' && a.stress === 'low' && a.energy !== 'low')
    add('warm', 0.5, 'connected & easy');
  if (a.shame === 'high' && a.pride === 'low') add('withdrawn', 0.45, 'shame without pride');

  let best: MoodClass = 'open';
  let bestScore = -Infinity;
  for (const [cls, score] of Object.entries(scores) as [MoodClass, number][]) {
    let s = score;
    if (a.energy === 'low' && (cls === 'playful' || cls === 'driven')) s *= 0.55;
    if (a.energy === 'low' && cls === 'tired') s *= 1.15;
    if (a.painLoad === 'high' && cls === 'playful') s *= 0.5;
    if (s > bestScore) {
      bestScore = s;
      best = cls;
    }
  }

  if (rationale.length > 4) rationale.length = 4;
  return { moodClass: best, rationale };
}

export function affectFromUnit(unit: DetailedUnit): AffectVector {
  return {
    lust: bandFrom100(readPersonalizedValue(unit, 'lust')),
    belonging: bandFrom100(readPersonalizedValue(unit, 'belonging')),
    stress: bandFrom100(readPersonalizedValue(unit, 'stress')),
    energy: bandFrom100(readPersonalizedValue(unit, 'energy')),
    agency: bandFrom100(readPersonalizedValue(unit, 'agency')),
    pride: bandFrom100(readPersonalizedValue(unit, 'pride')),
    shame: bandFrom100(readPersonalizedValue(unit, 'shame')),
    painLoad: bandFrom100(derivePainLoad(unit.combatStats.itemizedHealth)),
  };
}

/**
 * Compose mood class + temperament-flavored phrase from durable pressures.
 */
export function resolveMood(unit: DetailedUnit): ResolvedMood {
  const temperament = parseTemperament(unit.socialStats.static.temperament);
  const affect = affectFromUnit(unit);
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
  const { moodClass, rationale } = scoreClass(
    temperament.primary,
    temperament.secondary,
    temperament.primaryWeight,
    affect
  );
  const lexicon = getMoodLexicon(temperament.blend);
  const { line, tell } = composeFlavor(lexicon, moodClass);
  return {
    temperament,
    affect,
    affectKey,
    moodClass,
    flavor: line,
    tell,
    receptivity: MOOD_RECEPTIVITY[moodClass],
    rationale,
  };
}

/** Lab helper: same numbers, force another blend’s voice (for A/B comparison). */
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

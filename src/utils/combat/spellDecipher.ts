/**
 * Spell unlock + decipher presentation.
 * Timing unlocks in the first half of decipher01; true directions in the second.
 * Undeciphered direction beats use per-cast random required dirs; the glyph spins
 * so its tip lands on that dir at eclipse (skill-readable, melee-style).
 */

import {
  buildSpellSequence,
  getSpellQteFormula,
} from '../../data/combat/spellQteFormulas';
import { type SpellId } from '../../data/combat/spellCatalog';
import type { Unit as DetailedUnit } from '../../types/characters';
import {
  pickMagicSpinDegrees,
  type MagicQteArrowMode,
  type MagicQteDirection,
  type MagicQteSequenceSpec,
} from './magicDirectionalQte';

const DIRS: readonly MagicQteDirection[] = [
  'up',
  'down',
  'left',
  'right',
];

export interface SpellKnowledge {
  unlocked: boolean;
  decipher01: number;
}

export interface SpellRevealProgress {
  decipher01: number;
  beatCount: number;
  /** First half of decipher — how many leading beats show collapse timing. */
  timingsKnown: number;
  /** Second half — how many leading beats show the true formula direction. */
  directionsKnown: number;
  timingUnlock01: number;
  directionUnlock01: number;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function isSpellUnlocked(
  unit: DetailedUnit,
  spellId: SpellId
): boolean {
  return unit.combatStats.spellUnlocked?.[spellId] === true;
}

export function getSpellDecipher01(
  unit: DetailedUnit,
  spellId: SpellId
): number {
  const v = unit.combatStats.spellDecipher01?.[spellId];
  return typeof v === 'number' ? clamp01(v) : 0;
}

export function getSpellKnowledge(
  unit: DetailedUnit,
  spellId: SpellId
): SpellKnowledge {
  return {
    unlocked: isSpellUnlocked(unit, spellId),
    decipher01: getSpellDecipher01(unit, spellId),
  };
}

export function setSpellUnlocked(
  unit: DetailedUnit,
  spellId: SpellId,
  unlocked: boolean
): DetailedUnit {
  const prev = { ...(unit.combatStats.spellUnlocked ?? {}) };
  if (unlocked) prev[spellId] = true;
  else delete prev[spellId];
  return {
    ...unit,
    combatStats: { ...unit.combatStats, spellUnlocked: prev },
  };
}

export function setSpellDecipher01(
  unit: DetailedUnit,
  spellId: SpellId,
  decipher01: number
): DetailedUnit {
  const prev = { ...(unit.combatStats.spellDecipher01 ?? {}) };
  prev[spellId] = clamp01(decipher01);
  return {
    ...unit,
    combatStats: { ...unit.combatStats, spellDecipher01: prev },
  };
}

/**
 * Map decipher 0–1 → timing then direction reveal counts.
 * Example: 3 beats at 70% → timingsKnown 3, directionsKnown 1.
 */
export function spellRevealProgress(
  decipher01: number,
  beatCount: number
): SpellRevealProgress {
  const n = Math.max(0, Math.floor(beatCount));
  const d = clamp01(decipher01);
  const timingUnlock01 = Math.min(1, d / 0.5);
  const directionUnlock01 = d <= 0.5 ? 0 : Math.min(1, (d - 0.5) / 0.5);

  let timingsKnown =
    n === 0 ? 0 : timingUnlock01 >= 1 ? n : Math.floor(timingUnlock01 * n);
  let directionsKnown =
    n === 0
      ? 0
      : directionUnlock01 >= 1
        ? n
        : Math.floor(directionUnlock01 * n);
  directionsKnown = Math.min(directionsKnown, timingsKnown);

  return {
    decipher01: d,
    beatCount: n,
    timingsKnown,
    directionsKnown,
    timingUnlock01,
    directionUnlock01,
  };
}

export function arrowModeForBeat(
  beatIndex: number,
  reveal: SpellRevealProgress
): MagicQteArrowMode {
  if (beatIndex >= reveal.timingsKnown) return 'hidden';
  if (beatIndex >= reveal.directionsKnown) return 'spinning';
  return 'directional';
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(...parts: Array<string | number>): number {
  let h = 2166136261;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickRandomDirection(rng: () => number): MagicQteDirection {
  return DIRS[Math.floor(rng() * DIRS.length) % DIRS.length]!;
}

export interface BuildDecipheredSequenceOpts {
  /** 0–1 study progress. */
  decipher01: number;
  /** Stable-ish seed; include cast attempt id so random dirs re-roll. */
  seed?: number;
  rng?: () => number;
}

/**
 * Build a castable sequence with decipher presentation.
 * Timing always follows the authored gaps; unknown directions are randomized
 * per cast (pattern does not leak from another character's decipher). Spinning
 * glyphs land on the required dir at eclipse — skill-based, not a blind guess.
 */
export function buildDecipheredSpellSequence(
  spellId: SpellId,
  opts: BuildDecipheredSequenceOpts
): MagicQteSequenceSpec {
  const built = buildSpellSequence(spellId);
  const formula = getSpellQteFormula(spellId);
  const reveal = spellRevealProgress(opts.decipher01, built.beats.length);
  const rng =
    opts.rng ??
    mulberry32(opts.seed ?? hashSeed(spellId, opts.decipher01, Date.now()));

  const beats = built.beats.map((b, i) => {
    const trueDirection = formula.directions[i]!;
    const mode = arrowModeForBeat(i, reveal);
    const directionKnown = mode === 'directional';
    const timingKnown = mode !== 'hidden';
    const direction = directionKnown
      ? trueDirection
      : pickRandomDirection(rng);
    const spinDegrees =
      mode === 'spinning' ? pickMagicSpinDegrees(rng) : undefined;
    return {
      direction,
      startAtMs: b.startAtMs,
      trueDirection,
      arrowMode: mode,
      timingKnown,
      directionKnown,
      spinDegrees,
    };
  });

  const knownLabel =
    reveal.directionsKnown >= reveal.beatCount
      ? built.label
      : `${built.label.split(' · ')[0]} · decipher ${(reveal.decipher01 * 100).toFixed(0)}% · timing ${reveal.timingsKnown}/${reveal.beatCount} · dirs ${reveal.directionsKnown}/${reveal.beatCount}`;

  return {
    id: built.id,
    label: knownLabel,
    spellId,
    beats,
    decipher01: reveal.decipher01,
    timingsKnown: reveal.timingsKnown,
    directionsKnown: reveal.directionsKnown,
  };
}

export function describeSpellReveal(reveal: SpellRevealProgress): string {
  if (reveal.beatCount <= 0) return 'no beats';
  if (reveal.timingsKnown <= 0) {
    return 'eclipse only — pattern invisible';
  }
  if (reveal.directionsKnown <= 0) {
    return `timing ${reveal.timingsKnown}/${reveal.beatCount} · dirs spinning → eclipse`;
  }
  if (reveal.directionsKnown >= reveal.beatCount) {
    return 'fully deciphered';
  }
  const spinning = reveal.beatCount - reveal.directionsKnown;
  return `timing ${reveal.timingsKnown}/${reveal.beatCount} · dirs ${reveal.directionsKnown}/${reveal.beatCount} · ${spinning} spin-lock`;
}

/** Seed lab knowledge from starter tomes + existing spell ranks. */
export function seedSpellKnowledgeFromSkills(
  unit: DetailedUnit,
  unlockedSpellIds: readonly SpellId[]
): DetailedUnit {
  let next = unit;
  const unlocked: Partial<Record<SpellId, boolean>> = {
    ...(unit.combatStats.spellUnlocked ?? {}),
  };
  const decipher: Partial<Record<SpellId, number>> = {
    ...(unit.combatStats.spellDecipher01 ?? {}),
  };
  for (const id of unlockedSpellIds) {
    unlocked[id] = true;
    if (decipher[id] == null) {
      const rank = unit.combatStats.spellSkill[id] ?? 0;
      // Practiced spells start partly/fully studied; raw unlock stays low.
      decipher[id] = clamp01(rank / 120);
    }
  }
  next = {
    ...next,
    combatStats: {
      ...next.combatStats,
      spellUnlocked: unlocked,
      spellDecipher01: decipher,
    },
  };
  return next;
}

export function formatSpellKnowledgeLabel(k: SpellKnowledge): string {
  if (!k.unlocked) return 'Locked';
  if (k.decipher01 <= 0) return 'Unlocked · undeciphered';
  if (k.decipher01 >= 1) return 'Unlocked · fully deciphered';
  return `Unlocked · ${(k.decipher01 * 100).toFixed(0)}% deciphered`;
}

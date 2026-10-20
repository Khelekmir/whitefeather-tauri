/**
 * Per-spell magic QTE formulas — unique direction patterns and unique gap timings.
 * Beat count must match qteBeatCount(spell) = ceil(effectiveMt / 2).
 */

import type {
  MagicQteDirection,
  MagicQteSequenceSpec,
} from '../../utils/combat/magicDirectionalQte';
import {
  SPELL_DEFS,
  SPELL_IDS,
  qteBeatCount,
  type SpellId,
} from './spellCatalog';

export interface SpellQteFormula {
  spellId: SpellId;
  directions: readonly MagicQteDirection[];
  /** Gaps between consecutive beats (ms). Length === directions.length - 1. */
  gapsMs: readonly number[];
}

type Dir = MagicQteDirection;

/** Authored formulas — one unique pattern + gap profile per FE7 attack tome. */
export const SPELL_QTE_FORMULAS: Record<SpellId, SpellQteFormula> = {
  // Anima — alternating / elemental strike rhythms
  fire: {
    spellId: 'fire',
    directions: ['left', 'right', 'up'] as const satisfies readonly Dir[],
    gapsMs: [720, 640],
  },
  thunder: {
    spellId: 'thunder',
    directions: ['up', 'down', 'up', 'right'] as const satisfies readonly Dir[],
    gapsMs: [580, 700, 620],
  },
  elfire: {
    spellId: 'elfire',
    directions: ['right', 'up', 'left', 'up', 'down'] as const satisfies readonly Dir[],
    gapsMs: [660, 540, 780, 600],
  },
  bolting: {
    spellId: 'bolting',
    directions: ['up', 'up', 'right', 'left', 'down', 'up'] as const satisfies readonly Dir[],
    gapsMs: [920, 880, 1000, 860, 940],
  },
  fimbulvetr: {
    spellId: 'fimbulvetr',
    directions: ['left', 'up', 'right', 'up', 'left', 'down', 'right'] as const satisfies readonly Dir[],
    gapsMs: [610, 740, 560, 690, 630, 710],
  },
  excalibur: {
    spellId: 'excalibur',
    directions: [
      'up',
      'right',
      'down',
      'left',
      'up',
      'left',
      'down',
      'right',
      'up',
    ] as const satisfies readonly Dir[],
    gapsMs: [520, 680, 540, 720, 500, 660, 580, 640],
  },
  forblaze: {
    spellId: 'forblaze',
    directions: ['right', 'left', 'up', 'right', 'down', 'left', 'up'] as const satisfies readonly Dir[],
    gapsMs: [650, 590, 810, 570, 730, 610],
  },

  // Light — cleaner mirrored / ascending patterns
  lightning: {
    spellId: 'lightning',
    directions: ['up', 'down'] as const satisfies readonly Dir[],
    gapsMs: [850],
  },
  shine: {
    spellId: 'shine',
    directions: ['up', 'left', 'right'] as const satisfies readonly Dir[],
    gapsMs: [760, 760],
  },
  divine: {
    spellId: 'divine',
    directions: ['left', 'up', 'right', 'up'] as const satisfies readonly Dir[],
    gapsMs: [700, 640, 700],
  },
  purge: {
    spellId: 'purge',
    directions: ['up', 'down', 'left', 'right', 'up'] as const satisfies readonly Dir[],
    gapsMs: [980, 900, 1040, 920],
  },
  aura: {
    spellId: 'aura',
    directions: ['left', 'right', 'left', 'right', 'up', 'down'] as const satisfies readonly Dir[],
    gapsMs: [620, 620, 680, 560, 740],
  },
  aureola: {
    spellId: 'aureola',
    directions: [
      'up',
      'right',
      'up',
      'left',
      'up',
      'down',
      'left',
      'right',
    ] as const satisfies readonly Dir[],
    gapsMs: [550, 670, 530, 690, 510, 710, 570],
  },
  luce: {
    spellId: 'luce',
    directions: [
      'right',
      'up',
      'left',
      'down',
      'right',
      'up',
      'left',
      'up',
    ] as const satisfies readonly Dir[],
    gapsMs: [490, 630, 550, 670, 510, 650, 590],
  },

  // Dark — denser / offset gaps; intentional repeats
  flux: {
    spellId: 'flux',
    directions: ['left', 'right', 'up', 'down'] as const satisfies readonly Dir[],
    gapsMs: [800, 680, 760],
  },
  nosferatu: {
    spellId: 'nosferatu',
    directions: ['down', 'left', 'up', 'right', 'down'] as const satisfies readonly Dir[],
    gapsMs: [670, 730, 590, 710],
  },
  luna: {
    spellId: 'luna',
    directions: ['left', 'left', 'right', 'up', 'left'] as const satisfies readonly Dir[],
    gapsMs: [640, 820, 560, 750],
  },
  eclipse: {
    spellId: 'eclipse',
    directions: ['down', 'up', 'down', 'left', 'right', 'down'] as const satisfies readonly Dir[],
    gapsMs: [960, 1020, 880, 1100, 940],
  },
  fenrir: {
    spellId: 'fenrir',
    directions: [
      'right',
      'down',
      'left',
      'up',
      'right',
      'down',
      'left',
      'down',
    ] as const satisfies readonly Dir[],
    gapsMs: [580, 700, 520, 760, 540, 680, 600],
  },
  gespenst: {
    spellId: 'gespenst',
    directions: [
      'left',
      'up',
      'right',
      'down',
      'left',
      'right',
      'up',
      'down',
      'left',
      'up',
      'right',
      'left',
    ] as const satisfies readonly Dir[],
    gapsMs: [480, 560, 460, 620, 500, 540, 470, 580, 490, 530, 510],
  },
  ereshkigal: {
    spellId: 'ereshkigal',
    directions: [
      'up',
      'left',
      'down',
      'right',
      'up',
      'right',
      'down',
      'left',
      'up',
      'down',
    ] as const satisfies readonly Dir[],
    gapsMs: [500, 640, 480, 700, 460, 660, 520, 620, 540],
  },
};

export function getSpellQteFormula(spellId: SpellId): SpellQteFormula {
  return SPELL_QTE_FORMULAS[spellId];
}

/** Human-readable pattern: ← ·720· → ·640· ↑ */
export function formatSpellQtePattern(spellId: SpellId): string {
  const f = SPELL_QTE_FORMULAS[spellId];
  const arrow: Record<Dir, string> = {
    up: '↑',
    down: '↓',
    left: '←',
    right: '→',
  };
  const parts: string[] = [];
  for (let i = 0; i < f.directions.length; i++) {
    parts.push(arrow[f.directions[i]!]);
    if (i < f.gapsMs.length) parts.push(`·${f.gapsMs[i]}·`);
  }
  return parts.join(' ');
}

export interface SpellSequenceBuild {
  id: string;
  label: string;
  spellId: SpellId;
  beats: { direction: MagicQteDirection; startAtMs: number }[];
}

/** Build sequence timing from the authored formula. */
export function buildSpellSequence(spellId: SpellId): SpellSequenceBuild {
  const def = SPELL_DEFS[spellId];
  const f = SPELL_QTE_FORMULAS[spellId];
  let t = 0;
  const beats = f.directions.map((direction, i) => {
    const startAtMs = t;
    if (i < f.gapsMs.length) t += f.gapsMs[i]!;
    return { direction, startAtMs };
  });
  return {
    id: `spell_${spellId}`,
    label: `${def.label} · ${formatSpellQtePattern(spellId)}`,
    spellId,
    beats,
  };
}

/** MagicQteSequenceSpec ready for MagicDirectionalQteSequence. */
export function spellSequenceSpec(spellId: SpellId): MagicQteSequenceSpec {
  const built = buildSpellSequence(spellId);
  return {
    id: built.id,
    label: built.label,
    spellId: built.spellId,
    beats: built.beats,
  };
}

/** Dev assert: formulas match beat counts and uniqueness. */
export function assertSpellQteFormulasValid(): string[] {
  const errors: string[] = [];
  const dirKeys = new Set<string>();
  const gapKeys = new Set<string>();

  for (const id of SPELL_IDS) {
    const f = SPELL_QTE_FORMULAS[id];
    const need = qteBeatCount(id);
    if (f.directions.length !== need) {
      errors.push(`${id}: directions ${f.directions.length} !== beatCount ${need}`);
    }
    if (f.gapsMs.length !== Math.max(0, f.directions.length - 1)) {
      errors.push(
        `${id}: gaps ${f.gapsMs.length} !== directions-1 (${f.directions.length - 1})`
      );
    }
    const dKey = f.directions.join(',');
    if (dirKeys.has(dKey)) errors.push(`${id}: duplicate direction pattern ${dKey}`);
    dirKeys.add(dKey);
    const gKey = f.gapsMs.join(',');
    if (f.gapsMs.length > 0) {
      if (gapKeys.has(gKey)) errors.push(`${id}: duplicate gaps profile ${gKey}`);
      gapKeys.add(gKey);
    }
  }
  return errors;
}

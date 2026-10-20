/**
 * Magic schools (school ranks on weaponSkill) and per-spell ranks (spellSkill).
 * Attack tomes from FE7 Blazing Sword; staffMagic school reserved (no staff spells yet).
 *
 * Learning new spells (deciphering) is out of scope — casters gain practice/experience
 * on spells they already know. Live combat will require the matching tome equipped.
 */

export const MAGIC_SCHOOL_IDS = [
  'anima',
  'light',
  'dark',
  'staffMagic',
] as const;

export type MagicSchoolId = (typeof MAGIC_SCHOOL_IDS)[number];

export type SpellRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'Prf';

/**
 * FE7 attack tomes. Beat count = ceil(effectiveMt / 2), min 1.
 * Luna / Eclipse use designMt for QTE length only.
 */
export const SPELL_IDS = [
  // Anima
  'fire',
  'thunder',
  'elfire',
  'bolting',
  'fimbulvetr',
  'excalibur',
  'forblaze',
  // Light
  'lightning',
  'shine',
  'divine',
  'purge',
  'aura',
  'aureola',
  'luce',
  // Dark
  'flux',
  'nosferatu',
  'luna',
  'eclipse',
  'fenrir',
  'gespenst',
  'ereshkigal',
] as const;

export type SpellId = (typeof SPELL_IDS)[number];

export const DEFAULT_SPELL_SKILL_RANK = 1;

/** Soft tags for future combat effects (drain, siege, etc.) — not resolved yet. */
export type SpellEffectTag =
  | 'drain'
  | 'negateRes'
  | 'halfHp'
  | 'siege'
  | 'legendary'
  | 'dragonEffective'
  | 'luckBoost'
  | 'resBoost';

export interface SpellDef {
  id: SpellId;
  label: string;
  school: MagicSchoolId;
  /** FE7 weapon rank. */
  rank: SpellRank;
  /**
   * FE7 Might. Luna is 0; Eclipse has no standard Mt (use designMt for QTE).
   */
  mt: number;
  /**
   * When set, used for QTE beat count instead of mt (Luna / Eclipse).
   */
  designMt?: number;
  /** Inclusive [min, max] range in tiles (FE7). */
  range: readonly [number, number];
  /** FE7 uses — maps to tome page count. */
  pages: number;
  note?: string;
  /** Future combat-specific effects; applied over time, not this pass. */
  effectTags?: readonly SpellEffectTag[];
}

export const SPELL_DEFS: Record<SpellId, SpellDef> = {
  // —— Anima ——
  fire: {
    id: 'fire',
    label: 'Fire',
    school: 'anima',
    rank: 'E',
    mt: 5,
    range: [1, 2],
    pages: 40,
    note: 'Anima primer — Erk starter.',
  },
  thunder: {
    id: 'thunder',
    label: 'Thunder',
    school: 'anima',
    rank: 'D',
    mt: 8,
    range: [1, 2],
    pages: 35,
  },
  elfire: {
    id: 'elfire',
    label: 'Elfire',
    school: 'anima',
    rank: 'C',
    mt: 10,
    range: [1, 2],
    pages: 30,
  },
  bolting: {
    id: 'bolting',
    label: 'Bolting',
    school: 'anima',
    rank: 'B',
    mt: 12,
    range: [3, 10],
    pages: 5,
    note: 'Siege anima — cannot be countered (FE7).',
    effectTags: ['siege'],
  },
  fimbulvetr: {
    id: 'fimbulvetr',
    label: 'Fimbulvetr',
    school: 'anima',
    rank: 'A',
    mt: 13,
    range: [1, 2],
    pages: 20,
  },
  excalibur: {
    id: 'excalibur',
    label: 'Excalibur',
    school: 'anima',
    rank: 'S',
    mt: 18,
    range: [1, 2],
    pages: 25,
  },
  forblaze: {
    id: 'forblaze',
    label: 'Forblaze',
    school: 'anima',
    rank: 'Prf',
    mt: 14,
    range: [1, 2],
    pages: 20,
    note: 'Legendary anima — Athos. Luck +5; effective vs dragons (FE7).',
    effectTags: ['legendary', 'luckBoost', 'dragonEffective'],
  },
  // —— Light ——
  lightning: {
    id: 'lightning',
    label: 'Lightning',
    school: 'light',
    rank: 'E',
    mt: 4,
    range: [1, 2],
    pages: 35,
  },
  shine: {
    id: 'shine',
    label: 'Shine',
    school: 'light',
    rank: 'D',
    mt: 6,
    range: [1, 2],
    pages: 30,
    note: 'Light primer — Lucy starter.',
  },
  divine: {
    id: 'divine',
    label: 'Divine',
    school: 'light',
    rank: 'C',
    mt: 8,
    range: [1, 2],
    pages: 25,
  },
  purge: {
    id: 'purge',
    label: 'Purge',
    school: 'light',
    rank: 'B',
    mt: 10,
    range: [3, 10],
    pages: 5,
    note: 'Siege light — cannot be countered (FE7).',
    effectTags: ['siege'],
  },
  aura: {
    id: 'aura',
    label: 'Aura',
    school: 'light',
    rank: 'A',
    mt: 12,
    range: [1, 2],
    pages: 20,
  },
  aureola: {
    id: 'aureola',
    label: 'Aureola',
    school: 'light',
    rank: 'S',
    mt: 15,
    range: [1, 2],
    pages: 20,
    note: 'Legendary light — Athos. Res +5; effective vs dragons / Dark Druid (FE7).',
    effectTags: ['legendary', 'resBoost', 'dragonEffective'],
  },
  luce: {
    id: 'luce',
    label: 'Luce',
    school: 'light',
    rank: 'S',
    mt: 16,
    range: [1, 2],
    pages: 25,
  },
  // —— Dark ——
  flux: {
    id: 'flux',
    label: 'Flux',
    school: 'dark',
    rank: 'D',
    mt: 7,
    range: [1, 2],
    pages: 45,
    note: 'Dark primer — Black Fang shaman routine cast.',
  },
  nosferatu: {
    id: 'nosferatu',
    label: 'Nosferatu',
    school: 'dark',
    rank: 'C',
    mt: 10,
    range: [1, 2],
    pages: 20,
    note: 'Drains HP (FE7). Needs its own practice beyond dark school floor.',
    effectTags: ['drain'],
  },
  luna: {
    id: 'luna',
    label: 'Luna',
    school: 'dark',
    rank: 'C',
    mt: 0,
    designMt: 10,
    range: [1, 2],
    pages: 35,
    note: 'Negates enemy Resistance (FE7). QTE length uses designMt 10.',
    effectTags: ['negateRes'],
  },
  eclipse: {
    id: 'eclipse',
    label: 'Eclipse',
    school: 'dark',
    rank: 'B',
    mt: 0,
    designMt: 12,
    range: [3, 10],
    pages: 5,
    note: 'Siege dark — halves HP (FE7). QTE length uses designMt 12.',
    effectTags: ['siege', 'halfHp'],
  },
  fenrir: {
    id: 'fenrir',
    label: 'Fenrir',
    school: 'dark',
    rank: 'A',
    mt: 15,
    range: [1, 2],
    pages: 20,
  },
  gespenst: {
    id: 'gespenst',
    label: 'Gespenst',
    school: 'dark',
    rank: 'S',
    mt: 23,
    range: [1, 2],
    pages: 25,
  },
  ereshkigal: {
    id: 'ereshkigal',
    label: 'Ereshkigal',
    school: 'dark',
    rank: 'Prf',
    mt: 20,
    range: [1, 2],
    pages: 0,
    note: 'Nergal personal — unobtainable in FE7 normal play.',
    effectTags: ['legendary'],
  },
};

/** Effective Mt for QTE beat sizing (designMt overrides when present). */
export function spellEffectiveMt(spell: SpellDef | SpellId): number {
  const def = typeof spell === 'string' ? SPELL_DEFS[spell] : spell;
  if (!def) return 1;
  return def.designMt ?? def.mt;
}

/** Beat count = ceil(effectiveMt / 2), minimum 1. */
export function qteBeatCount(spell: SpellDef | SpellId): number {
  return Math.max(1, Math.ceil(spellEffectiveMt(spell) / 2));
}

export function getSpellDef(spellId: string): SpellDef | null {
  return (SPELL_DEFS as Record<string, SpellDef>)[spellId] ?? null;
}

export function getSpellSchool(spellId: string): MagicSchoolId | null {
  return getSpellDef(spellId)?.school ?? null;
}

export function formatSpellLabel(spellId: SpellId): string {
  return SPELL_DEFS[spellId].label;
}

export function formatMagicSchoolLabel(school: MagicSchoolId): string {
  switch (school) {
    case 'anima':
      return 'Anima';
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    case 'staffMagic':
      return 'Staff (Magic)';
  }
}

export function spellsInSchool(school: MagicSchoolId): readonly SpellId[] {
  return SPELL_IDS.filter((id) => SPELL_DEFS[id].school === school);
}

export function tomeTemplateIdForSpell(spellId: SpellId): string {
  return `${spellId}-tome`;
}

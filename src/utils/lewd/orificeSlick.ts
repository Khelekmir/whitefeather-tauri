/**
 * Multi-lubricant orifice slick layers.
 * Comfort gates deferred — this is the registry + writers/readers for Lab / verge.
 */

export type OrificeId = 'vagina' | 'anus' | 'mouth';

export type LubricantKind =
  | 'vaginalSecretion'
  | 'saliva'
  | 'semen'
  | 'preEjaculate'
  | 'oilRefined'
  | 'oilImprovised'
  | 'plantExtract'
  | 'slugMucin';

export interface OrificeSlickLayer {
  kind: LubricantKind;
  /** Local wet load 0–1 (soft-capped when blending). */
  amount01: number;
  /**
   * Comfort effectiveness 0–1 for this layer.
   * Usually taken from the catalog; stored so temporary modifiers can stick.
   */
  quality01: number;
}

export interface LubricantCatalogEntry {
  kind: LubricantKind;
  label: string;
  /** Default comfort quality 0–1. */
  quality01: number;
  /** Evaporate / dry-out rate per hour (higher = gone faster). */
  evaporatePerHour: number;
  /** Short Lab blurb. */
  note: string;
}

/**
 * Catalog stubs — qualities + dry-out.
 * Biological thin films use skin/orifice timescales (minutes), not cloth soak drying.
 * Half-life ≈ ln(2) / evaporatePerHour hours.
 * vaginalSecretion ~4.2 → ~10 min half-life; mostly gone by ~20–30 min unless refreshed.
 */
export const LUBRICANT_CATALOG: Record<LubricantKind, LubricantCatalogEntry> = {
  vaginalSecretion: {
    kind: 'vaginalSecretion',
    label: 'vaginal secretion',
    quality01: 0.72,
    evaporatePerHour: 4.2,
    note: 'Mid-high slick; exposed film lasts ~10–20 min unless refreshed.',
  },
  saliva: {
    kind: 'saliva',
    label: 'saliva',
    quality01: 0.5,
    evaporatePerHour: 6.0,
    note: 'Act-sized; dries in minutes. Usual mouth default.',
  },
  semen: {
    kind: 'semen',
    label: 'semen',
    quality01: 0.28,
    evaporatePerHour: 5.0,
    note: 'Effective but poor/short-lived lubricant (~minutes of useful slick).',
  },
  preEjaculate: {
    kind: 'preEjaculate',
    label: 'pre-ejaculate',
    quality01: 0.34,
    evaporatePerHour: 7.0,
    note: 'Tiny male arousal volume — flashes off quickly.',
  },
  oilRefined: {
    kind: 'oilRefined',
    label: 'refined oil',
    quality01: 0.92,
    evaporatePerHour: 0.08,
    note: 'Expensive purpose lube; slow dry (hours).',
  },
  oilImprovised: {
    kind: 'oilImprovised',
    label: 'improvised oil',
    quality01: 0.55,
    evaporatePerHour: 0.18,
    note: 'Butter / cooking oil; hours-scale; irritation flag later.',
  },
  plantExtract: {
    kind: 'plantExtract',
    label: 'plant extract',
    quality01: 0.7,
    evaporatePerHour: 0.45,
    note: 'Harvest volume later; slower than spit, faster than refined oil.',
  },
  slugMucin: {
    kind: 'slugMucin',
    label: 'slug mucin',
    quality01: 0.88,
    evaporatePerHour: 0.12,
    note: 'Fantasy infestation slick; persistent; wriggle stimulus later.',
  },
};

/** Soft cap on summed wet01 per orifice before blend clamp. */
export const ORIFICE_SLICK_WET_CAP = 1.35;

export type OrificeSlickById = Partial<Record<OrificeId, OrificeSlickLayer[]>>;

export interface OrificeSlickReport {
  orifice: OrificeId;
  wet01: number;
  quality01: number;
  dominant: LubricantKind | null;
  layers: OrificeSlickLayer[];
  /** Short Lab tag, e.g. "anus 42% · vaginal secretion". */
  label: string;
  /** Present-tense flavor when wet. */
  flavor: string | null;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function catalogEntry(kind: LubricantKind): LubricantCatalogEntry {
  return LUBRICANT_CATALOG[kind];
}

export function normalizeLayers(
  layers: OrificeSlickLayer[] | undefined
): OrificeSlickLayer[] {
  if (!layers?.length) return [];
  const byKind = new Map<LubricantKind, OrificeSlickLayer>();
  for (const layer of layers) {
    if (!(layer.amount01 > 1e-6)) continue;
    const prev = byKind.get(layer.kind);
    if (!prev) {
      byKind.set(layer.kind, {
        kind: layer.kind,
        amount01: Math.max(0, layer.amount01),
        quality01: clamp01(layer.quality01),
      });
      continue;
    }
    const total = prev.amount01 + layer.amount01;
    const quality01 =
      total > 1e-6
        ? (prev.quality01 * prev.amount01 + layer.quality01 * layer.amount01) /
          total
        : prev.quality01;
    byKind.set(layer.kind, {
      kind: layer.kind,
      amount01: total,
      quality01: clamp01(quality01),
    });
  }
  return [...byKind.values()].sort((a, b) => b.amount01 - a.amount01);
}

export function blendOrificeSlick(layers: OrificeSlickLayer[] | undefined): {
  wet01: number;
  quality01: number;
  dominant: LubricantKind | null;
  layers: OrificeSlickLayer[];
} {
  const normalized = normalizeLayers(layers);
  if (!normalized.length) {
    return { wet01: 0, quality01: 0, dominant: null, layers: [] };
  }
  const rawWet = normalized.reduce((sum, l) => sum + l.amount01, 0);
  const wet01 = Math.min(ORIFICE_SLICK_WET_CAP, rawWet);
  let qualityAcc = 0;
  for (const l of normalized) {
    qualityAcc += l.quality01 * l.amount01;
  }
  const quality01 = rawWet > 1e-6 ? clamp01(qualityAcc / rawWet) : 0;
  return {
    wet01,
    quality01,
    dominant: normalized[0]?.kind ?? null,
    layers: normalized,
  };
}

export function describeOrificeSlick(
  orifice: OrificeId,
  layers: OrificeSlickLayer[] | undefined
): OrificeSlickReport {
  const blend = blendOrificeSlick(layers);
  if (blend.wet01 < 0.02 || !blend.dominant) {
    return {
      orifice,
      wet01: 0,
      quality01: 0,
      dominant: null,
      layers: [],
      label: `${orifice} dry`,
      flavor: null,
    };
  }
  const entry = catalogEntry(blend.dominant);
  const label = `${orifice} ${(blend.wet01 * 100).toFixed(0)}% · ${entry.label} · q${(blend.quality01 * 100).toFixed(0)}`;
  const flavor = `a ${entry.label} slick wetting the ${orifice}`;
  return {
    orifice,
    wet01: blend.wet01,
    quality01: blend.quality01,
    dominant: blend.dominant,
    layers: blend.layers,
    label,
    flavor,
  };
}

/**
 * Add lubricant to an orifice layer stack (merges same kind).
 * amount01 is additive; quality defaults from catalog unless overridden.
 */
export function addOrificeSlickLayer(
  layers: OrificeSlickLayer[] | undefined,
  kind: LubricantKind,
  amount01: number,
  quality01?: number
): OrificeSlickLayer[] {
  if (!(amount01 > 1e-6)) return normalizeLayers(layers);
  const entry = catalogEntry(kind);
  return normalizeLayers([
    ...(layers ?? []),
    {
      kind,
      amount01,
      quality01: quality01 != null ? clamp01(quality01) : entry.quality01,
    },
  ]);
}

/** Evaporate each layer by its catalog dry-out rate. */
export function advanceOrificeSlickLayers(
  layers: OrificeSlickLayer[] | undefined,
  hours: number
): OrificeSlickLayer[] {
  if (!(hours > 0) || !layers?.length) return normalizeLayers(layers);
  const next: OrificeSlickLayer[] = [];
  for (const layer of layers) {
    const rate = catalogEntry(layer.kind).evaporatePerHour;
    const remain = layer.amount01 * Math.exp(-rate * hours);
    if (remain > 0.002) {
      next.push({ ...layer, amount01: remain });
    }
  }
  return normalizeLayers(next);
}

/** Map cloth/skin soil kinds onto lubricant kinds for passive writers. */
export function lubricantKindFromSoilKind(
  soilKind: string
): LubricantKind | null {
  switch (soilKind) {
    case 'arousalFluid':
    case 'vaginalDischarge':
      return 'vaginalSecretion';
    case 'semen':
      return 'semen';
    default:
      return null;
  }
}

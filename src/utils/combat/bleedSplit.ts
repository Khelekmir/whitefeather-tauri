/**
 * How a hit feeds external vs internal bleed intensities.
 * Fractions are normalized to sum to 1.
 */
export interface BleedSplit {
  external: number;
  internal: number;
}

/** Slash / open cut — 100% external. */
export const BLEED_SPLIT_EXTERNAL: BleedSplit = {
  external: 1,
  internal: 0,
};

/** Thrust / stab — 60% external / 40% internal. */
export const BLEED_SPLIT_THRUST: BleedSplit = {
  external: 0.6,
  internal: 0.4,
};

/** Armed blunt (mace/staff) — 20% external / 80% internal. */
export const BLEED_SPLIT_BLUNT: BleedSplit = {
  external: 0.2,
  internal: 0.8,
};

/** Unarmed punch/kick — internal only. */
export const BLEED_SPLIT_UNARMED: BleedSplit = {
  external: 0,
  internal: 1,
};

/** @deprecated Prefer BLEED_SPLIT_BLUNT — kept for older smokes. */
export const BLEED_SPLIT_BLUDGEON: BleedSplit = {
  external: 0.15,
  internal: 0.85,
};

/** Example spiked-mace style mix (unique weapons later). */
export const BLEED_SPLIT_SPIKE_MACE: BleedSplit = {
  external: 0.3,
  internal: 0.7,
};

export function normalizeBleedSplit(
  split: BleedSplit | null | undefined
): BleedSplit {
  if (!split) return { ...BLEED_SPLIT_EXTERNAL };
  const e = Math.max(0, split.external);
  const i = Math.max(0, split.internal);
  const sum = e + i;
  if (sum <= 1e-9) return { ...BLEED_SPLIT_EXTERNAL };
  return {
    external: e / sum,
    internal: i / sum,
  };
}

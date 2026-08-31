import type { BodyPartLewd, ItemizedLewd, Sex } from '../../types/characters';
import { defaultItemizedLewdForSex } from '../../utils/lewd/hydrateItemizedLewd';

type PartPatch = Partial<BodyPartLewd>;

function applyPatches(
  sex: Sex,
  patches: Record<string, PartPatch>
): ItemizedLewd {
  const base = defaultItemizedLewdForSex(sex);
  for (const [id, patch] of Object.entries(patches)) {
    if (!base[id]) continue;
    base[id] = { ...base[id], ...patch };
  }
  return base;
}

/**
 * Adult cast (18+). Personalized region prefs for Lewd lab.
 * Characters without an entry here hydrate from catalog defaults.
 */

/** Amberyl — eager when safe, prefers closeness/claiming, intensity mid, wary of rough. */
export const AMBERYL_ITEMIZED_LEWD: ItemizedLewd = applyPatches('F', {
  lips: { preference: 8, prefIntensity: 4, maxIntensity: 7, sensitivity: 1.1 },
  neckSide: { preference: 9, prefIntensity: 4, maxIntensity: 6, sensitivity: 1.15 },
  neckNape: { preference: 8, prefIntensity: 3, maxIntensity: 6, sensitivity: 1.1 },
  ear: { preference: 7, prefIntensity: 3, maxIntensity: 6, sensitivity: 1.05 },
  breast: { preference: 7, prefIntensity: 4, maxIntensity: 7, sensitivity: 1.05 },
  nipple: { preference: 8, prefIntensity: 4, maxIntensity: 7, sensitivity: 1.1 },
  handPalm: { preference: 6, prefIntensity: 3, maxIntensity: 6 },
  bellyLower: { preference: 7, prefIntensity: 3, maxIntensity: 6, sensitivity: 1.05 },
  thighInner: { preference: 8, prefIntensity: 4, maxIntensity: 7, sensitivity: 1.1 },
  clitoris: { preference: 9, prefIntensity: 5, maxIntensity: 8, sensitivity: 1.05 },
  labiaMinora: { preference: 8, prefIntensity: 4, maxIntensity: 7 },
  vaginaShallow: { preference: 8, prefIntensity: 5, maxIntensity: 8 },
  vaginaDeep: { preference: 6, prefIntensity: 4, maxIntensity: 7, sensitivity: 0.95 },
  anus: { preference: 3, prefIntensity: 2, maxIntensity: 4, sensitivity: 0.9 },
  buttockMain: { preference: 6, prefIntensity: 4, maxIntensity: 7 },
});

/** Sain — bold flirt, higher intensity tolerance, broad appetite. */
export const SAIN_ITEMIZED_LEWD: ItemizedLewd = applyPatches('M', {
  lips: { preference: 8, prefIntensity: 5, maxIntensity: 8, sensitivity: 1.05 },
  neckSide: { preference: 7, prefIntensity: 4, maxIntensity: 7 },
  chest: { preference: 5, prefIntensity: 4, maxIntensity: 7 }, // male breast key is breast in catalog
  breast: { preference: 5, prefIntensity: 4, maxIntensity: 7 },
  handPalm: { preference: 6, prefIntensity: 4, maxIntensity: 7 },
  thighInner: { preference: 7, prefIntensity: 5, maxIntensity: 8 },
  penisHead: { preference: 9, prefIntensity: 6, maxIntensity: 9, sensitivity: 1.1 },
  penisHeadUnderside: { preference: 9, prefIntensity: 6, maxIntensity: 9, sensitivity: 1.15 },
  penisShaft: { preference: 8, prefIntensity: 5, maxIntensity: 9, sensitivity: 1.05 },
  testicles: { preference: 7, prefIntensity: 4, maxIntensity: 7 },
  anus: { preference: 4, prefIntensity: 3, maxIntensity: 5, sensitivity: 0.95 },
  buttockMain: { preference: 6, prefIntensity: 5, maxIntensity: 8 },
});

/** Kent — reserved, gentler preferred intensity, slower to want intensity. */
export const KENT_ITEMIZED_LEWD: ItemizedLewd = applyPatches('M', {
  lips: { preference: 7, prefIntensity: 3, maxIntensity: 6, sensitivity: 1.0 },
  neckSide: { preference: 5, prefIntensity: 3, maxIntensity: 5 },
  handPalm: { preference: 6, prefIntensity: 3, maxIntensity: 6 },
  thighInner: { preference: 5, prefIntensity: 3, maxIntensity: 6 },
  penisHead: { preference: 7, prefIntensity: 4, maxIntensity: 7, sensitivity: 1.0 },
  penisShaft: { preference: 7, prefIntensity: 4, maxIntensity: 7 },
  testicles: { preference: 5, prefIntensity: 3, maxIntensity: 6 },
  anus: { preference: 2, prefIntensity: 2, maxIntensity: 4, sensitivity: 0.85 },
  buttockMain: { preference: 4, prefIntensity: 3, maxIntensity: 6 },
});

/** Lyn — earnest warrior; modest libido; likes closeness, wary of rough. */
export const LYN_ITEMIZED_LEWD: ItemizedLewd = applyPatches('F', {
  lips: { preference: 8, prefIntensity: 3, maxIntensity: 6, sensitivity: 1.05 },
  neckSide: { preference: 7, prefIntensity: 3, maxIntensity: 6, sensitivity: 1.05 },
  handPalm: { preference: 7, prefIntensity: 3, maxIntensity: 6 },
  breast: { preference: 6, prefIntensity: 3, maxIntensity: 6 },
  nipple: { preference: 6, prefIntensity: 3, maxIntensity: 6, sensitivity: 1.0 },
  thighInner: { preference: 7, prefIntensity: 4, maxIntensity: 7, sensitivity: 1.05 },
  clitoris: { preference: 7, prefIntensity: 4, maxIntensity: 7, sensitivity: 1.0 },
  labiaMinora: { preference: 6, prefIntensity: 3, maxIntensity: 6 },
  vaginaShallow: { preference: 7, prefIntensity: 4, maxIntensity: 7 },
  vaginaDeep: { preference: 5, prefIntensity: 3, maxIntensity: 6, sensitivity: 0.95 },
  anus: { preference: 2, prefIntensity: 2, maxIntensity: 4, sensitivity: 0.85 },
  buttockMain: { preference: 5, prefIntensity: 3, maxIntensity: 6 },
});

/** Serra — bold, attention-hungry; higher intensity appetite, performative. */
export const SERRA_ITEMIZED_LEWD: ItemizedLewd = applyPatches('F', {
  lips: { preference: 8, prefIntensity: 5, maxIntensity: 8, sensitivity: 1.05 },
  neckSide: { preference: 7, prefIntensity: 4, maxIntensity: 7 },
  ear: { preference: 7, prefIntensity: 4, maxIntensity: 7, sensitivity: 1.05 },
  breast: { preference: 8, prefIntensity: 5, maxIntensity: 8, sensitivity: 1.1 },
  nipple: { preference: 8, prefIntensity: 5, maxIntensity: 8, sensitivity: 1.1 },
  handPalm: { preference: 6, prefIntensity: 4, maxIntensity: 7 },
  buttockMain: { preference: 8, prefIntensity: 5, maxIntensity: 8 },
  thighInner: { preference: 7, prefIntensity: 5, maxIntensity: 8 },
  clitoris: { preference: 8, prefIntensity: 5, maxIntensity: 8, sensitivity: 1.05 },
  labiaMinora: { preference: 7, prefIntensity: 4, maxIntensity: 7 },
  vaginaShallow: { preference: 8, prefIntensity: 5, maxIntensity: 8 },
  vaginaDeep: { preference: 6, prefIntensity: 4, maxIntensity: 7 },
  anus: { preference: 4, prefIntensity: 3, maxIntensity: 5, sensitivity: 0.95 },
});

/**
 * Florina — Whitewing-leaning shy knight; gentle caps, high sens on soft zones,
 * genital play cautious until trust is deep.
 */
export const FLORINA_ITEMIZED_LEWD: ItemizedLewd = applyPatches('F', {
  lips: { preference: 9, prefIntensity: 2, maxIntensity: 5, sensitivity: 1.15 },
  neckNape: { preference: 9, prefIntensity: 2, maxIntensity: 5, sensitivity: 1.2 },
  neckSide: { preference: 8, prefIntensity: 2, maxIntensity: 5, sensitivity: 1.15 },
  ear: { preference: 8, prefIntensity: 2, maxIntensity: 5, sensitivity: 1.15 },
  handPalm: { preference: 8, prefIntensity: 2, maxIntensity: 5, sensitivity: 1.1 },
  breast: { preference: 6, prefIntensity: 2, maxIntensity: 5, sensitivity: 1.05 },
  nipple: { preference: 6, prefIntensity: 2, maxIntensity: 5, sensitivity: 1.1 },
  thighInner: { preference: 7, prefIntensity: 3, maxIntensity: 5, sensitivity: 1.1 },
  clitoris: { preference: 7, prefIntensity: 3, maxIntensity: 6, sensitivity: 1.1 },
  labiaMinora: { preference: 6, prefIntensity: 2, maxIntensity: 5 },
  vaginaShallow: { preference: 6, prefIntensity: 3, maxIntensity: 6, sensitivity: 1.0 },
  vaginaDeep: { preference: 4, prefIntensity: 2, maxIntensity: 5, sensitivity: 0.9 },
  anus: { preference: 1, prefIntensity: 1, maxIntensity: 3, sensitivity: 0.8 },
  buttockMain: { preference: 5, prefIntensity: 2, maxIntensity: 5 },
});

export const CAST_ITEMIZED_LEWD: Record<string, ItemizedLewd> = {
  unit_amberyl: AMBERYL_ITEMIZED_LEWD,
  unit_sain: SAIN_ITEMIZED_LEWD,
  unit_kent: KENT_ITEMIZED_LEWD,
  unit_lyn: LYN_ITEMIZED_LEWD,
  unit_serra: SERRA_ITEMIZED_LEWD,
  unit_florina: FLORINA_ITEMIZED_LEWD,
};

export function itemizedLewdForCastId(id: string): ItemizedLewd | undefined {
  return CAST_ITEMIZED_LEWD[id];
}

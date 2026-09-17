import type {
  ArmorSizePreset,
  CoverageMap,
  FootwearLengthPreset,
  GarmentLengthPreset,
  GarmentSleevePreset,
  HeadwearStyle,
  ItemSlot,
} from '../../types/items';

export type {
  ArmorSizePreset,
  CoverageMap,
  FootwearLengthPreset,
  GarmentLengthPreset,
  GarmentSleevePreset,
  HeadwearStyle,
};

/**
 * Default coverage when a template only specifies slot + sizePreset.
 * Values are 0–1 coverage strength for that hit location.
 */
export const CHEST_COVERAGE_PRESETS: Record<ArmorSizePreset, CoverageMap> = {
  small: {
    chestLeft: 1,
    chestRight: 1,
  },
  medium: {
    chestLeft: 1,
    chestRight: 1,
    stomachUpper: 0.7,
    obliqueLeft: 0.5,
    obliqueRight: 0.5,
  },
  large: {
    chestLeft: 1,
    chestRight: 1,
    stomachUpper: 1,
    stomachLower: 0.75,
    obliqueLeft: 0.85,
    obliqueRight: 0.85,
  },
};

/** Shared torso block for shirt-slot garments. */
const GARMENT_TORSO: CoverageMap = {
  chestLeft: 1,
  chestRight: 1,
  stomachUpper: 1,
  stomachLower: 1,
  obliqueLeft: 1,
  obliqueRight: 1,
};

/**
 * Dress / robe / tunic hang length for the **shirt** slot (hem only — no arms).
 * Sleeve cut is a separate axis: see GARMENT_SLEEVE_COVERAGE / sleeveStyle.
 *
 * - tunic: standard shirt — torso (+ light hip), no thigh coverage
 * - short: mid-thigh dress (Florina) — hips + thighs, stops above the knee
 * - long: ankle-length robe/dress (Serra) — through lower legs, hem at feet
 * - full: ceremonial / trailing robe — stronger foot hem coverage
 *
 * Legs stay empty on the unit; the garment provides coverage via these maps.
 */
export const GARMENT_LENGTH_COVERAGE: Record<GarmentLengthPreset, CoverageMap> = {
  tunic: {
    ...GARMENT_TORSO,
    hipLeft: 0.35,
    hipRight: 0.35,
  },
  short: {
    ...GARMENT_TORSO,
    hipLeft: 0.9,
    hipRight: 0.9,
    groin: 0.7,
    anus: 0.7,
    buttockLeft: 0.75,
    buttockRight: 0.75,
    // mid-thigh — strong thigh coverage, no knee
    thighOuterLeft: 0.9,
    thighOuterRight: 0.9,
    thighInnerLeft: 0.75,
    thighInnerRight: 0.75,
  },
  long: {
    ...GARMENT_TORSO,
    hipLeft: 1,
    hipRight: 1,
    groin: 1,
    anus: 1,
    buttockLeft: 1,
    buttockRight: 1,
    thighOuterLeft: 1,
    thighOuterRight: 1,
    thighInnerLeft: 0.9,
    thighInnerRight: 0.9,
    kneeLeft: 0.85,
    kneeRight: 0.85,
    lowerLegLeft: 0.8,
    lowerLegRight: 0.8,
    footLeft: 0.2,
    footRight: 0.2,
  },
  full: {
    ...GARMENT_TORSO,
    hipLeft: 1,
    hipRight: 1,
    groin: 1,
    anus: 1,
    buttockLeft: 0.95,
    buttockRight: 0.95,
    thighOuterLeft: 1,
    thighOuterRight: 1,
    thighInnerLeft: 0.95,
    thighInnerRight: 0.95,
    kneeLeft: 0.95,
    kneeRight: 0.95,
    lowerLegLeft: 0.95,
    lowerLegRight: 0.95,
    footLeft: 0.55,
    footRight: 0.55,
  },
};

/**
 * Shirt-slot sleeve cut — merged with garmentLength in resolve.
 *
 * - none: sleeveless (Serra) — empty map
 * - short: Florina / Lyn — shoulders lightly, upper arms
 * - long: Amberyl tunic — through forearms
 */
export const GARMENT_SLEEVE_COVERAGE: Record<GarmentSleevePreset, CoverageMap> = {
  none: {},
  short: {
    shoulderLeft: 0.35,
    shoulderRight: 0.35,
    upperArmLeft: 0.85,
    upperArmRight: 0.85,
  },
  long: {
    shoulderLeft: 0.55,
    shoulderRight: 0.55,
    upperArmLeft: 1,
    upperArmRight: 1,
    lowerArmLeft: 0.9,
    lowerArmRight: 0.9,
  },
};

/**
 * Head-slot coverage.
 *
 * - fullHelmet: enclosed protection (head, face, eyes, ears)
 * - halfHelm: open / nasal helm — scalp + partial face & ears
 * - hat: hoods, wide brims — mainly crown, light ear brush
 * - hairOrnament: ties, ribbons, circlets — negligible combat value
 *   (equip for flags / lewd / presentation, not mitigation)
 */
export const HEADWEAR_COVERAGE: Record<HeadwearStyle, CoverageMap> = {
  fullHelmet: {
    head: 1,
    face: 1,
    eyeLeft: 0.95,
    eyeRight: 0.95,
    earLeft: 1,
    earRight: 1,
    neck: 0.25,
  },
  halfHelm: {
    head: 1,
    face: 0.45,
    eyeLeft: 0.2,
    eyeRight: 0.2,
    earLeft: 0.7,
    earRight: 0.7,
    neck: 0.1,
  },
  hat: {
    head: 0.85,
    face: 0.05,
    earLeft: 0.25,
    earRight: 0.25,
  },
  hairOrnament: {
    // Negligible — present so the slot resolves, not for combat mitigation
    head: 0.02,
  },
};

/**
 * Foot-slot rise height.
 *
 * - slipper: sole / below ankle only
 * - shoe: wraps just above the ankle
 * - boot: mid-calf
 * - kneeHigh: shaft ends just below the knee
 * - riding: shaft clears the knee onto the lower thigh (cavalry / pegasus)
 */
export const FOOTWEAR_LENGTH_COVERAGE: Record<FootwearLengthPreset, CoverageMap> = {
  slipper: {
    footLeft: 1,
    footRight: 1,
  },
  shoe: {
    footLeft: 1,
    footRight: 1,
    lowerLegLeft: 0.2,
    lowerLegRight: 0.2,
  },
  boot: {
    footLeft: 1,
    footRight: 1,
    lowerLegLeft: 0.65,
    lowerLegRight: 0.65,
  },
  kneeHigh: {
    footLeft: 1,
    footRight: 1,
    lowerLegLeft: 1,
    lowerLegRight: 1,
    // just below the kneecap — light contact only
    kneeLeft: 0.25,
    kneeRight: 0.25,
  },
  riding: {
    footLeft: 1,
    footRight: 1,
    lowerLegLeft: 1,
    lowerLegRight: 1,
    kneeLeft: 1,
    kneeRight: 1,
    // clears the knee onto the lower outer thigh
    thighOuterLeft: 0.4,
    thighOuterRight: 0.4,
    thighInnerLeft: 0.2,
    thighInnerRight: 0.2,
  },
};

/** Sensible defaults by slot when no coverage / sizePreset / garmentLength is set. */
export const DEFAULT_SLOT_COVERAGE: Partial<Record<ItemSlot, CoverageMap>> = {
  /** Prefer headwearStyle on templates; hat is a neutral fallback. */
  head: HEADWEAR_COVERAGE.hat,
  shoulder: {
    shoulderLeft: 1,
    shoulderRight: 1,
    upperArmLeft: 0.5,
    upperArmRight: 0.5,
    neck: 0.3,
  },
  back: {
    shoulderLeft: 0.2,
    shoulderRight: 0.2,
    chestLeft: 0.15,
    chestRight: 0.15,
  },
  chest: CHEST_COVERAGE_PRESETS.medium,
  shirt: GARMENT_LENGTH_COVERAGE.tunic,
  /** Prefer undershirtStyle on templates; this is a neutral fallback. */
  undershirt: {
    chestLeft: 0.6,
    chestRight: 0.6,
    stomachUpper: 0.4,
  },
  waist: {
    stomachLower: 0.7,
    hipLeft: 0.6,
    hipRight: 0.6,
  },
  /** Prefer underwearStyle on templates; this is a neutral fallback. */
  underwear: {
    groin: 0.8,
    anus: 0.5,
    buttockLeft: 0.4,
    buttockRight: 0.4,
  },
  hand: {
    handLeft: 1,
    handRight: 1,
    lowerArmLeft: 0.3,
    lowerArmRight: 0.3,
  },
  wrist: {
    lowerArmLeft: 0.7,
    lowerArmRight: 0.7,
  },
  leg: {
    hipLeft: 0.5,
    hipRight: 0.5,
    groin: 0.5,
    buttockLeft: 0.8,
    buttockRight: 0.8,
    thighInnerLeft: 1,
    thighInnerRight: 1,
    thighOuterLeft: 1,
    thighOuterRight: 1,
    kneeLeft: 0.4,
    kneeRight: 0.4,
  },
  shin: {
    kneeLeft: 0.7,
    kneeRight: 0.7,
    lowerLegLeft: 1,
    lowerLegRight: 1,
  },
  foot: FOOTWEAR_LENGTH_COVERAGE.shoe,
  neck: {
    neck: 1,
  },
};

import type {
  CoverageMap,
  FemaleUnderwearStyle,
  FemaleUndershirtStyle,
  MaleUnderwearStyle,
  MaleUndershirtStyle,
} from '../../types/items';

/**
 * Sex-split undergarment coverage — authored for adult-theme consistency
 * (how much is covered / revealed), not only battlefield realism.
 */

// —— Female underwear (slot: underwear) ——

export const FEMALE_UNDERWEAR_COVERAGE: Record<FemaleUnderwearStyle, CoverageMap> = {
  /** Pegasus knight's panty — fuller seat and hip coverage */
  pegasusPanty: {
    groin: 1,
    anus: 0.85,
    buttockLeft: 0.9,
    buttockRight: 0.9,
    hipLeft: 0.55,
    hipRight: 0.55,
    thighInnerLeft: 0.25,
    thighInnerRight: 0.25,
  },
  /** Tribal cloth — narrow strip, minimal coverage */
  tribalCloth: {
    groin: 0.7,
    anus: 0.25,
    buttockLeft: 0.15,
    buttockRight: 0.15,
  },
  modestPanty: {
    groin: 0.95,
    anus: 0.7,
    buttockLeft: 0.65,
    buttockRight: 0.65,
    hipLeft: 0.35,
    hipRight: 0.35,
  },
  risquePanty: {
    groin: 0.55,
    anus: 0.2,
    buttockLeft: 0.2,
    buttockRight: 0.2,
  },
  /** Long slip skirt only — no top; hangs like a long underskirt */
  longSlipSkirt: {
    hipLeft: 0.95,
    hipRight: 0.95,
    groin: 0.75,
    anus: 0.6,
    buttockLeft: 0.95,
    buttockRight: 0.95,
    thighOuterLeft: 0.95,
    thighOuterRight: 0.95,
    thighInnerLeft: 0.9,
    thighInnerRight: 0.9,
    kneeLeft: 0.85,
    kneeRight: 0.85,
    lowerLegLeft: 0.8,
    lowerLegRight: 0.8,
    footLeft: 0.15,
    footRight: 0.15,
  },
  /** Short slip skirt only — mid-thigh underskirt */
  shortSlipSkirt: {
    hipLeft: 0.9,
    hipRight: 0.9,
    groin: 0.65,
    anus: 0.45,
    buttockLeft: 0.85,
    buttockRight: 0.85,
    thighOuterLeft: 0.85,
    thighOuterRight: 0.85,
    thighInnerLeft: 0.7,
    thighInnerRight: 0.7,
  },
};

// —— Male underwear ——

export const MALE_UNDERWEAR_COVERAGE: Record<MaleUnderwearStyle, CoverageMap> = {
  briefs: {
    groin: 1,
    anus: 0.75,
    buttockLeft: 0.7,
    buttockRight: 0.7,
    hipLeft: 0.4,
    hipRight: 0.4,
  },
  loincloth: {
    groin: 0.85,
    anus: 0.35,
    buttockLeft: 0.25,
    buttockRight: 0.25,
  },
  shorts: {
    groin: 1,
    anus: 0.8,
    buttockLeft: 0.85,
    buttockRight: 0.85,
    hipLeft: 0.7,
    hipRight: 0.7,
    thighOuterLeft: 0.45,
    thighOuterRight: 0.45,
    thighInnerLeft: 0.4,
    thighInnerRight: 0.4,
  },
};

// —— Female undershirt (slot: undershirt) ——

const SLIP_TORSO: CoverageMap = {
  chestLeft: 0.9,
  chestRight: 0.9,
  stomachUpper: 0.85,
  stomachLower: 0.8,
  obliqueLeft: 0.75,
  obliqueRight: 0.75,
};

export const FEMALE_UNDERSHIRT_COVERAGE: Record<FemaleUndershirtStyle, CoverageMap> = {
  /** Full slip — sleeveless, hem to ankles */
  fullSlip: {
    ...SLIP_TORSO,
    hipLeft: 0.95,
    hipRight: 0.95,
    groin: 0.7,
    anus: 0.55,
    buttockLeft: 0.9,
    buttockRight: 0.9,
    thighOuterLeft: 0.95,
    thighOuterRight: 0.95,
    thighInnerLeft: 0.9,
    thighInnerRight: 0.9,
    kneeLeft: 0.9,
    kneeRight: 0.9,
    lowerLegLeft: 0.9,
    lowerLegRight: 0.9,
    footLeft: 0.35,
    footRight: 0.35,
  },
  /** Slip — sleeveless, hem to knees */
  slip: {
    ...SLIP_TORSO,
    hipLeft: 0.9,
    hipRight: 0.9,
    groin: 0.6,
    anus: 0.45,
    buttockLeft: 0.85,
    buttockRight: 0.85,
    thighOuterLeft: 0.9,
    thighOuterRight: 0.9,
    thighInnerLeft: 0.85,
    thighInnerRight: 0.85,
    kneeLeft: 0.75,
    kneeRight: 0.75,
  },
  /** Short slip — sleeveless, hem to the butt */
  shortSlip: {
    ...SLIP_TORSO,
    hipLeft: 0.85,
    hipRight: 0.85,
    groin: 0.4,
    anus: 0.35,
    buttockLeft: 0.8,
    buttockRight: 0.8,
    thighOuterLeft: 0.2,
    thighOuterRight: 0.2,
  },
  tribalBreastCloth: {
    chestLeft: 0.75,
    chestRight: 0.75,
  },
  modestBra: {
    chestLeft: 0.95,
    chestRight: 0.95,
  },
  risqueBra: {
    chestLeft: 0.55,
    chestRight: 0.55,
  },
  /** Pegasus knight's bra — fuller supportive coverage */
  pegasusBra: {
    chestLeft: 1,
    chestRight: 1,
    stomachUpper: 0.15,
  },
};

// —— Male undershirt ——

export const MALE_UNDERSHIRT_COVERAGE: Record<MaleUndershirtStyle, CoverageMap> = {
  undershirt: {
    chestLeft: 0.85,
    chestRight: 0.85,
    stomachUpper: 0.7,
    stomachLower: 0.45,
    obliqueLeft: 0.5,
    obliqueRight: 0.5,
  },
  binding: {
    chestLeft: 0.9,
    chestRight: 0.9,
  },
};

export function isFemaleUnderwearStyle(style: string): style is FemaleUnderwearStyle {
  return style in FEMALE_UNDERWEAR_COVERAGE;
}

export function isMaleUnderwearStyle(style: string): style is MaleUnderwearStyle {
  return style in MALE_UNDERWEAR_COVERAGE;
}

export function isFemaleUndershirtStyle(style: string): style is FemaleUndershirtStyle {
  return style in FEMALE_UNDERSHIRT_COVERAGE;
}

export function isMaleUndershirtStyle(style: string): style is MaleUndershirtStyle {
  return style in MALE_UNDERSHIRT_COVERAGE;
}

export function getUnderwearStyleCoverage(style: string): CoverageMap | undefined {
  if (isFemaleUnderwearStyle(style)) return FEMALE_UNDERWEAR_COVERAGE[style];
  if (isMaleUnderwearStyle(style)) return MALE_UNDERWEAR_COVERAGE[style];
  return undefined;
}

export function getUndershirtStyleCoverage(style: string): CoverageMap | undefined {
  if (isFemaleUndershirtStyle(style)) return FEMALE_UNDERSHIRT_COVERAGE[style];
  if (isMaleUndershirtStyle(style)) return MALE_UNDERSHIRT_COVERAGE[style];
  return undefined;
}
